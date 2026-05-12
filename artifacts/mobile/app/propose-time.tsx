import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCreateSession } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function ProposeTimeScreen() {
  const { questionId, tutorId } = useLocalSearchParams<{ questionId: string; tutorId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const createSession = useCreateSession();

  const [date, setDate] = useState(''); // YYYY-MM-DD
  const [time, setTime] = useState(''); // HH:MM
  const [errors, setErrors] = useState<Record<string, string>>({});

  const parseDateTime = () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!dateRegex.test(date)) return null;
    if (!timeRegex.test(time)) return null;
    const isoStr = `${date}T${time}:00+08:00`; // SGT = UTC+8
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;
    return d;
  };

  const handlePropose = async () => {
    const e: Record<string, string> = {};
    if (!date.trim()) { e.date = 'Date is required (YYYY-MM-DD)'; }
    if (!time.trim()) { e.time = 'Time is required (HH:MM in 24h)'; }
    const dt = parseDateTime();
    if (!dt) {
      if (!e.date && !e.time) e.date = 'Invalid date or time format';
      setErrors(e);
      return;
    }
    if (dt < new Date()) {
      e.date = 'Please choose a future date and time';
      setErrors(e);
      return;
    }
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    try {
      const session = await createSession.mutateAsync({
        data: {
          questionId: parseInt(questionId, 10),
          tutorId: parseInt(tutorId, 10),
          proposedTime: dt.toISOString(),
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['getSessions'] });
      Alert.alert(
        'Session proposed',
        'The tutor will confirm or counter-propose a time.',
        [{ text: 'OK', onPress: () => router.replace(`/session/${session.sessionId}`) }]
      );
    } catch {
      Alert.alert('Error', 'Failed to create session. Please try again.');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: 24, paddingBottom: insets.bottom + 40 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Card style={[styles.infoCard, { marginBottom: 32 }]}>
        <View style={styles.infoRow}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            All times are in Singapore Time (SGT, UTC+8). The tutor will confirm or counter-propose a time.
          </Text>
        </View>
      </Card>

      <Text style={[styles.heading, { color: colors.foreground }]}>Propose a Session Time</Text>
      <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
        Pick a date and time that works for you.
      </Text>

      <Input
        label="Date (YYYY-MM-DD)"
        placeholder="2026-06-01"
        value={date}
        onChangeText={t => { setDate(t); setErrors(e => ({ ...e, date: '' })); }}
        error={errors.date}
        keyboardType="numbers-and-punctuation"
        containerStyle={{ marginTop: 24 }}
      />
      <Input
        label="Time in SGT (HH:MM, 24-hour)"
        placeholder="14:30"
        value={time}
        onChangeText={t => { setTime(t); setErrors(e => ({ ...e, time: '' })); }}
        error={errors.time}
        keyboardType="numbers-and-punctuation"
      />

      {date && time && parseDateTime() && (
        <Card style={styles.previewCard}>
          <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Proposed time (SGT)</Text>
          <Text style={[styles.previewTime, { color: colors.primary }]}>
            {parseDateTime()?.toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'full', timeStyle: 'short' })}
          </Text>
        </Card>
      )}

      <Button
        title="Propose this time"
        variant="primary"
        onPress={handlePropose}
        loading={createSession.isPending}
        style={{ marginTop: 16 }}
        size="lg"
        icon={<Feather name="calendar" size={16} color={colors.primaryForeground} />}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subheading: { fontSize: 14, lineHeight: 20 },
  infoCard: { padding: 14 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 13, lineHeight: 19, flex: 1 },
  previewCard: { padding: 16, marginTop: 8 },
  previewLabel: { fontSize: 12, marginBottom: 4 },
  previewTime: { fontSize: 16, fontWeight: '600' },
});
