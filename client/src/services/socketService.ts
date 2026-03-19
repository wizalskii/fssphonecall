import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@fssphone/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

class SocketService {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  connect(token: string): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (this.socket) {
      // If already connected with a different token, reconnect
      if ((this.socket.auth as { token?: string }).token !== token) {
        this.disconnect();
      } else {
        return this.socket;
      }
    }

    this.socket = io(SERVER_URL, {
      auth: { token },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('error', (message: string) => {
      console.error('Socket error:', message);
    });

    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }
}

export default new SocketService();
