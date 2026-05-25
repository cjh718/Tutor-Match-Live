import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { customFetch } from "@workspace/api-client-react";

export default function WalletScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [wallet, setWallet] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [walletRes, withdrawalsRes] = await Promise.all([
        customFetch("/api/wallet", { headers: { "Content-Type": "application/json" } }),
        customFetch("/api/withdrawals", { headers: { "Content-Type": "application/json" } }),
      ]);
      setWallet(walletRes);
      setWithdrawals(Array.isArray(withdrawalsRes) ? withdrawalsRes : []);
    } catch {
      // silently handle errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 20 },
        ]}
      >
        <Skeleton height={120} style={{ marginHorizontal: 20, marginBottom: 16 }} />
        <Skeleton height={80} style={{ marginHorizontal: 20, marginBottom: 16 }} />
        <Skeleton height={80} style={{ marginHorizontal: 20 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={[styles.title, { color: colors.foreground }]}>My Wallet</Text>

      {/* Balance Card */}
      <Card style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
        <Text style={[styles.balanceLabel, { color: "rgba(255,255,255,0.8)" }]}>
          Available Balance
        </Text>
        <Text style={[styles.balanceValue, { color: "#fff" }]}>
          SGD {(wallet?.balance ?? 0).toFixed(2)}
        </Text>
        <View style={styles.statsRow}>
          <View>
            <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.7)" }]}>
              Total Earned
            </Text>
            <Text style={[styles.statValue, { color: "#fff" }]}>
              SGD {(wallet?.totalEarned ?? 0).toFixed(2)}
            </Text>
          </View>
          <View>
            <Text style={[styles.statLabel, { color: "rgba(255,255,255,0.7)" }]}>
              Total Withdrawn
            </Text>
            <Text style={[styles.statValue, { color: "#fff" }]}>
              SGD {(wallet?.totalWithdrawn ?? 0).toFixed(2)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Withdraw Button */}
      <Button
        title="Withdraw Funds"
        variant="primary"
        onPress={() => router.push("/withdraw")}
        disabled={!wallet?.canWithdraw}
        style={{ marginTop: 16 }}
      />
      {wallet && !wallet.canWithdraw && (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {wallet.balance < wallet.minWithdrawal
            ? `Minimum SGD ${wallet.minWithdrawal} required to withdraw`
            : `You can withdraw once per ${wallet.cooldownDays} days`}
        </Text>
      )}

      {/* Withdrawals History */}
      <Text style={[styles.sectionTitle, { color: colors.foreground, marginTop: 28 }]}>
        Withdrawal History
      </Text>

      {withdrawals.length === 0 ? (
        <EmptyState
          icon="credit-card"
          title="No withdrawals yet"
          description="Your withdrawals will appear here."
        />
      ) : (
        withdrawals.map((w) => (
          <Card key={w.withdrawalId} style={styles.withdrawalCard}>
            <View style={styles.withdrawalHeader}>
              <Text style={[styles.withdrawalAmount, { color: colors.foreground }]}>
                SGD {w.amount.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      w.status === "Processed"
                        ? "#DCFCE7"
                        : w.status === "Pending"
                        ? "#FEF9C3"
                        : "#FEE2E2",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        w.status === "Processed"
                          ? "#166534"
                          : w.status === "Pending"
                          ? "#854D0E"
                          : "#991B1B",
                    },
                  ]}
                >
                  {w.status}
                </Text>
              </View>
            </View>
            <Text style={[styles.withdrawalDate, { color: colors.mutedForeground }]}>
              {new Date(w.requestedAt).toLocaleDateString("en-SG")} · {w.method}
            </Text>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  balanceCard: { padding: 20 },
  balanceLabel: { fontSize: 14, marginBottom: 4 },
  balanceValue: { fontSize: 32, fontWeight: "700", marginBottom: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { fontSize: 12, marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 13, textAlign: "center", marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  withdrawalCard: { padding: 14, marginBottom: 10 },
  withdrawalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  withdrawalAmount: { fontSize: 16, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "500" },
  withdrawalDate: { fontSize: 12 },
});
