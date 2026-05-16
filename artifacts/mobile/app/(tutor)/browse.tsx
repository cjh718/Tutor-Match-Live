import { useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  useGetQuestions,
  getGetQuestionsQueryKey,
  useGetBids,
  getGetBidsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback } from "react";

export default function TutorBrowseScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");

  // Fetch ALL questions
  const {
    data: allQuestions,
    isLoading: questionsLoading,
    refetch: refetchQuestions,
    isRefetching: isRefetchingQuestions,
  } = useGetQuestions(
    {},
    { query: { queryKey: getGetQuestionsQueryKey({}) } },
  );

  // Fetch tutor's bids to check status
  const {
    data: myBids,
    isLoading: bidsLoading,
    refetch: refetchBids,
    isRefetching: isRefetchingBids,
  } = useGetBids(
    { tutorId: user?.userId },
    { query: { enabled: !!user?.userId, queryKey: getGetBidsQueryKey({ tutorId: user?.userId }) } },
  );

  const isLoading = questionsLoading || bidsLoading;
  const isRefetching = isRefetchingQuestions || isRefetchingBids;

  const refetch = () => {
    refetchQuestions();
    refetchBids();
  };

  // Auto-refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      refetchQuestions();
      refetchBids();
    }, [refetchQuestions, refetchBids])
  );

  // Create a map of questionId -> tutor's bid status
  const myBidStatusMap = new Map();
  myBids?.forEach((bid) => {
    myBidStatusMap.set(bid.questionId, bid.status);
  });

  // Show Open AND BidReceived questions that the tutor hasn't bid on
  const visibleQuestions = (allQuestions ?? []).filter((q) => {
    // Show both Open and BidReceived questions
    const status = q.status as any;
    if (status !== "Open" && status !== "BidReceived") return false;

    // Hide if tutor already has a Pending or Accepted bid on this question
    const myBidStatus = myBidStatusMap.get(q.questionId);
    if (myBidStatus === "Pending" || myBidStatus === "Accepted") return false;

    // Show if tutor has NO bid OR has a Rejected/Withdrawn bid (can bid again)
    return true;
  });

  const filtered = visibleQuestions
    .filter(
      (q) =>
        !search ||
        q.title.toLowerCase().includes(search.toLowerCase()) ||
        q.subject.toLowerCase().includes(search.toLowerCase()),
    )
    .sort(
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
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={100} style={{ marginBottom: 12 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            margin: 16,
            borderRadius: colors.radius,
          },
        ]}
      >
        <Feather name="search" size={16} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search by title or subject..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(q) => String(q.questionId)}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + 100 },
        ]}
        scrollEnabled={filtered.length > 0}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="book-open"
            title="No open questions"
            description="Check back later for new questions from students."
          />
        }
        renderItem={({ item: q }) => {
          const myBidStatus = myBidStatusMap.get(q.questionId);
          return (
            <Pressable onPress={() => router.push(`/question/${q.questionId}`)}>
              <Card style={styles.card}>
                <View style={styles.subjectRow}>
                  <View
                    style={[
                      styles.subjectPill,
                      { backgroundColor: colors.secondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectText,
                        { color: colors.secondaryForeground },
                      ]}
                    >
                      {q.subject}
                    </Text>
                  </View>
                  <Text style={[styles.bids, { color: colors.mutedForeground }]}>
                    {q.bidCount} bid{q.bidCount !== 1 ? "s" : ""}
                  </Text>
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  {q.title}
                </Text>
                <Text
                  style={[styles.description, { color: colors.mutedForeground }]}
                  numberOfLines={2}
                >
                  {q.description}
                </Text>
                <View style={styles.footer}>
                  {q.optionalBudget != null && (
                    <View style={styles.metaItem}>
                      <Feather
                        name="dollar-sign"
                        size={13}
                        color={colors.accent}
                      />
                      <Text style={[styles.metaText, { color: colors.accent }]}>
                        Budget: SGD {q.optionalBudget.toFixed(0)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.metaItem}>
                    <Feather
                      name="user"
                      size={13}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[styles.metaText, { color: colors.mutedForeground }]}
                    >
                      {q.student?.name ?? "Student"}
                    </Text>
                  </View>
                  {myBidStatus === "Accepted" && (
                    <View style={styles.acceptedBadge}>
                      <Text style={styles.acceptedText}>✓ Accepted</Text>
                    </View>
                  )}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15 },
  list: { paddingHorizontal: 16 },
  card: { padding: 16, marginBottom: 12 },
  subjectRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subjectPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  subjectText: { fontSize: 12, fontWeight: "600" },
  bids: { fontSize: 12 },
  title: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  footer: { flexDirection: "row", gap: 14, flexWrap: "wrap", alignItems: "center" },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  acceptedBadge: {
    backgroundColor: "#22c55e",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  acceptedText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
});