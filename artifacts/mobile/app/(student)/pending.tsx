import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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

function formatSGT(dateStr: string | null | undefined) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function StudentUpcomingSessionsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const queryParams = { studentId: user?.userId, status: 'Matched' as const };

  const { data: sessions, isLoading, refetch, isRefetching } = useGetSessions(
    queryParams,
    { query: { enabled: !!user?.userId, queryKey: getGetSessionsQueryKey(queryParams) } },
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const sorted = [...(sessions ?? [])].sort((a, b) => {
    const ta = a.finalTime;
    const tb = b.finalTime;
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        {[1, 2, 3].map((i) => <Skeleton key={i} height={100} style={{ marginBottom: 12 }} />)}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={(s) => String(s.sessionId)}
        contentContainerStyle={[styles.list, { paddingTop: 16, paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={sorted.length > 0}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="Pending Tutor"
            description="Sessions waiting for tutor confirmation."
          />
        }
        renderItem={({ item: s }) => (
          <Pressable onPress={() => router.push(`/session/${s.sessionId}`)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                  {s.question?.title ?? 'Session'}
                </Text>
                <Badge label="Confirmed" variant="success" />
              </View>
              <View style={styles.metaRow}>
                <Feather name="user" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {s.tutor?.name ?? 'Tutor'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {formatSGT(s.finalTime)}
                </Text>
              </View>
              {s.meetingLink ? (
                <View style={styles.metaRow}>
                  <Feather name="video" size={13} color={colors.success} />
                  <Text style={[styles.metaText, { color: colors.success }]}>Meeting link available</Text>
                </View>
              ) : null}
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
