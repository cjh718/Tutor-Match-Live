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
  useGetSessions,
  getGetSessionsQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCallback } from "react";

function statusVariant(status: string) {
  if (status === "Matched") return "warning";
  if (status === "PendingConfirmation") return "warning";
  if (status === "Scheduled" || status === "Confirmed") return "success";
  if (status === "Completed") return "outline";
  return "destructive";
}

function getStatusLabel(status: string) {
  switch(status) {
    case "Open":
      return "Open";
    case "BidReceived":
      return "Bidded";
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

export default function TutorAcceptedBidsScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    data: myBids,
    isLoading: bidsLoading,
    refetch: refetchBids,
    isRefetching: isRefetchingBids,
  } = useGetBids(
    { tutorId: user?.userId, status: "Accepted" },
    {
      query: {
        enabled: !!user?.userId,
        queryKey: getGetBidsQueryKey({ tutorId: user?.userId, status: "Accepted" }),
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

  // Fetch sessions to get sessionId for each bid
  const {
    data: allSessions,
    isLoading: sessionsLoading,
  } = useGetSessions(
    { tutorId: user?.userId },
    { query: { enabled: !!user?.userId, queryKey: getGetSessionsQueryKey({ tutorId: user?.userId }) } },
  );

  const isLoading = bidsLoading || questionsLoading || sessionsLoading;
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

  // Build a map of questionId -> question
  const questionMap = new Map();
  allQuestions?.forEach((q) => {
    questionMap.set(q.questionId, q);
  });

  // Build a map of questionId -> session
  const sessionMap = new Map();
  allSessions?.forEach((s) => {
    sessionMap.set(s.questionId, s);
  });

  // Join bids with their questions and filter by question status
  const bidRows: { bid: NonNullable<typeof myBids>[number]; question: NonNullable<typeof allQuestions>[number]; session: any }[] = (myBids ?? [])
    .map((bid) => {
      const question = questionMap.get(bid.questionId);
      const session = sessionMap.get(bid.questionId);
      if (!question) return null;
      return { bid, question, session };
    })
    .filter((item): item is NonNullable<typeof item> => 
      item !== null && 
      (item.question.status === "Matched" || item.question.status === "PendingConfirmation")
    );

  const sorted = [...bidRows].sort(
    (a, b) =>
      new Date(b.bid.createdDate).getTime() -
      new Date(a.bid.createdDate).getTime(),
  );

  const handlePress = (item: typeof bidRows[0]) => {
    // If session exists, go to session page
    if (item.session) {
      router.push(`/session/${item.session.sessionId}`);
    } 
    // If question status is Matched (accepted, no session yet), go to question page to propose time
    else if (item.question.status === "Matched") {
      router.push(`/question/${item.question.questionId}`);
    }
    // Otherwise go to question page
    else {
      router.push(`/question/${item.question.questionId}`);
    }
  };

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
            icon="check"
            title="Accepted Bids"
            description="No accepted bids yet. Keep bidding on questions!"
          />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => handlePress(item)}>
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.question.title}
                </Text>
                <Badge label={getStatusLabel(item.question.status)} variant="warning" />
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
              {!item.session && item.question.status === "Matched" && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>Waiting for student to propose time</Text>
                </View>
              )}
              {item.session && item.session.status === "PendingConfirmation" && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>Click to confirm session time</Text>
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
  actionBadge: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  actionBadgeText: {
    fontSize: 11,
    color: "#d97706",
    fontWeight: "500",
  },
});