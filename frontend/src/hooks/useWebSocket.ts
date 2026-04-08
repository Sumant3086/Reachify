import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || '';

export function useWebSocket(userId: string | null, onEmailUpdate: (data: any) => void) {
  const socketRef = useRef<Socket | null>(null);
  // Stable callback reference to prevent reconnections
  const callbackRef = useRef(onEmailUpdate);
  
  useEffect(() => {
    callbackRef.current = onEmailUpdate;
  }, [onEmailUpdate]);

  useEffect(() => {
    if (!userId) return;

    const socket = io(API_URL, {
      auth: { userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('emailUpdate', (data) => {
      callbackRef.current(data);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]); // Only reconnect when userId changes

  return socketRef.current;
}
