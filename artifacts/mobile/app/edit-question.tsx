import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, Alert, View, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  useGetQuestion,
  useUpdateQuestion,
  getGetQuestionQueryKey,
  getGetQuestionsQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/contexts/AuthContext";
import * as DocumentPicker from "expo-document-picker";
import { Feather } from "@expo/vector-icons";

export default function EditQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionId = parseInt(id, 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: question, isLoading } = useGetQuestion(questionId, {
    query: {
      enabled: !!questionId,
      queryKey: getGetQuestionQueryKey(questionId),
    },
  });

  const updateQuestion = useUpdateQuestion();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [budget, setBudget] = useState("");
  const [attachment, setAttachment] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [attachmentChanged, setAttachmentChanged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (question) {
      setTitle(question.title);
      setDescription(question.description);
      setSubject(question.subject);
      setBudget(
        question.optionalBudget != null ? String(question.optionalBudget) : "",
      );
      // Rewrite legacy /uploads/ paths to /api/uploads/ for the proxy
      const displayUrl = question.attachmentUrl
        ? question.attachmentUrl.startsWith("/uploads/")
          ? question.attachmentUrl.replace("/uploads/", "/api/uploads/")
          : question.attachmentUrl
        : null;
      setAttachment(
        displayUrl
          ? {
              uri: displayUrl,
              name: displayUrl.split("/").pop() ?? "attachment",
              type: "application/octet-stream",
            }
          : null,
      );
      setAttachmentChanged(false);
    }
  }, [question]);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });
      if (result.assets?.[0]) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
        });
        setAttachmentChanged(true);
      }
    } catch {
      Alert.alert("Error", "Failed to select file.");
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (!description.trim()) e.description = "Description is required";
    if (!subject.trim()) e.subject = "Subject is required";
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }

    try {
      let attachmentUrl = question?.attachmentUrl ?? null;
      if (attachmentChanged && attachment) {
        const formData = new FormData();
        formData.append("file", {
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.type,
        } as any);
        const data = await customFetch<{ url: string }>("/api/upload", {
          method: "POST",
          body: formData,
        });
        attachmentUrl = data.url;
      }
      await updateQuestion.mutateAsync({
        questionId,
        data: {
          title: title.trim(),
          description: description.trim(),
          subject: subject.trim(),
          optionalBudget: budget ? parseFloat(budget) : null,
          attachmentUrl: attachmentUrl ?? undefined,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetQuestionQueryKey(questionId),
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      Alert.alert("Saved", "Your question has been updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to save changes. Please try again.");
    }
  };

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, padding: 20 },
        ]}
      >
        <Skeleton height={56} style={{ marginBottom: 16 }} />
        <Skeleton height={56} style={{ marginBottom: 16 }} />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!question || question.status !== "Open") {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, padding: 20 },
        ]}
      >
        <Text style={{ color: colors.mutedForeground }}>
          This question cannot be edited.
        </Text>
      </View>
    );
  }

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
        Edit Question
      </Text>
      <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
        You can edit this question while it's still Open.
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
      <View style={{ marginTop: 16 }}>
        <Text style={{ color: colors.foreground, marginBottom: 8, fontWeight: "500" }}>Attachment</Text>
        {attachment ? (
          <View style={styles.attachmentRow}>
            <Feather name="file" size={16} color={colors.primary} />
            <Text style={[styles.attachmentText, { color: colors.foreground }]} numberOfLines={1}>{attachment.name}</Text>
            <Pressable onPress={() => { setAttachment(null); setAttachmentChanged(true); }}>
              <Feather name="x" size={18} color={colors.destructive} />
            </Pressable>
          </View>
        ) : (
          <Button title="Replace Attachment" variant="outline" onPress={pickFile} />
        )}
      </View>

      <Button
        title="Save Changes"
        variant="primary"
        onPress={handleSave}
        loading={updateQuestion.isPending}
        style={{ marginTop: 8 }}
        size="lg"
      />
      <Button
        title="Cancel"
        variant="outline"
        onPress={() => router.back()}
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  subheading: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  attachmentRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  attachmentText: { flex: 1, fontSize: 13 },
});