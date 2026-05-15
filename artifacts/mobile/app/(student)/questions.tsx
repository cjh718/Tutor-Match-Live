import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetQuestions,
  getGetQuestionsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function statusVariant(status: string) {
  if (status === "Open") return "blue";
  if (status === "Matched") return "warning";
  if (status === "Scheduled") return "success";
  if (status === "Completed") return "outline";
  return "destructive";
}

export default function StudentQuestionsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    data: questions,
    isLoading,
    refetch,
    isRefetching,
  } = useGetQuestions(
    { studentId: user?.userId },
    {
      query: {
        enabled: !!user?.userId,
        queryKey: getGetQuestionsQueryKey({ studentId: user?.userId }),
      },
    },
  );

  const sorted = [...(questions ?? [])].sort(
    (a, b) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, padding: 20 },
        ]}
      >
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} height={88} style={{ marginBottom: 12 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={(q) => String(q.questionId)}
        contentContainerStyle={[
          styles.list,
          { paddingTop: 16, paddingBottom: insets.bottom + 100 },
        ]}
        scrollEnabled={sorted.length > 0}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="inbox"
            title="No questions yet"
            description="Post your first question to get matched with a tutor."
          />
        }
        renderItem={({ item: q }) => (
          <Pressable onPress={() => router.push(`/question/${q.questionId}`)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {q.title}
                </Text>
                <Badge 
                  label={q.status === "BidReceived" ? "Bid Received" : q.status} 
                  variant={statusVariant(q.status)} 
                />
              </View>
              <Text style={[styles.subject, { color: colors.mutedForeground }]}>
                {q.subject}
              </Text>
              <View style={styles.meta}>
                <View style={styles.metaItem}>
                  <Feather
                    name="tag"
                    size={13}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[styles.metaText, { color: colors.mutedForeground }]}
                  >
                    {q.bidCount} bid{q.bidCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.metaItem}>
                  <Feather
                    name="clock"
                    size={13}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[styles.metaText, { color: colors.mutedForeground }]}
                  >
                    {q.preferredDuration} min
                  </Text>
                </View>
                {q.optionalBudget != null && (
                  <View style={styles.metaItem}>
                    <Feather
                      name="dollar-sign"
                      size={13}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.metaText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      SGD {q.optionalBudget.toFixed(0)}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </Pressable>
        )}
      />
      <Pressable
        style={[
          styles.fab,
          { backgroundColor: colors.primary, bottom: insets.bottom + 30 },
        ]}
        onPress={() => router.push("/post-question")}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingHorizontal: 16 },
  card: { padding: 16, marginBottom: 12 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  title: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  subject: { fontSize: 13, marginBottom: 10 },
  meta: { flexDirection: "row", gap: 14 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
