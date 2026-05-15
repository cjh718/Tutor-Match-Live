import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
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
import { Link } from "expo-router";

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

      <View style={styles.statsGrid}>
        <Card style={styles.statCard}>
          <Feather name="file-text" size={24} color={colors.primary} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {dashboard?.openBids || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Open Bids
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Feather name="calendar" size={24} color={colors.success} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {dashboard?.scheduledSessions || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Upcoming Sessions
          </Text>
        </Card>
        <Card style={styles.statCard}>
          <Feather name="dollar-sign" size={24} color={colors.accent} />
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            SGD {dashboard?.totalEarned || 0}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Earned
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
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: 16,
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
  },
  statLabel: {
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
