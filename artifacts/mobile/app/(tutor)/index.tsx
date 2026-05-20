import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetTutorDashboard,
  getGetTutorDashboardQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Link, router, useFocusEffect } from "expo-router";
import { useCallback } from "react";

export default function TutorDashboardScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    data: dashboard,
    isLoading,
    refetch,
    isRefetching,
  } = useGetTutorDashboard(user?.userId || 0, {
    query: {
      enabled: !!user?.userId,
      queryKey: getGetTutorDashboardQueryKey(user?.userId || 0),
    },
  });

  // Auto-refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
      >
        <View style={styles.content}>
          <Skeleton height={100} style={{ marginBottom: 16 }} />
          <Skeleton height={100} style={{ marginBottom: 16 }} />
          <Skeleton height={100} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 100 },
      ]}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <Text style={[styles.greeting, { color: colors.foreground }]}>
        Welcome, {user?.name}
      </Text>

      {/* 2x2 Grid Layout */}
      <View style={styles.statsGrid}>
        {/* Row 1 */}
        <View style={styles.row}>
          {/* Open Bids Card */}
          <Pressable
            onPress={() => router.push("/(tutor)/my-bids")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="file-text" size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.openBids || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Open Bids{'\n'}(Bids you've placed)
              </Text>
              
            </Card>
          </Pressable>

          {/* Accepted Bids Card */}
          <Pressable
            onPress={() => router.push("/(tutor)/accepted-bids")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="check" size={24} color={colors.warning} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.acceptedBids || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Accepted Bids{'\n'}(Accepted by students)
              </Text>
            </Card>
          </Pressable>
        </View>

        {/* Row 2 */}
        <View style={styles.row}>
          {/* Upcoming Sessions Card */}
          <Pressable
            onPress={() => router.push("/(tutor)/sessions?filter=upcoming")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="calendar" size={24} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.upcomingSessions || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Upcoming Sessions{'\n'}(Scheduled Session)
              </Text>
            </Card>
          </Pressable>

          {/* Total Completed Card */}
          <Pressable
            onPress={() => router.push("/(tutor)/completed")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="check-circle" size={24} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.completedSessions || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                Completed{'\n'}(Finished sessions)
              </Text>
            </Card>
          </Pressable>
        </View>
      </View>

      {/* Earned Section */}
      <View style={styles.earnedContainer}>
        <Card style={styles.earnedCard}>
          <Feather name="dollar-sign" size={24} color={colors.accent} />
          <Text style={[styles.earnedValue, { color: colors.accent }]}>
            SGD {dashboard?.totalEarned || 0}
          </Text>
          <Text style={[styles.earnedLabel, { color: colors.mutedForeground }]}>
            Total Earned
          </Text>
        </Card>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Recent Bids
      </Text>
      {dashboard?.recentBids?.length === 0 ? (
        <Text style={{ color: colors.mutedForeground }}>No recent bids.</Text>
      ) : (
        dashboard?.recentBids?.map((bid) => (
          <Link key={bid.bidId} href={`/question/${bid.questionId}`} asChild>
            <Card style={styles.itemCard}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                SGD {bid.price} - {bid.status}
              </Text>
              <Text style={{ color: colors.mutedForeground }}>
                {bid.message}
              </Text>
            </Card>
          </Link>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 24,
  },
  statsGrid: {
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  halfCard: {
    flex: 1,
  },
  statCard: {
    padding: 16,
    gap: 8,
    minHeight: 130,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 14,
  },
  earnedContainer: {
    marginBottom: 24,
  },
  earnedCard: {
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  earnedValue: {
    fontSize: 32,
    fontWeight: "700",
  },
  earnedLabel: {
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
  },
  itemCard: {
    padding: 16,
    marginBottom: 12,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
});