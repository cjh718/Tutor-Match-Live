import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: true, headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ title: "Admin Dashboard" }} />
    </Stack>
  );
}
