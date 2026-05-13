import { useState } from 'react';
import { View, Text, StyleSheet, Alert, Pressable } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRegisterUser, RegisterRequestRole } from '@workspace/api-client-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useColors } from '@/hooks/useColors';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Feather } from '@expo/vector-icons';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RegisterRequestRole>('student');
  
  const { login } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const registerMutation = useRegisterUser();

  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      const response = await registerMutation.mutateAsync({
        data: { name: name.trim(), email: email.trim().toLowerCase(), password, role }
      });
      await login(response.token, response.user);
      
      if (response.user.role === 'student') {
        router.replace('/(student)');
      } else if (response.user.role === 'tutor') {
        router.replace('/(tutor)');
      }
    } catch (error: any) {
      const msg = error?.data?.error || error.message || 'Something went wrong';
      Alert.alert('Registration Failed', msg);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: insets.top + 20,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 24,
        flexGrow: 1,
      }}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>Create an account</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Join TutorMatch today</Text>
      </View>

      <View style={styles.form}>
        <View style={styles.roleContainer}>
          <Text style={[styles.label, { color: colors.foreground }]}>I want to be a...</Text>
          <View style={styles.roleButtons}>
            <Pressable
              style={[
                styles.roleButton,
                { borderColor: colors.border },
                role === 'student' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
              ]}
              onPress={() => setRole('student')}
            >
              <Feather name="book" size={24} color={role === 'student' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.roleText, { color: role === 'student' ? colors.primary : colors.mutedForeground }]}>Student</Text>
            </Pressable>
            <Pressable
              style={[
                styles.roleButton,
                { borderColor: colors.border },
                role === 'tutor' && { borderColor: colors.primary, backgroundColor: colors.primary + '10' }
              ]}
              onPress={() => setRole('tutor')}
            >
              <Feather name="briefcase" size={24} color={role === 'tutor' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.roleText, { color: role === 'tutor' ? colors.primary : colors.mutedForeground }]}>Tutor</Text>
            </Pressable>
          </View>
        </View>

        <Input
          label="Full Name"
          placeholder="Enter your name"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Email"
          placeholder="Enter your email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Password"
          placeholder="Create a password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={registerMutation.isPending}
          style={styles.submitButton}
        />
      </View>

      <View style={styles.footer}>
        <Text style={{ color: colors.mutedForeground }}>Already have an account?</Text>
        <Link href="/auth/login" asChild>
          <Pressable>
            <Text style={[styles.link, { color: colors.primary }]}>Sign in</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  roleContainer: {
    marginBottom: 24,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  roleText: {
    fontWeight: '600',
    fontSize: 16,
  },
  submitButton: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 24,
  },
  link: {
    fontWeight: '600',
  },
});
