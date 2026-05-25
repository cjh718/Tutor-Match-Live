import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { customFetch } from "@workspace/api-client-react";

const MIN_WITHDRAWAL = 50;

export default function WithdrawScreen() {
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState("");
  const [bankDetails, setBankDetails] = useState("");
  const [method, setMethod] = useState<"Manual" | "StripeConnect">("Manual");
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<any>(null);

  // Fetch wallet info on mount
  const fetchWallet = async () => {
    try {
      const res: any = await customFetch("/api/wallet", {
        headers: { "Content-Type": "application/json" },
      });
      setWallet(res);
    } catch {
      // ignore
    }
  };

  useState(() => {
    fetchWallet();
  });

  const handleSubmit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }
    if (numAmount < MIN_WITHDRAWAL) {
      Alert.alert("Minimum Required", `Minimum withdrawal is SGD ${MIN_WITHDRAWAL}`);
      return;
    }
    if (!bankDetails.trim()) {
      Alert.alert("Bank Details Required", "Please enter your bank account or PayNow details");
      return;
    }

    try {
      setLoading(true);
      await customFetch("/api/withdrawals", {
        method: "POST",
        body: JSON.stringify({
          amount: numAmount,
          method,
          bankDetails: bankDetails.trim(),
        }),
        headers: { "Content-Type": "application/json" },
      });
      Alert.alert(
        "Withdrawal Requested",
        `Your request for SGD ${numAmount.toFixed(2)} has been submitted for review.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to submit withdrawal request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{
          padding: 20,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <Text style={[styles.title, { color: colors.foreground }]}>Withdraw Funds</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Available: SGD {(wallet?.balance ?? 0).toFixed(2)}
        </Text>

        <Card style={styles.card}>
          <Text style={[styles.label, { color: colors.foreground }]}>Amount (SGD)</Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                color: colors.foreground,
              },
            ]}
            placeholder="Enter amount"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Minimum SGD {MIN_WITHDRAWAL}
          </Text>
        </Card>

        <Card style={[styles.card, { marginTop: 12 }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>Withdrawal Method</Text>
          <View style={styles.methodRow}>
            <Button
              title="Manual Transfer"
              variant={method === "Manual" ? "primary" : "outline"}
              size="sm"
              onPress={() => setMethod("Manual")}
              style={{ flex: 1 }}
            />
            <Button
              title="Stripe Connect"
              variant={method === "StripeConnect" ? "primary" : "outline"}
              size="sm"
              onPress={() => setMethod("StripeConnect")}
              style={{ flex: 1, marginLeft: 8 }}
            />
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 8 }]}>
            {method === "Manual"
              ? "Admin will process your transfer manually via bank/PayNow."
              : "Funds will be transferred automatically to your linked account."}
          </Text>
        </Card>

        <Card style={[styles.card, { marginTop: 12 }]}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            Bank / PayNow Details
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                color: colors.foreground,
              },
            ]}
            placeholder="Bank name, account number, or PayNow mobile"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            value={bankDetails}
            onChangeText={setBankDetails}
          />
        </Card>

        <View style={{ marginTop: 24 }}>
          <Button
            title={loading ? "Submitting..." : "Request Withdrawal"}
            variant="primary"
            onPress={handleSubmit}
            loading={loading}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: 12 }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  subtitle: { fontSize: 16, marginBottom: 20 },
  card: { padding: 16 },
  label: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  hint: { fontSize: 12, marginTop: 6 },
  methodRow: { flexDirection: "row", gap: 8 },
});
