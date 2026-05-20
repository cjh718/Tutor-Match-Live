import { Alert, Linking, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

function formatSGT(dateStr: string | null | undefined) {
  if (!dateStr) return 'TBD';
  return new Date(dateStr).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'full', timeStyle: 'short' });
}

function statusVariant(status: string) {
  if (status === 'Confirmed') return 'success';
  if (status === 'PendingConfirmation') return 'warning';
  if (status === 'Completed') return 'outline';
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

  const { data: session, isLoading, refetch } = useGetSession(sessionId, {
    query: { enabled: !!sessionId, queryKey: getGetSessionQueryKey(sessionId) }
  });

  const updateSession = useUpdateSession();
  const createReview = useCreateReview();

  const { data: reviews } = useGetReviews(
    { tutorId: session?.tutorId ?? 0 },
    { query: { enabled: !!session?.tutorId, queryKey: getGetReviewsQueryKey({ tutorId: session?.tutorId ?? 0 }) } }
  );

  const alreadyReviewed = reviews?.some(r => r.sessionId === sessionId && r.studentId === user?.userId);

  // Counter time state (tutor) - using DateTimePicker
  const [counterDateTime, setCounterDateTime] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showCounterDatePicker, setShowCounterDatePicker] = useState(false);
  const [showCounterTimePicker, setShowCounterTimePicker] = useState(false);
  const [showCounter, setShowCounter] = useState(false);

  // Meeting link state (tutor)
  const [meetingLink, setMeetingLink] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);

  // Review state (student)
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [showReview, setShowReview] = useState(false);

  const onCounterDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowCounterDatePicker(false);
    if (date) {
      const merged = new Date(date);
      merged.setHours(counterDateTime.getHours(), counterDateTime.getMinutes(), 0, 0);
      setCounterDateTime(merged);
    }
  };

  const onCounterTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowCounterTimePicker(false);
    if (date) {
      const merged = new Date(counterDateTime);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setCounterDateTime(merged);
    }
  };

  const formattedCounterDate = counterDateTime.toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedCounterTime = counterDateTime.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const handleAcceptTime = async () => {
    try {
      const proposedTime = session?.tutorCounterTime ?? session?.proposedTime;
      await updateSession.mutateAsync({
        sessionId,
        data: { status: 'Confirmed', finalTime: proposedTime ?? undefined }
      });
      await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
    } catch {
      Alert.alert('Error', 'Failed to confirm session.');
    }
  };

  const handleCounterTime = async () => {
    if (counterDateTime <= new Date()) {
      Alert.alert('Invalid time', 'Please choose a future date and time.');
      return;
    }
    try {
      await updateSession.mutateAsync({ 
        sessionId, 
        data: { tutorCounterTime: counterDateTime.toISOString() } 
      });

      await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
      setShowCounter(false);

      // Navigate back to tutor dashboard after countering
      Alert.alert('Success', 'Counter time proposed to student.', [
        { text: 'OK', onPress: () => router.push('/(tutor)') }
      ]);
    } catch {
      Alert.alert('Error', 'Failed to propose counter time.');
    }
  };

  const handleStudentConfirm = async () => {
    try {
      await updateSession.mutateAsync({
        sessionId,
        data: { status: 'Confirmed', finalTime: session?.tutorCounterTime ?? undefined }
      });
      await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
    } catch {
      Alert.alert('Error', 'Failed to confirm session.');
    }
  };

  const handleAddMeetingLink = async () => {
    if (!meetingLink.trim()) { Alert.alert('Error', 'Please enter a meeting link.'); return; }
    try {
      await updateSession.mutateAsync({ sessionId, data: { meetingLink: meetingLink.trim() } });
      await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
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
            await updateSession.mutateAsync({ sessionId, data: { status: 'Completed' } });
            await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
          } catch {
            Alert.alert('Error', 'Failed to mark as completed.');
          }
        }
      }
    ]);
  };

  const handleSubmitReview = async () => {
    if (rating === 0) { Alert.alert('Please select a rating.'); return; }
    try {
      await createReview.mutateAsync({
        data: {
          sessionId,
          tutorId: session!.tutorId,
          rating,
          reviewText: reviewText.trim() || undefined,
        }
      });
      await queryClient.invalidateQueries({ queryKey: getGetReviewsQueryKey({ tutorId: session!.tutorId }) });
      setShowReview(false);
      Alert.alert('Review submitted', 'Thank you for your feedback!');
    } catch {
      Alert.alert('Error', 'Failed to submit review.');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
        <Skeleton height={200} style={{ marginBottom: 16 }} />
        <Skeleton height={120} />
      </View>
    );
  }

  if (!session) {
    return <View style={[styles.container, { backgroundColor: colors.background, padding: 20 }]}>
      <Text style={{ color: colors.foreground }}>No Session.</Text>
    </View>;
  }

  const displayTime = session.finalTime ?? session.tutorCounterTime ?? session.proposedTime;
  const hasTutorCounter = !!session.tutorCounterTime && !session.finalTime && session.status === 'PendingConfirmation';
  const canStudentConfirm = isStudent && hasTutorCounter;
  const canTutorRespond = isTutor && session.status === 'PendingConfirmation' && !session.tutorCounterTime;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
    >
      {/* Session info */}
      <Card style={styles.mainCard}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {session.question?.title ?? 'Session'}
          </Text>
          <Badge label={session.status} variant={statusVariant(session.status)} />
        </View>
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
        {session.proposedTime && (
          <>
            <View style={styles.infoRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Proposed</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatSGT(session.proposedTime)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>
        )}
        {session.tutorCounterTime && (
          <>
            <View style={styles.infoRow}>
              <Feather name="refresh-cw" size={14} color={colors.accent} />
              <Text style={[styles.infoLabel, { color: colors.accent }]}>Counter</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatSGT(session.tutorCounterTime)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>
        )}
        {session.finalTime && (
          <>
            <View style={styles.infoRow}>
              <Feather name="check-circle" size={14} color={colors.success} />
              <Text style={[styles.infoLabel, { color: colors.success }]}>Confirmed</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatSGT(session.finalTime)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </>
        )}
        {session.meetingLink ? (
          <Pressable
            style={styles.infoRow}
            onPress={() => Linking.openURL(session.meetingLink!)}
          >
            <Feather name="video" size={14} color={colors.success} />
            <Text style={[styles.infoLabel, { color: colors.success }]}>Meeting</Text>
            <Text style={[styles.infoValue, { color: colors.primary }]} numberOfLines={1}>{session.meetingLink}</Text>
          </Pressable>
        ) : (
          <View style={styles.infoRow}>
            <Feather name="video" size={14} color={colors.mutedForeground} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Meeting</Text>
            <Text style={[styles.infoValue, { color: colors.mutedForeground }]}>Not yet added</Text>
          </View>
        )}
      </Card>

      {/* Tutor: accept or counter propose time */}
      {canTutorRespond && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>Respond to Proposed Time</Text>
          <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
            Student proposed: {formatSGT(session.proposedTime)}
          </Text>
          <View style={styles.actionRow}>
            <Button title="Accept" variant="outline" onPress={handleAcceptTime} loading={updateSession.isPending} style={{ flex: 1 }} />
            <Button title="Counter" variant="outline" onPress={() => setShowCounter(!showCounter)} style={{ flex: 1 }} />
          </View>
          {showCounter && (
            <View style={{ marginTop: 12 }}>
              {/* Date picker */}
              <Text style={[styles.label, { color: colors.foreground }]}>Counter Date</Text>
              <Pressable
                style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowCounterDatePicker(true)}
              >
                <Feather name="calendar" size={18} color={colors.primary} />
                <Text style={[styles.pickerText, { color: colors.foreground }]}>{formattedCounterDate}</Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>

              {showCounterDatePicker && (
                <DateTimePicker
                  value={counterDateTime}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  minimumDate={new Date()}
                  onChange={onCounterDateChange}
                  themeVariant="light"
                />
              )}
              {Platform.OS === 'ios' && showCounterDatePicker && (
                <Button title="Done" variant="outline" onPress={() => setShowCounterDatePicker(false)} style={{ marginBottom: 8 }} />
              )}

              {/* Time picker */}
              <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Counter Time (SGT)</Text>
              <Pressable
                style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowCounterTimePicker(true)}
              >
                <Feather name="clock" size={18} color={colors.primary} />
                <Text style={[styles.pickerText, { color: colors.foreground }]}>{formattedCounterTime}</Text>
                <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
              </Pressable>

              {showCounterTimePicker && (
                <DateTimePicker
                  value={counterDateTime}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour
                  onChange={onCounterTimeChange}
                />
              )}
              {Platform.OS === 'ios' && showCounterTimePicker && (
                <Button title="Done" variant="outline" onPress={() => setShowCounterTimePicker(false)} style={{ marginBottom: 8 }} />
              )}

              <Button 
                title="Propose Counter Time" 
                variant="primary" 
                onPress={handleCounterTime} 
                loading={updateSession.isPending} 
                style={{ marginTop: 16 }}
              />
            </View>
          )}
        </Card>
      )}

      {/* Student: confirm tutor counter time */}
      {canStudentConfirm && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>Tutor proposed a different time</Text>
          <Text style={[styles.actionSub, { color: colors.mutedForeground }]}>
            {formatSGT(session.tutorCounterTime)}
          </Text>
          <Button title="Confirm this time" variant="primary" onPress={handleStudentConfirm} loading={updateSession.isPending} />
        </Card>
      )}

      {/* Tutor: add meeting link */}
      {isTutor && session.status === 'Confirmed' && !session.meetingLink && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>Add Meeting Link</Text>
          {showLinkForm ? (
            <>
              <Input placeholder="https://zoom.us/j/..." value={meetingLink} onChangeText={setMeetingLink} autoCapitalize="none" keyboardType="url" />
              <View style={styles.actionRow}>
                <Button title="Cancel" variant="outline" onPress={() => setShowLinkForm(false)} style={{ flex: 1 }} />
                <Button title="Save Link" variant="primary" onPress={handleAddMeetingLink} loading={updateSession.isPending} style={{ flex: 1 }} />
              </View>
            </>
          ) : (
            <Button title="Add meeting link" variant="primary" onPress={() => setShowLinkForm(true)} icon={<Feather name="link" size={14} color={colors.primaryForeground} />} />
          )}
        </Card>
      )}

      {/* Tutor: edit meeting link */}
      {isTutor && session.status === 'Confirmed' && session.meetingLink && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>Meeting Link</Text>
          <Pressable
            style={styles.infoRow}
            onPress={() => Linking.openURL(session.meetingLink!)}
          >
            <Feather name="video" size={14} color={colors.success} />
            <Text style={[styles.infoValue, { color: colors.primary }]} numberOfLines={1}>
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
                <Button title="Cancel" variant="outline" onPress={() => setShowLinkForm(false)} style={{ flex: 1 }} />
                <Button title="Update Link" variant="primary" onPress={handleAddMeetingLink} loading={updateSession.isPending} style={{ flex: 1 }} />
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
        <Button title="Mark as Completed" variant="secondary" onPress={handleMarkCompleted} loading={updateSession.isPending} style={{ marginBottom: 12 }} />
      )}

      {/* Student: rate tutor after completion */}
      {isStudent && session.status === 'Completed' && !alreadyReviewed && (
        <Card style={styles.actionCard}>
          <Text style={[styles.actionTitle, { color: colors.foreground }]}>Rate your Tutor</Text>
          <View style={styles.starRow}>
            {[1,2,3,4,5].map(i => (
              <Pressable key={i} onPress={() => setRating(i)}>
                <Feather name="star" size={32} color={i <= rating ? colors.accent : colors.border} style={{ marginHorizontal: 4 }} />
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
          <Button title="Submit Review" variant="primary" onPress={handleSubmitReview} loading={createReview.isPending} />
        </Card>
      )}

      {isStudent && session.status === 'Completed' && alreadyReviewed && (
        <Card style={[styles.actionCard, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Feather name="check-circle" size={18} color={colors.success} />
          <Text style={[styles.actionTitle, { color: colors.success }]}>Review submitted</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  mainCard: { padding: 0, marginBottom: 16, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16 },
  cardTitle: { fontSize: 17, fontWeight: '700', flex: 1, marginRight: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  infoLabel: { fontSize: 13, width: 72 },
  infoValue: { fontSize: 14, flex: 1 },
  divider: { height: 1, marginHorizontal: 16 },
  actionCard: { padding: 16, marginBottom: 12 },
  actionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  actionSub: { fontSize: 14, marginBottom: 12 },
  actionRow: { flexDirection: 'row', gap: 10 },
  starRow: { flexDirection: 'row', justifyContent: 'center', marginVertical: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerText: { flex: 1, fontSize: 16 },
});