import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetNotifications, getGetNotificationsQueryKey } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  color: string;
  size: number;
}

export function NotificationBellIcon({ color, size }: Props) {
  const { user } = useAuth();

  const { data: notifications } = useGetNotifications({
    query: {
      enabled: !!user,
      queryKey: getGetNotificationsQueryKey(),
      refetchInterval: 15000,
    },
  });

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  return (
    <View style={styles.container}>
      <Feather name="bell" size={size} color={color} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 12,
  },
});
