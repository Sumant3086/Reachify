import { useState, useCallback } from 'react';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const success = useCallback((message: string) => showNotification(message, 'success'), [showNotification]);
  const error = useCallback((message: string) => showNotification(message, 'error'), [showNotification]);
  const info = useCallback((message: string) => showNotification(message, 'info'), [showNotification]);
  const warning = useCallback((message: string) => showNotification(message, 'warning'), [showNotification]);

  return {
    notifications,
    removeNotification,
    success,
    error,
    info,
    warning
  };
}
