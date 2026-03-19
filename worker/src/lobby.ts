import { DurableObject } from 'cloudflare:workers';
import type { VatsimUser } from '@fssphone/shared';
import type { ClientMessage, ServerMessage, WebRTCSignal, ICECandidateData } from '@fssphone/shared';
import type { Call } from '@fssphone/shared';
import { isValidFrequency, normalizeFrequency } from '@fssphone/shared';
import { ControllerRegistry } from './services/ControllerRegistry';
import { CallManager } from './services/CallManager';
import type { Env } from './index';

interface ConnectionMeta {
  connectionId: string;
  user: VatsimUser;
  // Track what role this connection has registered as
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

    // Restore state before handling any messages
    this.ctx.blockConcurrencyWhile(async () => {
      await this.restoreState();
    });
  }

  /** Rebuild in-memory state from live WebSocket attachments and storage after hibernation */
  private async restoreState(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Restore controllers from WebSocket attachments
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment() as (ConnectionMeta & {
        controllerCallsign?: string;
        controllerFrequency?: string;
        controllerStatus?: 'online' | 'busy';
      }) | null;
      if (!meta) continue;

      if (meta.controllerId && meta.controllerCallsign) {
        const existing = this.controllers.findById(meta.controllerId);
        if (!existing) {
          this.controllers.restore({
            id: meta.controllerId,
            cid: meta.user.cid,
            name: meta.user.name,
            connectionId: meta.connectionId,
            callsign: meta.controllerCallsign,
            frequency: meta.controllerFrequency!,
            status: meta.controllerStatus || 'online',
          });
        }
      }
    }

    // Restore calls from DO storage
    const entries = await this.ctx.storage.list<Call>({ prefix: 'call:' });
    for (const [, call] of entries) {
      if (call.status !== 'ended') {
        this.calls.restore(call);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
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
        this.handleCallReject(ws, msg.payload!);
        break;
      case 'call:hangup':
        this.handleCallHangup(msg.payload!);
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
    // 1005 and 1006 are reserved codes that can't be sent in a close frame
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

    // Persist controller info in the WebSocket attachment so it survives hibernation
    const updatedMeta: ConnectionMeta & { controllerCallsign: string; controllerFrequency: string; controllerStatus: string } = {
      ...meta,
      controllerId: controller.id,
      controllerCallsign: data.callsign,
      controllerFrequency: data.frequency,
      controllerStatus: 'online',
    };
    ws.serializeAttachment(updatedMeta);

    this.sendTo(meta.connectionId, { type: 'controller:updated', payload: controller });
    this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
  }

  private handleControllerUnregister(ws: WebSocket, meta: ConnectionMeta): void {
    const controller = this.controllers.findByConnectionId(meta.connectionId);
    if (controller) {
      this.controllers.unregister(controller.id);

      // Clear controller info from attachment
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

    // Update controller's attachment with busy status
    this.updateControllerAttachmentStatus(controller.connectionId, 'busy');

    this.broadcast({ type: 'controller:updated', payload: controller });
    this.sendTo(meta.connectionId, { type: 'call:ringing', payload: call });
    this.sendTo(controller.connectionId, { type: 'call:incoming', payload: call });

    // Store call in DO storage for hibernation survival
    this.ctx.storage.put(`call:${call.id}`, call);
  }

  private handleCallAnswer(ws: WebSocket, meta: ConnectionMeta, data: { callId: string }): void {
    let call = this.calls.findById(data.callId);

    // If not in memory, try storage
    if (!call) {
      // Will be loaded async, but for now check synchronously
      this.sendTo(meta.connectionId, { type: 'error', payload: { message: 'Call not found' } });
      return;
    }

    call.controllerConnectionId = meta.connectionId;
    this.calls.updateStatus(data.callId, 'active');

    this.sendTo(call.pilotConnectionId, { type: 'call:established', payload: call });
    this.sendTo(meta.connectionId, { type: 'call:established', payload: call });

    this.ctx.storage.put(`call:${call.id}`, call);
  }

  private handleCallReject(ws: WebSocket, data: { callId: string }): void {
    const call = this.calls.findById(data.callId);
    if (!call) return;

    this.calls.end(data.callId);
    this.ctx.storage.delete(`call:${data.callId}`);

    const controller = this.controllers.findById(call.controllerId);
    if (controller) {
      this.controllers.updateStatus(controller.id, 'online');
      this.updateControllerAttachmentStatus(controller.connectionId, 'online');
      this.broadcast({ type: 'controller:updated', payload: controller });
    }
    this.sendTo(call.pilotConnectionId, { type: 'call:ended', payload: { callId: data.callId, reason: 'Call rejected' } });
  }

  private handleCallHangup(data: { callId: string }): void {
    const call = this.calls.findById(data.callId);
    if (!call) return;

    this.calls.end(data.callId);
    this.ctx.storage.delete(`call:${data.callId}`);

    const controller = this.controllers.findById(call.controllerId);
    if (controller) {
      this.controllers.updateStatus(controller.id, 'online');
      this.updateControllerAttachmentStatus(controller.connectionId, 'online');
      this.broadcast({ type: 'controller:updated', payload: controller });
    }
    this.sendTo(call.pilotConnectionId, { type: 'call:ended', payload: { callId: data.callId } });
    this.sendTo(call.controllerConnectionId, { type: 'call:ended', payload: { callId: data.callId } });
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
      this.broadcast({ type: 'controller:removed', payload: { controllerId: controller.id } });
      this.broadcast({ type: 'controllers:list', payload: this.controllers.getAll() });
    }

    const call = this.calls.findByPilot(meta.connectionId);
    if (call) {
      const ctrl = this.controllers.findById(call.controllerId);
      if (ctrl) {
        this.controllers.updateStatus(ctrl.id, 'online');
        this.updateControllerAttachmentStatus(ctrl.connectionId, 'online');
        this.broadcast({ type: 'controller:updated', payload: ctrl });
        this.sendTo(ctrl.connectionId, { type: 'call:ended', payload: { callId: call.id, reason: 'Pilot disconnected' } });
      }
      this.calls.end(call.id);
      this.ctx.storage.delete(`call:${call.id}`);
    }
  }

  /** Update the controller status in their WebSocket attachment for hibernation persistence */
  private updateControllerAttachmentStatus(connectionId: string, status: string): void {
    const sockets = this.ctx.getWebSockets(connectionId);
    for (const ws of sockets) {
      const m = ws.deserializeAttachment() as Record<string, unknown> | null;
      if (m && m.controllerId) {
        m.controllerStatus = status;
        ws.serializeAttachment(m);
      }
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
