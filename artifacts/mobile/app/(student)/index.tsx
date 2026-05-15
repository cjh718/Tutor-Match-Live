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
  useGetStudentDashboard,
  getGetStudentDashboardQueryKey,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Link, router } from "expo-router";

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

      {/* 2x2 Grid Layout */}
      <View style={styles.statsGrid}>
        {/* Row 1 */}
        <View style={styles.row}>
          {/* Open Questions Card */}
          <Pressable
            onPress={() => router.push("/(student)/questions")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="help-circle" size={24} color={colors.primary} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.openQuestions || 0}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.mutedForeground }]}
              >
                Open Questions
              </Text>
            </Card>
          </Pressable>

          {/* Pending Bids Card */}
          <Pressable
            onPress={() => router.push("/(student)/questions")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="clock" size={24} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.pendingBids || 0}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.mutedForeground }]}
              >
                Pending Bids
              </Text>
            </Card>
          </Pressable>
        </View>

        {/* Row 2 */}
        <View style={styles.row}>
          {/* Upcoming Sessions Card */}
          <Pressable
            onPress={() => router.push("/(student)/sessions")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather name="calendar" size={24} color={colors.success} />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.scheduledSessions || 0}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.mutedForeground }]}
              >
                Upcoming Sessions
              </Text>
            </Card>
          </Pressable>

          {/* Pending Confirmation Card */}
          <Pressable
            onPress={() => router.push("/(student)/sessions?status=pending")}
            style={styles.halfCard}
          >
            <Card style={styles.statCard}>
              <Feather
                name="loader"
                size={24}
                color={colors.warning || "#f59e0b"}
              />
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {dashboard?.pendingConfirmation || 0}
              </Text>
              <Text
                style={[styles.statLabel, { color: colors.mutedForeground }]}
              >
                Pending Confirmation
              </Text>
            </Card>
          </Pressable>
        </View>
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
          <Pressable 
            key={q.questionId}
            onPress={() => {
              console.log("=== NAVIGATION DEBUG ===");
              console.log("Question ID:", q.questionId);
              console.log("Question Title:", q.title);
              console.log("Navigating to:", `/question/${q.questionId}`);
              router.push(`/question/${q.questionId}`);
            }}
          >
            <Card style={styles.itemCard}>
              <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                {q.title}
              </Text>
              <Text style={{ color: colors.mutedForeground }}>
                {q.subject} • {q.status}
              </Text>
            </Card>
          </Pressable>
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
    marginBottom: 32,
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
