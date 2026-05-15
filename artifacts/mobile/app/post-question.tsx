import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useCreateQuestion } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export default function PostQuestionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const createQuestion = useCreateQuestion();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [budget, setBudget] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (!description.trim()) e.description = "Description is required";
    if (!subject.trim()) e.subject = "Subject is required";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    try {
      await createQuestion.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim(),
          subject: subject.trim(),
          preferredDuration: 60,
          optionalBudget: budget ? parseFloat(budget) : undefined,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      Alert.alert("Question posted", "Tutors will start submitting bids.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to post question. Please try again.");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: 24, paddingBottom: insets.bottom + 40 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>
        Ask a Question
      </Text>
      <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
        Describe what you need help with and tutors will bid to assist you.
      </Text>

      <Input
        label="Title"
        placeholder="e.g. Need help with calculus integration"
        value={title}
        onChangeText={(t) => {
          setTitle(t);
          setErrors((e) => ({ ...e, title: "" }));
        }}
        error={errors.title}
        containerStyle={{ marginTop: 24 }}
      />
      <Input
        label="Subject"
        placeholder="e.g. Mathematics, Physics, Economics"
        value={subject}
        onChangeText={(t) => {
          setSubject(t);
          setErrors((e) => ({ ...e, subject: "" }));
        }}
        error={errors.subject}
      />
      <Input
        label="Description"
        placeholder="Describe your question in detail..."
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          setErrors((e) => ({ ...e, description: "" }));
        }}
        error={errors.description}
        multiline
        numberOfLines={5}
        style={{ height: 120, paddingTop: 12, textAlignVertical: "top" }}
      />
      <Input
        label="Budget (SGD, optional)"
        placeholder="e.g. 50"
        value={budget}
        onChangeText={setBudget}
        keyboardType="decimal-pad"
      />

      <Button
        title="Post Question"
        variant="primary"
        onPress={handleSubmit}
        loading={createQuestion.isPending}
        style={{ marginTop: 8 }}
        size="lg"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subheading: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
