import { FlatList, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
  if (status === 'PendingConfirmation') return 'warning';
  if (status === 'Confirmed' || status === 'Scheduled') return 'success';
  if (status === 'Completed') return 'outline';
  return 'destructive';
}

function getStatusLabel(status: string) {
  switch(status) {
    case "PendingConfirmation":
      return "Pending Tutor Acceptance";
    case "Confirmed":
      return "Confirmed";
    case "Scheduled":
      return "Scheduled";
    case "Completed":
      return "Completed";
    default:
      return status;
  }
}

export default function StudentPendingScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Fetch questions with PendingConfirmation status
  const { data: questions, isLoading, refetch, isRefetching } = useGetQuestions(
    { studentId: user?.userId, status: "PendingConfirmation" },
    { query: { enabled: !!user?.userId, queryKey: getGetQuestionsQueryKey({ studentId: user?.userId, status: "PendingConfirmation" }) } }
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const sorted = [...(questions ?? [])].sort(
    (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

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
          <EmptyState icon="clock" title="Pending Tutors" description="No sessions waiting for tutor confirmation." />
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
                <Feather name="user" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {q.student?.name ?? 'Student'}
                </Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="book" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {q.subject}
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