import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
  Pressable,
} from "react-native";
import { router } from "expo-router";
import { useCreateQuestion } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import { getBaseUrl } from '@workspace/api-client-react';

export default function PostQuestionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const createQuestion = useCreateQuestion();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [budget, setBudget] = useState("");
  const [attachment, setAttachment] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    if (!description.trim()) e.description = "Description is required";
    if (!subject.trim()) e.subject = "Subject is required";
    return e;
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setAttachment({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || "application/octet-stream",
        });
      }
    } catch (error) {
      console.error("File pick error:", error);
    }
  };

  const uploadFile = async (): Promise<string | undefined> => {
    if (!attachment) return undefined;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: attachment.uri,
        name: attachment.name,
        type: attachment.type,
      } as any);

      const response = await fetch(`https://${process.env.EXPO_PUBLIC_DOMAIN}/api/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        return data.url;
      } else {
        Alert.alert("Error", "Failed to upload file");
        return undefined;
      }
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Failed to upload file");
      return undefined;
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    try {
      const attachmentUrl = await uploadFile();

      await createQuestion.mutateAsync({
        data: {
          title: title.trim(),
          description: description.trim(),
          subject: subject.trim(),
          optionalBudget: budget ? parseFloat(budget) : undefined,
          attachmentUrl,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      Alert.alert("Question posted", "Tutors will start submitting bids.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.log("Full error:", error);
      Alert.alert(
        "Error",
        error?.message || "Failed to post question. Please try again.",
      );
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

      {/* File Attachment Section */}
      <View style={styles.attachmentSection}>
        <Text style={[styles.attachmentLabel, { color: colors.foreground }]}>
          Attachment (Optional)
        </Text>

        {!attachment ? (
          <Pressable
            style={[styles.attachButton, { borderColor: colors.border, backgroundColor: colors.card }]}
            onPress={pickFile}
          >
            <Feather name="paperclip" size={20} color={colors.primary} />
            <Text style={[styles.attachButtonText, { color: colors.primary }]}>
              Attach File (PDF, Image, Word)
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.attachedFile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="file" size={20} color={colors.success} />
            <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
              {attachment.name}
            </Text>
            <Pressable onPress={removeAttachment}>
              <Feather name="x" size={20} color={colors.destructive} />
            </Pressable>
          </View>
        )}
      </View>

      <Button
        title="Post Question"
        variant="primary"
        onPress={handleSubmit}
        loading={createQuestion.isPending || uploading}
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
  attachmentSection: { marginTop: 16, marginBottom: 8 },
  attachmentLabel: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  attachButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 12,
  },
  attachButtonText: { fontSize: 14, fontWeight: "500" },
  attachedFile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fileName: { flex: 1, fontSize: 13 },
});