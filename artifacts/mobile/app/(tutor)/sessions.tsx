import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useGetSessions, getGetSessionsQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback } from 'react';

function statusVariant(status: string) {
  if (status === 'Confirmed' || status === 'Scheduled') return 'success';
  if (status === 'PendingConfirmation') return 'warning';
  if (status === 'Completed') return 'outline';
  return 'destructive';
}

function formatSGT(dateStr: string | null | undefined) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' });
}

function getSessionStatusLabel(status: string) {
  switch(status) {
    case "PendingConfirmation":
      return "Pending Confirmation";
    case "Confirmed":
      return "Confirmed";
    case "Scheduled":
      return "Scheduled";
    case "Completed":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export default function TutorSessionsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { status, filter } = useLocalSearchParams<{ status?: string; filter?: string }>();

  const isUpcomingView = filter === 'upcoming';

  const queryParams = status && !isUpcomingView
    ? { tutorId: user?.userId, status: status as any }
    : { tutorId: user?.userId };

  const { data: allSessions, isLoading, refetch, isRefetching } = useGetSessions(
    queryParams,
    { query: { enabled: !!user?.userId, queryKey: getGetSessionsQueryKey(queryParams) } }
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Apply client-side filtering for "upcoming" view
  const filtered = isUpcomingView
    ? (allSessions ?? []).filter(s => 
        s.status === 'Confirmed'
      )
    : (allSessions ?? []);

  const sorted = [...filtered].sort((a, b) => {
    const ta = a.finalTime ?? a.proposedTime;
    const tb = b.finalTime ?? b.proposedTime;
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  const getTitle = () => {
    if (isUpcomingView) return 'Upcoming Sessions';
    if (status === 'PendingConfirmation') return 'Pending Confirmation';
    if (status === 'Scheduled') return 'Upcoming Sessions';
    return 'My Sessions';
  };

  const getEmptyDescription = () => {
    if (isUpcomingView) return 'No upcoming sessions scheduled.';
    if (status === 'PendingConfirmation') return 'No sessions waiting for your confirmation.';
    if (status === 'Scheduled') return 'No upcoming sessions scheduled.';
    return 'No sessions found.';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={100} style={{ marginBottom: 12 }} />)}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={s => String(s.sessionId)}
        contentContainerStyle={[styles.list, { paddingTop: 16, paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={sorted.length > 0}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="calendar" title={getTitle()} description={getEmptyDescription()} />
        }
        renderItem={({ item: s }) => (
          <Pressable onPress={() => router.push(`/session/${s.sessionId}`)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                  {s.question?.title ?? 'Session'}
                </Text>
                <Badge label={getSessionStatusLabel(s.status)} variant={statusVariant(s.status)} />
              </View>
              <View style={styles.metaRow}>
                <Feather name="user" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {s.student?.name ?? 'Student'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatSGT(s.finalTime ?? s.proposedTime)}
                </Text>
              </View>
              {s.status === 'PendingConfirmation' && (
                <View style={styles.metaRow}>
                  <Feather name="alert-circle" size={13} color={colors.accent} />
                  <Text style={[styles.metaText, { color: colors.accent }]}>Action required</Text>
                </View>
              )}
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16 },
  card: { padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '600', flex: 1, marginRight: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  metaText: { fontSize: 13 },
});