import { useAuth } from "@/contexts/AuthContext";
import {
  useGetStudentDashboard,
  getGetStudentDashboardQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Link } from "expo-router";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from "react-native";
import { router } from "expo-router";

export default function StudentDashboardScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const {
    data: dashboard,
    isLoading,
    refetch,
    isRefetching,
  } = useGetStudentDashboard(user?.userId || 0, {
    query: {
      enabled: !!user?.userId,
      queryKey: getGetStudentDashboardQueryKey(user?.userId || 0),
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
        Hello, {user?.name}
      </Text>

      <View style={styles.statsGrid}>
        <Pressable
          onPress={() => router.push("/questions")}
          style={styles.statCard}
        >
          <Card style={styles.statCardInner}>
            <Feather name="help-circle" size={24} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {dashboard?.openQuestions || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Open Questions
            </Text>
          </Card>
        </Pressable>

        <Pressable
          onPress={() => router.push("/questions")}
          style={styles.statCard}
        >
          <Card style={styles.statCardInner}>
            <Feather name="clock" size={24} color={colors.accent} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {dashboard?.pendingBids || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Pending Bids
            </Text>
          </Card>
        </Pressable>

        <Pressable
          onPress={() => router.push("/sessions")}
          style={styles.statCard}
        >
          <Card style={styles.statCardInner}>
            <Feather name="calendar" size={24} color={colors.success} />
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {dashboard?.scheduledSessions || 0}
            </Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
              Upcoming Sessions
            </Text>
          </Card>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Recent Questions
      </Text>
      {dashboard?.recentQuestions?.length === 0 ? (
        <Text style={{ color: colors.mutedForeground }}>
          No recent questions.
        </Text>
      ) : (
        dashboard?.recentQuestions?.map((q) => (
          <Link key={q.questionId} href={`/question/${q.questionId}`} asChild>
            <Card style={styles.itemCard}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                {q.title}
              </Text>
              <Text style={{ color: colors.mutedForeground }}>
                {q.subject} • {q.status}
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
  },
  statCardInner: {
    padding: 16,
    gap: 8,
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
