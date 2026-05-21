import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import {
  useGetSession, getGetSessionQueryKey,
  useUpdateSession, useCreateReview, useGetReviews, getGetReviewsQueryKey,
} from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable } from 'react-native';

function formatSGT(dateStr: string | null | undefined) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function statusVariant(status: string) {
  if (status === 'Confirmed') return 'success';
  if (status === 'Completed') return 'outline';
  if (status === 'Matched') return 'success';
  return 'destructive';
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = parseInt(id, 10);
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const isStudent = user?.role === 'student';
  const isTutor = user?.role === 'tutor';

  const { data: session, isLoading } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) },
  });

  const updateSession = useUpdateSession();
  const createReview = useCreateReview();

  const { data: reviews } = useGetReviews(
    { tutorId: session?.tutorId ?? 0 },
    {
      query: {
        enabled: !!session?.tutorId,
        queryKey: getGetReviewsQueryKey({ tutorId: session?.tutorId ?? 0 }),
      },
    },
  );

  const alreadyReviewed = reviews?.some(
    (r) => r.sessionId === sessionId && r.studentId === user?.userId,
  );

  const [meetingLink, setMeetingLink] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const handleAddMeetingLink = async () => {
    if (!meetingLink.trim()) {
      Alert.alert('Error', 'Please enter a meeting link.');
      return;
    }
    try {
      await updateSession.mutateAsync({
        sessionId,
        data: { meetingLink: meetingLink.trim() },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetSessionQueryKey(sessionId),
      });
      setShowLinkForm(false);
      setMeetingLink('');
    } catch {
      Alert.alert('Error', 'Failed to add meeting link.');
    }
  };

  const handleMarkCompleted = async () => {
    Alert.alert('Mark session as completed?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: async () => {
          try {
            await updateSession.mutateAsync({
              sessionId,
              data: { status: 'Completed' },
            });
            await queryClient.invalidateQueries({
              queryKey: getGetSessionQueryKey(sessionId),
            });
          } catch {
            Alert.alert('Error', 'Failed to mark as completed.');
          }
        },
      },
    ]);
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      Alert.alert('Please select a rating.');
      return;
    }
    try {
      await createReview.mutateAsync({
        data: {
          sessionId,
          tutorId: session!.tutorId,
          rating,
          reviewText: reviewText.trim() || undefined,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetReviewsQueryKey({ tutorId: session!.tutorId }),
      });
      setRating(0);
      setReviewText('');
      Alert.alert('Review submitted', 'Thank you for your feedback!');
    } catch {
      Alert.alert('Error', 'Failed to submit review.');
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
        <Skeleton height={200} style={{ marginBottom: 16 }} />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!session) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, padding: 20 },
        ]}
      >
        <Text style={{ color: colors.foreground }}>Session not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 40 },
      ]}
    >
      {/* Session info card */}
      <Card style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {session.question?.title ?? 'Session'}
          </Text>
          <Badge label={session.status} variant={statusVariant(session.status)} />
        </View>

        {/* Counterpart */}
        <View style={styles.infoRow}>
          <Feather name="user" size={14} color={colors.mutedForeground} />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
            {isStudent ? 'Tutor' : 'Student'}
          </Text>
          <Text style={[styles.infoValue, { color: colors.foreground }]}>
            {isStudent ? session.tutor?.name : session.student?.name}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Confirmed time */}
        <View style={styles.infoRow}>
          <Feather
            name="calendar"
            size={14}
            color={session.finalTime ? colors.success : colors.mutedForeground}
          />
          <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
            Time
          </Text>
          <Text
            style={[
              styles.infoValue,
              {
                color: session.finalTime
                  ? colors.foreground
                  : colors.mutedForeground,
              },
            ]}
          >
            {formatSGT(session.finalTime)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Meeting link */}
        {session.meetingLink ? (
          <Pressable
            style={styles.infoRow}
            onPress={() => Linking.openURL(session.meetingLink!)}
          >
            <Feather name="video" size={14} color={colors.success} />
            <Text style={[styles.infoLabel, { color: colors.success }]}>
              Meeting
            </Text>
            <Text
              style={[styles.infoValue, { color: colors.primary }]}
              numberOfLines={1}
            >
              {session.meetingLink}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.infoRow}>
            <Feather name="video" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Meeting
            </Text>
            <Text
              style={[styles.infoValue, { color: colors.mutedForeground }]}
            >
              Not yet added
            </Text>
          </View>
        )}
      </Card>

      {/* Tutor: add meeting link */}
      {isTutor && session.status === 'Matched' && !session.meetingLink && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>
            Add Meeting Link
          </Text>
          {showLinkForm ? (
            <>
              <Input
                placeholder="https://zoom.us/j/..."
                value={meetingLink}
                onChangeText={setMeetingLink}
                autoCapitalize="none"
                keyboardType="url"
              />
              <View style={styles.actionRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowLinkForm(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Save Link"
                  variant="primary"
                  onPress={handleAddMeetingLink}
                  loading={updateSession.isPending}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <Button
              title="Add meeting link"
              variant="primary"
              onPress={() => setShowLinkForm(true)}
              icon={
                <Feather
                  name="link"
                  size={14}
                  color={colors.primaryForeground}
                />
              }
            />
          )}
        </Card>
      )}

      {/* Tutor: edit meeting link */}
      {isTutor && session.status === 'Confirmed' && session.meetingLink && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>
            Meeting Link
          </Text>
          <Pressable
            style={[styles.infoRow, { paddingHorizontal: 0 }]}
            onPress={() => Linking.openURL(session.meetingLink!)}
          >
            <Feather name="video" size={14} color={colors.success} />
            <Text
              style={[styles.infoValue, { color: colors.primary }]}
              numberOfLines={1}
            >
              {session.meetingLink}
            </Text>
          </Pressable>
          {showLinkForm ? (
            <>
              <Input
                placeholder="https://zoom.us/j/..."
                value={meetingLink}
                onChangeText={setMeetingLink}
                autoCapitalize="none"
                keyboardType="url"
                style={{ marginTop: 12 }}
              />
              <View style={styles.actionRow}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setShowLinkForm(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Update Link"
                  variant="primary"
                  onPress={handleAddMeetingLink}
                  loading={updateSession.isPending}
                  style={{ flex: 1 }}
                />
              </View>
            </>
          ) : (
            <Button
              title="Edit Meeting Link"
              variant="outline"
              onPress={() => {
                setMeetingLink(session.meetingLink || '');
                setShowLinkForm(true);
              }}
              style={{ marginTop: 12 }}
            />
          )}
        </Card>
      )}

      {/* Tutor: mark as completed */}
      {isTutor && session.status === 'Confirmed' && (
        <Button
          title="Mark as Completed"
          variant="secondary"
          onPress={handleMarkCompleted}
          loading={updateSession.isPending}
          style={{ marginBottom: 12 }}
        />
      )}

      {/* Student: rate tutor after completion */}
      {isStudent && session.status === 'Completed' && !alreadyReviewed && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>
            Rate your Tutor
          </Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)}>
                <Feather
                  name="star"
                  size={32}
                  color={i <= rating ? colors.accent : colors.border}
                  style={{ marginHorizontal: 4 }}
                />
              </Pressable>
            ))}
          </View>
          <Input
            label="Review (optional)"
            placeholder="Share your experience..."
            value={reviewText}
            onChangeText={setReviewText}
            multiline
            numberOfLines={3}
            style={{ height: 80, paddingTop: 10 }}
          />
          <Button
            title="Submit Review"
            variant="primary"
            onPress={handleSubmitReview}
            loading={createReview.isPending}
          />
        </Card>
      )}

      {isStudent && session.status === 'Completed' && alreadyReviewed && (
        <Card
          style={[
            styles.actionCard,
            { flexDirection: 'row', alignItems: 'center', gap: 10 },
          ]}
        >
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={[styles.actionTitle, { color: colors.success }]}>
            Review submitted
          </Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  mainCard: { padding: 0, marginBottom: 16, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoLabel: { fontSize: 13, width: 72 },
  infoValue: { fontSize: 14, flex: 1 },
  divider: { height: 1, marginHorizontal: 16 },
  actionCard: { padding: 16, marginBottom: 12 },
  actionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 12,
  },
});
