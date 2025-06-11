import { useNotificationListener } from '@/hooks/useNotificationListener';

interface NotificationManagerProps {
  children: React.ReactNode;
}

/**
 * Component that handles notification listening in the background.
 * This should be placed high in the component tree to ensure notifications
 * are monitored throughout the app lifecycle.
 */
export function NotificationManager({ children }: NotificationManagerProps) {
  useNotificationListener();
  return <>{children}</>;
}