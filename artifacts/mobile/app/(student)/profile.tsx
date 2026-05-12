import { ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/useColors';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

export default function StudentProfileScreen() {
  const { user, logout } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();

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
          {user?.name?.charAt(0).toUpperCase() ?? 'S'}
        </Text>
      </View>
      <Text style={[styles.name, { color: colors.foreground }]}>{user?.name}</Text>
      <Text style={[styles.email, { color: colors.mutedForeground }]}>{user?.email}</Text>

      <Card style={[styles.infoCard, { marginTop: 32 }]}>
        <View style={styles.row}>
          <Feather name="user" size={16} color={colors.mutedForeground} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Role</Text>
            <Text style={[styles.rowValue, { color: colors.foreground }]}>Student</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Feather name="mail" size={16} color={colors.mutedForeground} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Email</Text>
            <Text style={[styles.rowValue, { color: colors.foreground }]}>{user?.email}</Text>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.row}>
          <Feather name="calendar" size={16} color={colors.mutedForeground} />
          <View style={styles.rowContent}>
            <Text style={[styles.rowLabel, { color: colors.mutedForeground }]}>Member since</Text>
            <Text style={[styles.rowValue, { color: colors.foreground }]}>
              {user?.createdDate
                ? new Date(user.createdDate).toLocaleDateString('en-SG', { year: 'numeric', month: 'long' })
                : '—'}
            </Text>
          </View>
        </View>
      </Card>

      <Button
        title="Log out"
        variant="outline"
        onPress={handleLogout}
        style={{ marginTop: 32 }}
        icon={<Feather name="log-out" size={16} color={colors.destructive} />}
        textStyle={{ color: colors.destructive }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: 'center' },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 32, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  email: { fontSize: 14, marginBottom: 8 },
  infoCard: { width: '100%', padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 12, marginBottom: 2 },
  rowValue: { fontSize: 15, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 16 },
});
