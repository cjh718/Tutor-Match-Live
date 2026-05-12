import { FlatList, StyleSheet, Text, View, RefreshControl, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useGetNotifications, getGetNotificationsQueryKey, useMarkAllNotificationsRead } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

function getIcon(type: string): { name: keyof typeof Feather.glyphMap; color: string } {
  const colors = {
    new_bid: { name: 'tag' as const, color: '#3b5bdb' },
    bid_accepted: { name: 'check-circle' as const, color: '#22c55e' },
    session_proposed: { name: 'calendar' as const, color: '#f59e0b' },
    time_countered: { name: 'refresh-cw' as const, color: '#f59e0b' },
    session_confirmed: { name: 'check' as const, color: '#22c55e' },
    meeting_link_added: { name: 'video' as const, color: '#3b5bdb' },
    session_reminder: { name: 'bell' as const, color: '#ef4444' },
  };
  return colors[type as keyof typeof colors] ?? { name: 'bell', color: '#64748b' };
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch, isRefetching } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey() }
  });
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAll = async () => {
    try {
      await markAllRead.mutateAsync(undefined);
      await queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
    } catch {}
  };

  const unreadCount = notifications?.filter(n => !n.read).length ?? 0;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20, paddingTop: insets.top + 20 }]}>
        {[1,2,3,4].map(i => <Skeleton key={i} height={72} style={{ marginBottom: 8 }} />)}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Notifications</Text>
        {unreadCount > 0 && (
          <Pressable onPress={handleMarkAll}>
            <Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={notifications ?? []}
        keyExtractor={n => String(n.notificationId)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={(notifications?.length ?? 0) > 0}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="bell" title="No notifications" description="You'll see updates here when tutors bid, sessions are confirmed, and more." />
        }
        renderItem={({ item: n }) => {
          const icon = getIcon(n.type);
          return (
            <View style={[styles.item, { backgroundColor: n.read ? colors.background : colors.secondary, borderBottomColor: colors.border }]}>
              <View style={[styles.iconBadge, { backgroundColor: icon.color + '20' }]}>
                <Feather name={icon.name} size={18} color={icon.color} />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>{n.title}</Text>
                <Text style={[styles.itemMessage, { color: colors.mutedForeground }]}>{n.message}</Text>
                <Text style={[styles.itemTime, { color: colors.mutedForeground }]}>{timeAgo(n.createdDate)}</Text>
              </View>
              {!n.read && <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  heading: { fontSize: 22, fontWeight: '700' },
  markAll: { fontSize: 14, fontWeight: '500' },
  list: { paddingTop: 0 },
  item: { flexDirection: 'row', alignItems: 'flex-start', padding: 16, gap: 12, borderBottomWidth: 1 },
  iconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  itemMessage: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  itemTime: { fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },
});
