// ============================================
// EXAMPLE: NOTIFICATION BELL
// Demonstrates Real-time SSE Pattern
// ============================================

'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '@/lib/realtime/hooks';
import { useClickOutside, useKeyboardShortcut } from '@/lib/utils/hooks';
import { formatRelativeTime, cn } from '@/lib/utils';

// ============================================
// NOTIFICATION BELL COMPONENT
// ============================================

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useClickOutside<HTMLDivElement>(() => setIsOpen(false));
  
  const {
    notifications,
    unreadCount,
    isConnected,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  } = useNotifications(userId);

  // Keyboard shortcut to toggle
  useKeyboardShortcut('n', () => setIsOpen(prev => !prev), { alt: true });

  const typeStyles = {
    info: 'bg-blue-100 text-blue-600',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-yellow-100 text-yellow-600',
    error: 'bg-red-100 text-red-600',
  };

  const typeIcons = {
    info: '💬',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        aria-label="Bildirimler"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        
        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
        
        {/* Connection indicator */}
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white',
            isConnected ? 'bg-green-500' : 'bg-gray-400'
          )}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gray-50">
            <h3 className="font-semibold text-gray-900">Bildirimler</h3>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Tümünü okundu işaretle
                </button>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-3 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
                <p>Henüz bildiriminiz yok</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'p-4 border-b last:border-b-0 cursor-pointer transition-colors',
                    notification.read ? 'bg-white' : 'bg-blue-50'
                  )}
                  onClick={() => {
                    markAsRead(notification.id);
                    if (notification.actionUrl) {
                      window.location.href = notification.actionUrl;
                    }
                  }}
                >
                  <div className="flex gap-3">
                    <span
                      className={cn(
                        'flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-sm',
                        typeStyles[notification.type]
                      )}
                    >
                      {typeIcons[notification.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">
                        {notification.title}
                      </p>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatRelativeTime(notification.timestamp)}
                      </p>
                    </div>
                    {!notification.read && (
                      <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t bg-gray-50 flex justify-between">
              <button
                onClick={clearNotifications}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Tümünü temizle
              </button>
              <a
                href="/notifications"
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Tümünü gör →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// NOTIFICATION TOAST
// ============================================

interface ToastProps {
  notification: {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body?: string;
  };
  onClose: () => void;
}

export function NotificationToast({ notification, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
  };

  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-lg shadow-lg border max-w-sm animate-slide-in">
      <span className={cn('w-2 h-2 rounded-full mt-2', colors[notification.type])} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{notification.title}</p>
        {notification.body && (
          <p className="text-sm text-gray-600 mt-0.5">{notification.body}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-600"
      >
        ✕
      </button>
    </div>
  );
}
