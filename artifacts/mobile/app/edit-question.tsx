import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useGetQuestion, useUpdateQuestion, getGetQuestionQueryKey, getGetQuestionsQueryKey } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/Skeleton';
import { View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function EditQuestionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionId = parseInt(id, 10);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: question, isLoading } = useGetQuestion(questionId, {
    query: { enabled: !!questionId, queryKey: getGetQuestionQueryKey(questionId) }
  });

  const updateQuestion = useUpdateQuestion();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [duration, setDuration] = useState('');
  const [budget, setBudget] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (question) {
      setTitle(question.title);
      setDescription(question.description);
      setSubject(question.subject);
      setDuration(String(question.preferredDuration));
      setBudget(question.optionalBudget != null ? String(question.optionalBudget) : '');
    }
  }, [question]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Title is required';
    if (!description.trim()) e.description = 'Description is required';
    if (!subject.trim()) e.subject = 'Subject is required';
    const dur = parseInt(duration, 10);
    if (!duration || isNaN(dur) || dur < 15) e.duration = 'Minimum 15 minutes';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    try {
      await updateQuestion.mutateAsync({
        questionId,
        data: {
          title: title.trim(),
          description: description.trim(),
          subject: subject.trim(),
          preferredDuration: parseInt(duration, 10),
          optionalBudget: budget ? parseFloat(budget) : null,
        }
      });
      await queryClient.invalidateQueries({ queryKey: getGetQuestionQueryKey(questionId) });
      await queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      Alert.alert('Saved', 'Your question has been updated.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch {
      Alert.alert('Error', 'Failed to save changes. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Skeleton height={56} style={{ marginBottom: 16 }} />
        <Skeleton height={56} style={{ marginBottom: 16 }} />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!question || question.status !== 'Open') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Text style={{ color: colors.mutedForeground }}>This question cannot be edited.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: 24, paddingBottom: insets.bottom + 40 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>Edit Question</Text>
      <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
        You can edit this question while it's still Open.
      </Text>

      <Input
        label="Title"
        placeholder="e.g. Need help with calculus integration"
        value={title}
        onChangeText={t => { setTitle(t); setErrors(e => ({ ...e, title: '' })); }}
        error={errors.title}
        containerStyle={{ marginTop: 24 }}
      />
      <Input
        label="Subject"
        placeholder="e.g. Mathematics, Physics, Economics"
        value={subject}
        onChangeText={t => { setSubject(t); setErrors(e => ({ ...e, subject: '' })); }}
        error={errors.subject}
      />
      <Input
        label="Description"
        placeholder="Describe your question in detail..."
        value={description}
        onChangeText={t => { setDescription(t); setErrors(e => ({ ...e, description: '' })); }}
        error={errors.description}
        multiline
        numberOfLines={5}
        style={{ height: 120, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <Input
        label="Preferred Duration (minutes)"
        placeholder="60"
        value={duration}
        onChangeText={t => { setDuration(t); setErrors(e => ({ ...e, duration: '' })); }}
        error={errors.duration}
        keyboardType="number-pad"
      />
      <Input
        label="Budget (SGD, optional)"
        placeholder="e.g. 50"
        value={budget}
        onChangeText={setBudget}
        keyboardType="decimal-pad"
      />

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
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subheading: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
