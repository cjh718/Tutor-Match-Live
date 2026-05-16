import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetBids,
  getGetBidsQueryKey,
  useGetQuestions,
  getGetQuestionsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback } from "react";

export default function TutorMyBidsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    data: myBids,
    isLoading: bidsLoading,
    refetch: refetchBids,
    isRefetching: isRefetchingBids,
  } = useGetBids(
    { tutorId: user?.userId, status: "Pending" },
    {
      query: {
        enabled: !!user?.userId,
        queryKey: getGetBidsQueryKey({ tutorId: user?.userId, status: "Pending" }),
      },
    },
  );

  const {
    data: allQuestions,
    isLoading: questionsLoading,
    refetch: refetchQuestions,
    isRefetching: isRefetchingQuestions,
  } = useGetQuestions(
    {},
    { query: { queryKey: getGetQuestionsQueryKey({}) } },
  );

  const isLoading = bidsLoading || questionsLoading;
  const isRefetching = isRefetchingBids || isRefetchingQuestions;

  const refetch = () => {
    refetchBids();
    refetchQuestions();
  };

  useFocusEffect(
    useCallback(() => {
      refetchBids();
      refetchQuestions();
    }, [refetchBids, refetchQuestions]),
  );

  // Build a map of questionId -> question for fast lookup
  const questionMap = new Map();
  allQuestions?.forEach((q) => {
    questionMap.set(q.questionId, q);
  });

  // Join bids with their questions
  const bidRows: { bid: NonNullable<typeof myBids>[number]; question: NonNullable<typeof allQuestions>[number] }[] = (myBids ?? [])
    .map((bid) => {
      const question = questionMap.get(bid.questionId);
      if (!question) return null;
      return { bid, question };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const sorted = [...bidRows].sort(
    (a, b) =>
      new Date(b.bid.createdDate).getTime() -
      new Date(a.bid.createdDate).getTime(),
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
          <Skeleton key={i} height={100} style={{ marginBottom: 12 }} />
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => String(item.bid.bidId)}
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
            icon="file-text"
            title="Open Bids"
            description="You haven't placed any bids yet. Browse questions to start bidding."
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/question/${item.question.questionId}`)
            }
          >
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.question.title}
                </Text>
                <Badge label={item.question.status} variant="blue" />
              </View>
              <Text
                style={[styles.metaText, { color: colors.mutedForeground }]}
              >
                {item.question.subject}
              </Text>
              <View style={styles.priceRow}>
                <Feather name="dollar-sign" size={13} color={colors.primary} />
                <Text style={[styles.price, { color: colors.primary }]}>
                  SGD {item.bid.price}
                </Text>
              </View>
              <Text
                style={[styles.message, { color: colors.mutedForeground }]}
                numberOfLines={2}
              >
                {item.bid.message}
              </Text>
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
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  metaText: { fontSize: 13, marginBottom: 4 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  price: { fontSize: 14, fontWeight: "700" },
  message: { fontSize: 13, lineHeight: 18 },
});
