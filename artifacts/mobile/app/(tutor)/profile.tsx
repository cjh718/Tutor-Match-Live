import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useGetTutorProfile, getGetTutorProfileQueryKey, useUpdateTutorProfile } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function TutorProfileScreen() {
  const { user, logout } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile } = useGetTutorProfile(user?.userId ?? 0, {
    query: { enabled: !!user?.userId, queryKey: getGetTutorProfileQueryKey(user?.userId ?? 0) }
  });

  const updateProfile = useUpdateTutorProfile();

  const [bio, setBio] = useState('');
  const [education, setEducation] = useState('');
  const [experience, setExperience] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [subjects, setSubjects] = useState('');

  useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? '');
      setEducation(profile.education ?? '');
      setExperience(profile.experience ?? '');
      setHourlyRate(profile.hourlyRate != null ? String(profile.hourlyRate) : '');
      setSubjects((profile.subjects ?? []).join(', '));
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        tutorId: user!.userId,
        data: {
          bio: bio || undefined,
          education: education || undefined,
          experience: experience || undefined,
          hourlyRate: hourlyRate ? parseFloat(hourlyRate) : undefined,
          subjects: subjects ? subjects.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        }
      });
      await queryClient.invalidateQueries({ queryKey: getGetTutorProfileQueryKey(user!.userId) });
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Failed to update profile.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: 24, paddingBottom: insets.bottom + 100 }]}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.avatarText, { color: colors.primaryForeground }]}>
          {user?.name?.charAt(0).toUpperCase() ?? 'T'}
        </Text>
      </View>
      <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
      <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>
      {user?.rating != null && (
        <View style={styles.ratingRow}>
          <Feather name="star" size={16} color={colors.accent} />
          <Text style={[styles.rating, { color: colors.accent }]}>{user.rating.toFixed(1)}</Text>
        </View>
      )}

      {editing ? (
        <Card style={[styles.editCard, { marginTop: 24 }]}>
          <Input label="Bio" value={bio} onChangeText={setBio} multiline numberOfLines={3} style={{ height: 80, paddingTop: 10 }} />
          <Input label="Education" value={education} onChangeText={setEducation} />
          <Input label="Experience" value={experience} onChangeText={setExperience} multiline numberOfLines={2} style={{ height: 64, paddingTop: 10 }} />
          <Input label="Hourly Rate (SGD)" value={hourlyRate} onChangeText={setHourlyRate} keyboardType="decimal-pad" />
          <Input label="Subjects (comma-separated)" value={subjects} onChangeText={setSubjects} />
          <View style={styles.editActions}>
            <Button title="Cancel" variant="outline" onPress={() => setEditing(false)} style={{ flex: 1 }} />
            <Button title="Save" variant="primary" onPress={handleSave} loading={updateProfile.isPending} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <Card style={[styles.infoCard, { marginTop: 24 }]}>
          {profile?.bio ? (
            <>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Bio</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{profile.bio}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          ) : null}
          {profile?.education ? (
            <>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Education</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>{profile.education}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          ) : null}
          {profile?.hourlyRate != null ? (
            <>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Hourly Rate</Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>SGD {profile.hourlyRate.toFixed(2)}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          ) : null}
          {(profile?.subjects?.length ?? 0) > 0 ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Subjects</Text>
              <Text style={[styles.infoValue, { color: colors.foreground }]}>{profile?.subjects?.join(', ')}</Text>
            </View>
          ) : (
            <View style={styles.infoRow}>
              <Text style={[styles.infoValue, { color: colors.mutedForeground }]}>Complete your profile to attract students.</Text>
            </View>
          )}
        </Card>
      )}

      {!editing && (
        <Button
          title="Edit Profile"
          variant="secondary"
          onPress={() => setEditing(true)}
          style={{ marginTop: 16, width: '100%' }}
          icon={<Feather name="edit-2" size={16} color={colors.secondaryForeground} />}
        />
      )}

      <Button
        title="Log out"
        variant="outline"
        onPress={handleLogout}
        style={{ marginTop: 12, width: '100%' }}
        icon={<Feather name="log-out" size={16} color={colors.destructive} />}
        textStyle={{ color: colors.destructive }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  email: { fontSize: 14, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { fontSize: 16, fontWeight: '600' },
  infoCard: { width: '100%', padding: 0, overflow: 'hidden' },
  editCard: { width: '100%', padding: 16 },
  infoRow: { padding: 16 },
  infoLabel: { fontSize: 12, marginBottom: 4 },
  infoValue: { fontSize: 15 },
  divider: { height: 1, marginHorizontal: 16 },
  editActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
