import { DurableObject } from 'cloudflare:workers';
import type { VatsimUser, Controller } from '@fssphone/shared';
import type { ClientMessage, ServerMessage, WebRTCSignal, ICECandidateData } from '@fssphone/shared';
import type { Call } from '@fssphone/shared';
import { isValidFrequency, normalizeFrequency } from '@fssphone/shared';
import { ControllerRegistry } from './services/ControllerRegistry';
import { CallManager } from './services/CallManager';
import type { Env } from './index';

interface ConnectionMeta {
  connectionId: string;
  user: VatsimUser;
  controllerId?: string;
}

export class LobbyDO extends DurableObject<Env> {
  private controllers: ControllerRegistry;
  private calls: CallManager;
  private initialized = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.controllers = new ControllerRegistry();
    this.calls = new CallManager();

    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong')
    );

    this.ctx.blockConcurrencyWhile(async () => {
      await this.restoreState();
    });
  }

  private async restoreState(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Get all live connection IDs so we can prune stale entries
    const liveConnectionIds = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment() as ConnectionMeta | null;
      if (meta) liveConnectionIds.add(meta.connectionId);
    }

    // Restore controllers from DO storage, only if their connection is still alive
    const controllerEntries = await this.ctx.storage.list<Controller>({ prefix: 'ctrl:' });
    for (const [key, controller] of controllerEntries) {
      if (liveConnectionIds.has(controller.connectionId)) {
        this.controllers.restore(controller);
      } else {
        // Stale — connection is gone, clean up
        await this.ctx.storage.delete(key);
      }
    }

    // Restore calls from DO storage
    const callEntries = await this.ctx.storage.list<Call>({ prefix: 'call:' });
    for (const [key, call] of callEntries) {
      if (call.status !== 'ended') {
        this.calls.restore(call);
      } else {
        await this.ctx.storage.delete(key);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Enforce single-use WS ticket
    const jti = request.headers.get('X-Ticket-JTI');
    if (jti) {
      const used = await this.ctx.storage.get<boolean>(`ticket:${jti}`);
      if (used) {
        return new Response('Ticket already used', { status: 401 });
      }
      // Mark as used, auto-expire via DO storage (cleaned up after 2 min)
      await this.ctx.storage.put(`ticket:${jti}`, true);
      this.ctx.storage.setAlarm(Date.now() + 120_000);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    const connectionId = crypto.randomUUID();
    const user: VatsimUser = {
      cid: request.headers.get('X-User-CID') || '',
      name: request.headers.get('X-User-Name') || '',
      rating: parseInt(request.headers.get('X-User-Rating') || '0'),
      ratingShort: request.headers.get('X-User-Rating-Short') || '',
      ratingLong: request.headers.get('X-User-Rating-Long') || '',
    };

    const meta: ConnectionMeta = { connectionId, user };

    this.ctx.acceptWebSocket(server, [connectionId]);
    server.serializeAttachment(meta);

    server.send(JSON.stringify({ type: 'welcome', payload: { connectionId } }));
    server.send(JSON.stringify({ type: 'controllers:list', payload: this.controllers.getAll() }));

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;

    const meta = ws.deserializeAttachment() as ConnectionMeta | null;
    if (!meta) return;

    let msg: ClientMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    switch (msg.type) {
      case 'controller:register':
        this.handleControllerRegister(ws, meta, msg.payload!);
        break;
      case 'controller:unregister':
        this.handleControllerUnregister(ws, meta);
        break;
      case 'call:initiate':
        this.handleCallInitiate(ws, meta, msg.payload!);
        break;
      case 'call:answer':
        this.handleCallAnswer(ws, meta, msg.payload!);
        break;
      case 'call:reject':
        this.handleCallReject(meta, msg.payload!);
        break;
      case 'call:hangup':
        this.handleCallHangup(meta, msg.payload!);
        break;
      case 'webrtc:offer':
      case 'webrtc:answer':
        this.relayWebRTC(msg.type, msg.payload as WebRTCSignal);
        break;
      case 'webrtc:ice-candidate':
        this.relayICE(msg.payload as ICECandidateData);
        break;
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const meta = ws.deserializeAttachment() as ConnectionMeta | null;
    if (meta) {
      this.handleDisconnect(meta);
    }
    const safeCode = (code === 1005 || code === 1006) ? 1000 : code;
    ws.close(safeCode, reason);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    const meta = ws.deserializeAttachment() as ConnectionMeta | null;
    if (meta) {
      this.handleDisconnect(meta);
    }
    ws.close(1011, 'Unexpected error');
  }

  async alarm(): Promise<void> {
    // Clean up expired ticket JTIs
    const tickets = await this.ctx.storage.list({ prefix: 'ticket:' });
    for (const key of tickets.keys()) {
      await this.ctx.storage.delete(key);
    }
  }

  // --- Event handlers ---

  private handleControllerRegister(ws: WebSocket, meta: ConnectionMeta, data: { callsign: string; frequency: string }): void {
    if (!data.callsign.trim()) {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Callsign is required' } });
      return;
    }
    if (!isValidFrequency(data.frequency)) {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Invalid VHF frequency. Must be 118.000-136.975 MHz with valid channel spacing.' } });
      return;
    }
    data.frequency = normalizeFrequency(data.frequency);

    // If this connection already has a controller, unregister the old one first
    const existing = this.controllers.findByConnectionId(meta.connectionId);
    if (existing) {
      this.controllers.unregister(existing.id);
      this.ctx.storage.delete(`ctrl:${existing.id}`);
    }

    const controller = this.controllers.register(meta.connectionId, data, meta.user.cid, meta.user.name);

    // Persist to DO storage for hibernation survival
    this.ctx.storage.put(`ctrl:${controller.id}`, controller);

    // Update attachment with controllerId
    const updatedMeta: ConnectionMeta = { ...meta, controllerId: controller.id };
    ws.serializeAttachment(updatedMeta);

    this.sendTo(meta.connectionId, { type: 'controller:updated', payload: controller });
    this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
  }

  private handleControllerUnregister(ws: WebSocket, meta: ConnectionMeta): void {
    const controller = this.controllers.findByConnectionId(meta.connectionId);
    if (controller) {
      this.controllers.unregister(controller.id);
      this.ctx.storage.delete(`ctrl:${controller.id}`);

      const updatedMeta: ConnectionMeta = { connectionId: meta.connectionId, user: meta.user };
      ws.serializeAttachment(updatedMeta);

      this.broadcast({ type: 'controller:removed', payload: { controllerId: controller.id } });
      this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
    }
  }

  private handleCallInitiate(ws: WebSocket, meta: ConnectionMeta, data: { controllerId: string; pilotCallsign: string }): void {
    const controller = this.controllers.findById(data.controllerId);
    if (!controller) {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Controller not found' } });
      return;
    }
    if (controller.status === 'busy') {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Controller is busy' } });
      return;
    }
    const existing = this.calls.findByPilot(meta.connectionId);
    if (existing) {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'You already have an active call' } });
      return;
    }

    const call = this.calls.create(meta.connectionId, meta.user.cid, controller.connectionId, data);
    this.controllers.updateStatus(controller.id, 'busy');

    // Persist both
    this.ctx.storage.put(`call:${call.id}`, call);
    this.ctx.storage.put(`ctrl:${controller.id}`, controller);

    this.broadcast({ type: 'controller:updated', payload: controller });
    this.sendTo(meta.connectionId, { type: 'call:ringing', payload: call });
    this.sendTo(controller.connectionId, { type: 'call:incoming', payload: call });
  }

  private handleCallAnswer(ws: WebSocket, meta: ConnectionMeta, data: { callId: string }): void {
    const call = this.calls.findById(data.callId);
    if (!call) {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Call not found' } });
      return;
    }

    if (call.controllerConnectionId !== meta.connectionId) {
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Not authorized' } });
      return;
    }
    this.calls.updateStatus(data.callId, 'active');

    this.sendTo(call.pilotConnectionId, { type: 'call:established', payload: call });
    this.sendTo(meta.connectionId, { type: 'call:established', payload: call });

    this.ctx.storage.put(`call:${call.id}`, call);
  }

  private handleCallReject(meta: ConnectionMeta, data: { callId: string }): void {
    const call = this.calls.findById(data.callId);
    if (!call) return;
    if (call.controllerConnectionId !== meta.connectionId) return;

    this.calls.end(data.callId);
    this.ctx.storage.delete(`call:${data.callId}`);

    const controller = this.controllers.findById(call.controllerId);
    if (controller) {
      this.controllers.updateStatus(controller.id, 'online');
      this.ctx.storage.put(`ctrl:${controller.id}`, controller);
      this.broadcast({ type: 'controller:updated', payload: controller });
    }
    this.sendTo(call.pilotConnectionId, { type: 'call:ended', payload: { callId: data.callId, reason: 'Call rejected' } });
    this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
  }

  private handleCallHangup(meta: ConnectionMeta, data: { callId: string }): void {
    const call = this.calls.findById(data.callId);
    if (!call) return;
    // Only the pilot or controller in this call can hang up
    if (call.pilotConnectionId !== meta.connectionId && call.controllerConnectionId !== meta.connectionId) return;

    this.calls.end(data.callId);
    this.ctx.storage.delete(`call:${data.callId}`);

    const controller = this.controllers.findById(call.controllerId);
    if (controller) {
      this.controllers.updateStatus(controller.id, 'online');
      this.ctx.storage.put(`ctrl:${controller.id}`, controller);
    }

    this.sendTo(call.pilotConnectionId, { type: 'call:ended', payload: { callId: data.callId } });
    this.sendTo(call.controllerConnectionId, { type: 'call:ended', payload: { callId: data.callId } });
    // Broadcast fresh controller list so all clients have accurate state
    this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
  }

  private relayWebRTC(type: 'webrtc:offer' | 'webrtc:answer', data: WebRTCSignal): void {
    this.sendTo(data.to, { type, payload: data });
  }

  private relayICE(data: ICECandidateData): void {
    this.sendTo(data.to, { type: 'webrtc:ice-candidate', payload: data });
  }

  private handleDisconnect(meta: ConnectionMeta): void {
    const controller = this.controllers.findByConnectionId(meta.connectionId);
    if (controller) {
      const call = this.calls.findByController(controller.id);
      if (call) {
        this.calls.end(call.id);
        this.ctx.storage.delete(`call:${call.id}`);
        this.sendTo(call.pilotConnectionId, { type: 'call:ended', payload: { callId: call.id, reason: 'Controller disconnected' } });
      }
      this.controllers.unregister(controller.id);
      this.ctx.storage.delete(`ctrl:${controller.id}`);
      this.broadcast({ type: 'controller:removed', payload: { controllerId: controller.id } });
      this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
    }

    const call = this.calls.findByPilot(meta.connectionId);
    if (call) {
      const ctrl = this.controllers.findById(call.controllerId);
      if (ctrl) {
        this.controllers.updateStatus(ctrl.id, 'online');
        this.ctx.storage.put(`ctrl:${ctrl.id}`, ctrl);
        this.broadcast({ type: 'controller:updated', payload: ctrl });
        this.sendTo(ctrl.connectionId, { type: 'call:ended', payload: { callId: call.id, reason: 'Pilot disconnected' } });
      }
      this.calls.end(call.id);
      this.ctx.storage.delete(`call:${call.id}`);
      this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
    }
  }

  // --- Helpers ---

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(data);
    }
  }

  private sendTo(connectionId: string, msg: ServerMessage): void {
    const sockets = this.ctx.getWebSockets(connectionId);
    const data = JSON.stringify(msg);
    for (const ws of sockets) {
      ws.send(data);
    }
  }
}
