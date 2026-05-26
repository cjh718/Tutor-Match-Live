import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Alert, ActivityIndicator, ScrollView, Clipboard, Pressable } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { customFetch } from "@workspace/api-client-react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

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
  const [markingPaid, setMarkingPaid] = useState(false);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<{
    amount: number;
    platformFee: number;
    tutorAmount: number;
  } | null>(null);

  useEffect(() => {
    if (!bidId) return;
    createPaymentRecord();
  }, [bidId]);

  const createPaymentRecord = async () => {
    try {
      setLoading(true);
      const res: any = await customFetch("/api/payments", {
        method: "POST",
        body: JSON.stringify({ bidId: Number(bidId) }),
        headers: { "Content-Type": "application/json" },
      });
      setPaymentId(res.paymentId);
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

  const handlePaid = async () => {
    if (!paymentId) return;
    try {
      setMarkingPaid(true);
      const res: any = await customFetch(`/api/payments/${paymentId}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      Alert.alert(
        "Payment Submitted",
        `You've marked the payment as paid via PayNow.\n\nReference: TM-${res.paymentId}\n\nAdmin will verify your transfer within 1-2 business days.`,
        [{ text: "OK", onPress: () => router.replace("/(student)") }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Could not mark payment as paid.");
    } finally {
      setMarkingPaid(false);
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert("Copied", "PayNow number copied to clipboard");
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const paynowNumber = "88755849";
  const refCode = paymentId ? `TM-${paymentId}` : "";

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

      <Card style={[styles.paynowCard, { backgroundColor: colors.muted }]}>
        <Text style={[styles.paynowTitle, { color: colors.foreground }]}>
          Pay via PayNow
        </Text>
        <Text style={[styles.paynowSubtitle, { color: colors.mutedForeground }]}>
          Transfer the exact amount to the number below using your bank app
        </Text>

        <View style={styles.paynowRow}>
          <View>
            <Text style={[styles.paynowLabel, { color: colors.mutedForeground }]}>PayNow Number</Text>
            <Text style={[styles.paynowValue, { color: colors.foreground }]}>{paynowNumber}</Text>
          </View>
          <Pressable onPress={() => copyToClipboard(paynowNumber)}>
            <Feather name="copy" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={styles.paynowRow}>
          <View>
            <Text style={[styles.paynowLabel, { color: colors.mutedForeground }]}>Amount</Text>
            <Text style={[styles.paynowValue, { color: colors.foreground }]}>
              SGD {Number(amount).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.paynowRow}>
          <View>
            <Text style={[styles.paynowLabel, { color: colors.mutedForeground }]}>Reference</Text>
            <Text style={[styles.paynowValue, { color: colors.foreground }]}>{refCode}</Text>
          </View>
          <Pressable onPress={() => copyToClipboard(refCode)}>
            <Feather name="copy" size={20} color={colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.warningBox, { backgroundColor: colors.warning + "20" }]}>
          <Feather name="alert-circle" size={16} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            Please include the reference code in your transfer so we can verify it.
          </Text>
        </View>
      </Card>

      <View style={{ marginTop: 24 }}>
        <Button
          title={markingPaid ? "Submitting..." : "I Have Paid via PayNow"}
          variant="primary"
          onPress={handlePaid}
          loading={markingPaid}
          disabled={markingPaid}
        />
        <Button
          title="Cancel"
          variant="outline"
          onPress={() => router.back()}
          style={{ marginTop: 12 }}
        />
      </View>

      <Text style={[styles.note, { color: colors.mutedForeground }]}>
        Your payment will be verified by our admin within 1-2 business days. You'll receive a notification once confirmed.
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
  paynowCard: { padding: 16, marginTop: 20, gap: 16 },
  paynowTitle: { fontSize: 18, fontWeight: "600" },
  paynowSubtitle: { fontSize: 14, marginTop: 2, lineHeight: 20 },
  paynowRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paynowLabel: { fontSize: 12 },
  paynowValue: { fontSize: 16, fontWeight: "600", marginTop: 2 },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  warningText: { fontSize: 12, flex: 1, lineHeight: 18 },
  note: { fontSize: 12, textAlign: "center", marginTop: 24, lineHeight: 18 },
});
