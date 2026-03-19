import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { VatsimUser } from '@fssphone/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Extend Socket.IO's SocketData to carry the authenticated user
declare module 'socket.io' {
  interface SocketData {
    user: VatsimUser;
  }
}

export function socketAuth(socket: Socket, next: (err?: Error) => void): void {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const user = jwt.verify(token, JWT_SECRET) as VatsimUser;
    socket.data.user = user;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
}
