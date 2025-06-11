import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import type { Notification } from '@/lib/notificationTypes';

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

const MAX_NOTIFICATIONS = 50;
const STORAGE_KEY = 'plektos-notifications';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load notifications from storage:', error);
    }
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    try {
      console.log('Saving notifications to localStorage:', notifications);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
      console.log('Successfully saved to localStorage');
    } catch (error) {
      console.error('Failed to save notifications to storage:', error);
    }
  }, [notifications]);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => {
      // Check if notification already exists (prevent duplicates)
      const exists = prev.some(n => 
        n.id === notification.id || 
        (n.type === notification.type && 
         n.eventId === notification.eventId && 
         n.fromPubkey === notification.fromPubkey &&
         Math.abs(n.timestamp - notification.timestamp) < 60000) // Within 1 minute
      );
      
      if (exists) {
        return prev;
      }

      // Add new notification and sort by timestamp (newest first)
      const updated = [notification, ...prev]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_NOTIFICATIONS); // Keep only the most recent notifications
      
      return updated;
    });
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    console.log('Marking notification as read:', notificationId);
    setNotifications(prev => {
      const updated = prev.map(n => n.id === notificationId ? { ...n, read: true } : n);
      console.log('Updated notifications:', updated);
      return updated;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    console.log('Marking all notifications as read');
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      console.log('All notifications marked as read:', updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const value: NotificationContextValue = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}