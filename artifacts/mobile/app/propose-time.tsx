import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Alert, Pressable, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useCreateSession } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export default function ProposeTimeScreen() {
  const { questionId, tutorId } = useLocalSearchParams<{ questionId: string; tutorId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const createSession = useCreateSession();

  const [selectedDate, setSelectedDate] = useState<Date>(tomorrow());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const onDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      const merged = new Date(date);
      merged.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      setSelectedDate(merged);
    }
  };

  const onTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      const merged = new Date(selectedDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setSelectedDate(merged);
    }
  };

  const formattedDate = selectedDate.toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const formattedTime = selectedDate.toLocaleTimeString('en-SG', {
    timeZone: 'Asia/Singapore',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const formattedFull = selectedDate.toLocaleString('en-SG', {
    timeZone: 'Asia/Singapore',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const handlePropose = async () => {
    if (selectedDate <= new Date()) {
      Alert.alert('Invalid time', 'Please choose a future date and time.');
      return;
    }

    try {
      const session = await createSession.mutateAsync({
        data: {
          questionId: parseInt(questionId, 10),
          tutorId: parseInt(tutorId, 10),
          proposedTime: selectedDate.toISOString(),
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
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
      <Card style={[styles.infoCard, { marginBottom: 28 }]}>
        <View style={styles.infoRow}>
          <Feather name="info" size={16} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            All times are in Singapore Time (SGT, UTC+8). The tutor will confirm or counter-propose.
          </Text>
        </View>
      </Card>

      <Text style={[styles.heading, { color: colors.foreground }]}>Propose a Session Time</Text>
      <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
        Pick a date and time that works for you.
      </Text>

      {/* Date picker */}
      <Text style={[styles.label, { color: colors.foreground }]}>Date</Text>
      <Pressable
        style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setShowDatePicker(true)}
      >
        <Feather name="calendar" size={18} color={colors.primary} />
        <Text style={[styles.pickerText, { color: colors.foreground }]}>{formattedDate}</Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={new Date()}
          onChange={onDateChange}
          themeVariant="light"
        />
      )}
      {Platform.OS === 'ios' && showDatePicker && (
        <Button title="Done" variant="outline" onPress={() => setShowDatePicker(false)} style={{ marginBottom: 8 }} />
      )}

      {/* Time picker */}
      <Text style={[styles.label, { color: colors.foreground, marginTop: 16 }]}>Time (SGT)</Text>
      <Pressable
        style={[styles.pickerButton, { borderColor: colors.border, backgroundColor: colors.card }]}
        onPress={() => setShowTimePicker(true)}
      >
        <Feather name="clock" size={18} color={colors.primary} />
        <Text style={[styles.pickerText, { color: colors.foreground }]}>{formattedTime}</Text>
        <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
      </Pressable>

      {showTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          is24Hour
          onChange={onTimeChange}
        />
      )}
      {Platform.OS === 'ios' && showTimePicker && (
        <Button title="Done" variant="outline" onPress={() => setShowTimePicker(false)} style={{ marginBottom: 8 }} />
      )}

      {/* Preview */}
      <Card style={[styles.previewCard, { marginTop: 24 }]}>
        <Text style={[styles.previewLabel, { color: colors.mutedForeground }]}>Selected time (SGT)</Text>
        <Text style={[styles.previewTime, { color: colors.primary }]}>{formattedFull}</Text>
      </Card>

      <Button
        title="Propose this time"
        variant="primary"
        onPress={handlePropose}
        loading={createSession.isPending}
        style={{ marginTop: 24 }}
        size="lg"
        icon={<Feather name="send" size={16} color={colors.primaryForeground} />}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  heading: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subheading: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  infoCard: { padding: 14 },
  infoRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  infoText: { fontSize: 13, lineHeight: 19, flex: 1 },
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
  previewCard: { padding: 16 },
  previewLabel: { fontSize: 12, marginBottom: 6 },
  previewTime: { fontSize: 16, fontWeight: '600' },
});
