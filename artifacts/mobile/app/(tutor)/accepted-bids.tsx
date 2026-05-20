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

function formatSGT(dateStr: string | null | undefined) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
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
    data: allSessions,
    isLoading: sessionsLoading,
    refetch: refetchSessions,
    isRefetching: isRefetchingSessions,
  } = useGetSessions(
    { tutorId: user?.userId },
    {
      query: {
        enabled: !!user?.userId,
        queryKey: getGetSessionsQueryKey({ tutorId: user?.userId }),
      },
    },
  );

  const isLoading = bidsLoading || sessionsLoading;
  const isRefetching = isRefetchingBids || isRefetchingSessions;

  const refetch = () => {
    refetchBids();
    refetchSessions();
  };

  useFocusEffect(
    useCallback(() => {
      refetchBids();
      refetchSessions();
    }, [refetchBids, refetchSessions]),
  );

  // Build a map of questionId -> session
  const sessionMap = new Map();
  allSessions?.forEach((s) => {
    sessionMap.set(s.questionId, s);
  });

  // Join accepted bids with their sessions
  const bidRows = (myBids ?? [])
    .map((bid) => {
      const session = sessionMap.get(bid.questionId);
      return { bid, session: session ?? null };
    })
    .filter((item) => item.session !== null);

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
            icon="check"
            title="Accepted Bids"
            description="No accepted bids yet. Keep bidding on questions!"
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              item.session
                ? router.push(`/session/${item.session.sessionId}`)
                : router.push(`/question/${item.bid.questionId}`)
            }
          >
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {item.session?.question?.title ?? `Question #${item.bid.questionId}`}
                </Text>
                <Badge
                  label={item.session?.status ?? "Confirmed"}
                  variant={
                    item.session?.status === "Completed" ? "outline" : "success"
                  }
                />
              </View>
              {item.session?.student && (
                <View style={styles.metaRow}>
                  <Feather name="user" size={13} color={colors.mutedForeground} />
                  <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                    {item.session.student.name}
                  </Text>
                </View>
              )}
              <View style={styles.priceRow}>
                <Feather name="dollar-sign" size={13} color={colors.primary} />
                <Text style={[styles.price, { color: colors.primary }]}>
                  SGD {item.bid.price}
                </Text>
              </View>
              {item.session?.finalTime && (
                <View style={styles.metaRow}>
                  <Feather name="calendar" size={13} color={colors.success} />
                  <Text style={[styles.metaText, { color: colors.success }]}>
                    {formatSGT(item.session.finalTime)}
                  </Text>
                </View>
              )}
              {item.session?.meetingLink ? (
                <View style={styles.metaRow}>
                  <Feather name="video" size={13} color={colors.success} />
                  <Text style={[styles.metaText, { color: colors.success }]}>
                    Meeting link added
                  </Text>
                </View>
              ) : item.session?.status === "Confirmed" ? (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>Add a meeting link</Text>
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
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  actionBadge: {
    marginTop: 6,
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
