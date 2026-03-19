import { useEffect, useState, useCallback } from 'react';
import type { ClientMessage } from '@fssphone/shared';
import { useAuth } from '../context/AuthContext';
import socketService from '../services/socketService';

export function useSocket() {
  const { token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      socketService.disconnect();
      setIsConnected(false);
      return;
    }

    socketService.connect(token);
    const unsub = socketService.onConnectionChange(setIsConnected);
    if (socketService.isConnected) setIsConnected(true);

    return unsub;
  }, [token]);

  const send = useCallback((msg: ClientMessage) => {
    socketService.send(msg);
  }, []);

  const on = useCallback((type: string, handler: (payload: unknown) => void) => {
    socketService.on(type, handler);
  }, []);

  const off = useCallback((type: string, handler?: (payload: unknown) => void) => {
    socketService.off(type, handler);
  }, []);

  return {
    isConnected,
    connectionId: socketService.connectionId,
    send,
    on,
    off,
  };
}
