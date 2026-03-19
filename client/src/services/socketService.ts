import type { ClientMessage, ServerMessage } from '@fssphone/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

type MessageHandler = (payload: unknown) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private token: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 500;
  private _connectionId: string | null = null;
  private _connected = false;
  private connectListeners = new Set<(connected: boolean) => void>();

  get connectionId(): string | null {
    return this._connectionId;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  connect(token: string): void {
    if (this.ws && this.token === token) return;
    this.token = token;
    this.doConnect();
  }

  private doConnect(): void {
    if (!this.token) return;
    this.cleanup();

    const wsUrl = SERVER_URL.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(this.token);
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this._connected = true;
      this.reconnectDelay = 500;
      this.notifyConnect(true);
    };

    this.ws.onmessage = (event) => {
      let msg: ServerMessage;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      if (msg.type === 'welcome') {
        this._connectionId = (msg.payload as { connectionId: string }).connectionId;
      }

      const handlers = this.listeners.get(msg.type);
      if (handlers) {
        for (const handler of handlers) {
          handler(msg.payload);
        }
      }
    };

    this.ws.onclose = () => {
      this._connected = false;
      this.notifyConnect(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after this
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.doConnect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 5000);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  disconnect(): void {
    this.token = null;
    this._connectionId = null;
    this._connected = false;
    this.reconnectDelay = 500;
    this.cleanup();
    this.notifyConnect(false);
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on(type: string, handler: MessageHandler): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  off(type: string, handler?: MessageHandler): void {
    if (handler) {
      this.listeners.get(type)?.delete(handler);
    } else {
      this.listeners.delete(type);
    }
  }

  onConnectionChange(handler: (connected: boolean) => void): () => void {
    this.connectListeners.add(handler);
    return () => this.connectListeners.delete(handler);
  }

  private notifyConnect(connected: boolean): void {
    for (const handler of this.connectListeners) {
      handler(connected);
    }
  }
}

export default new WebSocketService();
