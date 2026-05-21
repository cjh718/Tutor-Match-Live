import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { customFetch } from '@workspace/api-client-react';

// Only import expo-notifications if not in Expo Go and not on web
let Notifications: any = null;
let isExpoGo = false;

try {
  // Check if running in Expo Go
  const Constants = require('expo-constants');
  if (Constants.default && Constants.default.executionEnvironment === 'storeClient') {
    isExpoGo = true;
  }
} catch (e) {
  // Ignore
}

if (!isExpoGo && Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (e) {
    console.warn('expo-notifications not available:', e);
  }
}

async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || isExpoGo || !Notifications) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!user || registeredRef.current || isExpoGo) return;

    registerForPushNotifications()
      .then(async (token) => {
        if (!token) return;
        registeredRef.current = true;
        await customFetch('/api/notifications/push-token', {
          method: 'POST',
          body: JSON.stringify({ token }),
          headers: { 'Content-Type': 'application/json' },
        });
      })
      .catch((err) => {
        console.warn('Push notification registration failed:', err);
      });
  }, [user]);
}