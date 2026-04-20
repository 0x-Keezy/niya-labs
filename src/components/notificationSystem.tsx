import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { clsx } from 'clsx';
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon, InformationCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'ai';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

interface NotificationContextType {
  notifications: Notification[];
  showNotification: (type: NotificationType, message: string, duration?: number) => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((type: NotificationType, message: string, duration = 4000) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setNotifications(prev => [...prev, { id, type, message, duration }]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, dismissNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismissNotification} />
    </NotificationContext.Provider>
  );
}

function NotificationContainer({ notifications, onDismiss }: { notifications: Notification[]; onDismiss: (id: string) => void }) {
  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm" data-testid="notification-container">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const icons: Record<NotificationType, typeof CheckCircleIcon> = {
    success: CheckCircleIcon,
    error: ExclamationTriangleIcon,
    warning: ExclamationTriangleIcon,
    info: InformationCircleIcon,
    ai: SparklesIcon
  };

  const colors: Record<NotificationType, string> = {
    success: 'bg-green-500/20 border-green-500/50 text-green-300',
    error: 'bg-red-500/20 border-red-500/50 text-red-300',
    warning: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
    info: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
    ai: 'bg-purple-500/20 border-purple-500/50 text-purple-300'
  };

  const Icon = icons[notification.type];

  return (
    <div
      className={clsx(
        "flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-xl",
        "animate-in slide-in-from-right duration-300",
        colors[notification.type]
      )}
      data-testid={`notification-${notification.type}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{notification.message}</p>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-white/50 hover:text-white transition-colors"
        data-testid="button-dismiss-notification"
      >
        <XMarkIcon className="w-4 h-4" />
      </button>
      <style jsx>{`
        @keyframes slide-in-from-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-in {
          animation: slide-in-from-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export function AIThinkingIndicator({ isThinking }: { isThinking: boolean }) {
  if (!isThinking) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40" data-testid="ai-thinking-indicator">
      <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 border border-purple-500/30 rounded-full backdrop-blur-xl">
        <SparklesIcon className="w-4 h-4 text-purple-400 animate-pulse" />
        <span className="text-purple-300 text-sm">AI is thinking...</span>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-purple-400"
              style={{
                animation: 'bounce 1s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`
              }}
            />
          ))}
        </div>
      </div>
      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}

export default NotificationProvider;
