import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

let socketInstance = null;

/**
 * useSocket — Manage Socket.io connection lifecycle
 * Call once at app level. Returns the socket instance and connection status.
 */
export function useSocket(user) {
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      // Disconnect if user logs out
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setConnected(false);
      }
      return;
    }

    // Only create one socket instance
    if (!socketInstance) {
      socketInstance = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      socketInstance.on('connect', () => {
        setConnected(true);
        console.log('[Socket] Connected:', socketInstance.id);
      });

      socketInstance.on('disconnect', () => {
        setConnected(false);
        console.log('[Socket] Disconnected');
      });

      socketInstance.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
      });
    }

    // Join user-specific rooms
    socketInstance.emit('join:user', user.id);

    if (user.role === 'PATIENT') {
      socketInstance.emit('join:patient', user.id);
    } else if (user.role === 'DONOR') {
      socketInstance.emit('join:donor', user.id);
    } else if (user.role === 'PHARMACIST') {
      // Pharmacists join their center room for donation alerts tied to that center,
      // plus their user room for direct notifications.
      if (user.centerId) {
        socketInstance.emit('join:pharmacist', user.centerId);
      }
    }

    socketRef.current = socketInstance;

    return () => {
      // Don't disconnect on unmount — only on logout
    };
  }, [user?.id]);

  const on = useCallback((event, handler) => {
    if (socketInstance) {
      socketInstance.on(event, handler);
      return () => socketInstance.off(event, handler);
    }
    return () => {};
  }, []);

  const emit = useCallback((event, data) => {
    if (socketInstance) {
      socketInstance.emit(event, data);
    }
  }, []);

  return { socket: socketInstance, connected, on, emit };
}

export function getSocket() {
  return socketInstance;
}
