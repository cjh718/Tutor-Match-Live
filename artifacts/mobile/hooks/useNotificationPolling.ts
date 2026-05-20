import { useEffect, useRef, useCallback } from 'react';
import { Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { getNotifications, getGetNotificationsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';

const POLL_INTERVAL_MS = 15_000;

export function useNotificationPolling() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastSeenIdRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const poll = useCallback(async () => {
    if (!user) return;
    try {
      const notifications = await getNotifications();
      if (!notifications || notifications.length === 0) return;

      const latestId = notifications[0].notificationId;

      if (!initializedRef.current) {
        lastSeenIdRef.current = latestId;
        initializedRef.current = true;
        return;
      }

      if (lastSeenIdRef.current === null || latestId <= lastSeenIdRef.current) return;

      const newNotifs = notifications.filter(
        n => n.notificationId > lastSeenIdRef.current!
      );

      lastSeenIdRef.current = latestId;

      await queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });

      if (newNotifs.length === 1) {
        Alert.alert(newNotifs[0].title, newNotifs[0].message);
      } else if (newNotifs.length > 1) {
        Alert.alert(
          `${newNotifs.length} new notifications`,
          newNotifs.map(n => `• ${n.title}`).join('\n')
        );
      }
    } catch {
      // silently ignore network errors during polling
    }
  }, [user, queryClient]);

  useEffect(() => {
    if (!user) return;

    initializedRef.current = false;
    lastSeenIdRef.current = null;

    poll();

    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, poll]);
}
