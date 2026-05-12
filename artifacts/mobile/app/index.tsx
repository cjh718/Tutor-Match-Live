import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';

export default function Index() {
  const { user, isLoading } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.replace('/auth/login');
      } else if (user.role === 'student') {
        router.replace('/(student)');
      } else if (user.role === 'tutor') {
        router.replace('/(tutor)');
      } else if (user.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/auth/login');
      }
    }
  }, [user, isLoading]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
