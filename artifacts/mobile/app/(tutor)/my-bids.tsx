import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  RefreshControl,
} from "react-native";
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
import { router, useFocusEffect, Stack } from "expo-router";

function getStatusLabel(status: string) {
  switch (status) {
    case "Open": return "Open";
    case "BidReceived": return "Bidded";
    case "Scheduled": return "Session Scheduled";
    case "Completed": return "Completed";
    case "Cancelled": return "Cancelled";
    default: return status;
  }
}

function formatSGT(dateStr: string | Date | null | undefined) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function BidTimingInfo({ bid }: { bid: any }) {
  const colors = useColors();
  const now = new Date();
  const expiry = bid.windowExpiresAt ? new Date(bid.windowExpiresAt) : null;
  const nowValid = bid.offerNow && expiry && expiry > now;
  const minutesLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 60000))
    : 0;

  if (!bid.offerNow && !bid.specificTime) return null;

  return (
    <View style={{ gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
      {bid.offerNow && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather
            name="zap"
            size={13}
            color={nowValid ? "#22c55e" : colors.mutedForeground}
          />
          <Text style={{ fontSize: 12, color: nowValid ? "#22c55e" : colors.mutedForeground }}>
            {nowValid ? `NOW (${minutesLeft}m left)` : "NOW (expired)"}
          </Text>
        </View>
      )}
      {bid.specificTime && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Feather name="calendar" size={13} color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.foreground }}>
            {formatSGT(bid.specificTime)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TutorMyBidsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  <Stack.Screen options={{ title: "My Active Bids" }} />;

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

  const questionMap = new Map();
  allQuestions?.forEach((q) => {
    questionMap.set(q.questionId, q);
  });

  const bidRows: {
    bid: NonNullable<typeof myBids>[number];
    question: NonNullable<typeof allQuestions>[number];
  }[] = (myBids ?? [])
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
                <Badge
                  label={getStatusLabel(item.question.status)}
                  variant="blue"
                />
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
              <BidTimingInfo bid={item.bid} />
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
