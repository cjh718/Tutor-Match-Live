import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useGetQuestions, getGetQuestionsQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback } from 'react';

function statusVariant(status: string) {
  if (status === 'Open') return 'outline';
  if (status === 'BidReceived') return 'warning';
  if (status === 'Matched') return 'success';
  if (status === 'PendingConfirmation') return 'warning';
  if (status === 'Scheduled') return 'success';
  if (status === 'Completed') return 'outline';
  return 'destructive';
}

function getStatusLabel(status: string) {
  switch(status) {
    case "Open":
      return "Open";
    case "BidReceived":
      return "Bid Received";
    case "Matched":
      return "Awaiting Schedule";
    case "PendingConfirmation":
      return "Pending Tutor Acceptance";
    case "Scheduled":
      return "Session Scheduled";
    case "Completed":
      return "Completed";
    case "Cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export default function StudentQuestionsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { status, filter } = useLocalSearchParams<{ status?: string; filter?: string }>();

  // For "bids received" view, fetch all questions and filter client-side
  // since API only supports exact status match
  const isBidsReceivedView = filter === 'bids-received';

  // Type assertion needed because generated types don't include all statuses
  const queryParams = status && !isBidsReceivedView
    ? { studentId: user?.userId, status: status as any }
    : { studentId: user?.userId };

  const { data: allQuestions, isLoading, refetch, isRefetching } = useGetQuestions(
    queryParams,
    { query: { enabled: !!user?.userId, queryKey: getGetQuestionsQueryKey(queryParams) } }
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Apply client-side filtering for "bids received" view
  const filtered = isBidsReceivedView
    ? (allQuestions ?? []).filter(q => (q.status as any) === 'BidReceived' || q.status === 'Matched')
    : (allQuestions ?? []);

  const sorted = [...filtered].sort((a, b) =>
    new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

  const getTitle = () => {
    if (status === 'Open') return 'Open Questions';
    if (isBidsReceivedView) return 'Bids Received';
    if (status === 'BidReceived') return 'Bids Received';
    return 'My Questions';
  };

  const getEmptyDescription = () => {
    if (status === 'Open') return 'No open questions. Post a new question to get help.';
    if (isBidsReceivedView) return 'No bids received yet. Tutors will bid soon!';
    if (status === 'BidReceived') return 'No bids received yet. Tutors will bid soon!';
    return 'No questions posted yet.';
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
        keyExtractor={q => String(q.questionId)}
        contentContainerStyle={[styles.list, { paddingTop: 16, paddingBottom: insets.bottom + 100 }]}
        scrollEnabled={sorted.length > 0}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="help-circle" title={getTitle()} description={getEmptyDescription()} />
        }
        renderItem={({ item: q }) => (
          <Pressable onPress={() => router.push(`/question/${q.questionId}`)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
                  {q.title}
                </Text>
                <Badge label={getStatusLabel(q.status)} variant={statusVariant(q.status)} />
              </View>
              <View style={styles.metaRow}>
                <Feather name="book" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{q.subject}</Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="message-circle" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {q.bidCount ?? 0} bids
                </Text>
              </View>
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
