import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { customFetch } from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PaymentScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bidId, amount, tutorName, questionTitle } = useLocalSearchParams<{
    bidId: string;
    amount: string;
    tutorName: string;
    questionTitle: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{
    amount: number;
    platformFee: number;
    tutorAmount: number;
  } | null>(null);

  useEffect(() => {
    if (!bidId) return;
    createPaymentIntent();
  }, [bidId]);

  const createPaymentIntent = async () => {
    try {
      setLoading(true);
      const res: any = await customFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ bidId: Number(bidId) }),
        headers: { "Content-Type": "application/json" },
      });
      setPaymentId(res.paymentId);
      setClientSecret(res.clientSecret);
      setPaymentInfo({
        amount: res.amount,
        platformFee: res.platformFee,
        tutorAmount: res.tutorAmount,
      });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to initialize payment");
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async () => {
    if (!paymentId) return;
    try {
      setPaying(true);
      // For web preview: simulate payment confirmation since Stripe SDK needs native
      const res: any = await customFetch(`/api/payments/${paymentId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (res.status === "Succeeded") {
        Alert.alert(
          "Payment Successful!",
          `SGD ${Number(amount).toFixed(2)} paid. Your session is confirmed.`,
          [{ text: "OK", onPress: () => router.replace("/(student)") }]
        );
      } else {
        Alert.alert("Processing", "Payment is being processed. Check back shortly.");
      }
    } catch (err: any) {
      Alert.alert("Payment Failed", err.message || "Could not confirm payment.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20 }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Complete Payment</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        {questionTitle}
      </Text>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Tutor</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{tutorName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Bid Amount</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>
            SGD {Number(amount).toFixed(2)}
          </Text>
        </View>
        {paymentInfo && (
          <>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Platform Fee (10%)
              </Text>
              <Text style={[styles.value, { color: colors.foreground }]}>
                SGD {paymentInfo.platformFee.toFixed(2)}
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Tutor Receives
              </Text>
              <Text style={[styles.value, { color: colors.primary }]}>
                SGD {paymentInfo.tutorAmount.toFixed(2)}
              </Text>
            </View>
          </>
        )}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={[styles.totalLabel, { color: colors.foreground }]}>Total You Pay</Text>
          <Text style={[styles.totalValue, { color: colors.primary }]}>
            SGD {Number(amount).toFixed(2)}
          </Text>
        </View>
      </Card>

      <View style={{ marginTop: 24 }}>
        <Button
          title={paying ? "Processing..." : "Pay with Card"}
          variant="primary"
          onPress={confirmPayment}
          loading={paying}
          disabled={!clientSecret && paying}
        />
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: 12 }}
        />
      </View>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Payment is processed securely by Stripe. Your card details are never stored on our servers.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 20 },
  card: { padding: 16, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: "500" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#E5E7EB", paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: "600" },
  totalValue: { fontSize: 18, fontWeight: "700" },
  note: { fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 18 },
});
