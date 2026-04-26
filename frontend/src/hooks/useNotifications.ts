import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { navigationRef } from '../navigation/navigationRef';
import { registerPushToken } from '../services/api';

// Configure how foreground notifications appear
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'b58f18bc-5291-4148-91fc-998bb8950106',
  });

  return tokenData.data;
}

/**
 * Hook to register for push notifications and handle incoming notifications.
 * Call this once after authentication succeeds.
 */
export function useNotifications(isAuthenticated: boolean) {
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    // Register push token
    registerForPushNotifications()
      .then((token) => {
        if (token) {
          const platform = Platform.OS === 'ios' ? 'ios' : 'android';
          registerPushToken(token, platform).catch((err) =>
            console.warn('[Notifications] Failed to register token with backend:', err),
          );
        }
      })
      .catch((err) => console.warn('[Notifications] Registration error:', err));

    // Handle notification taps (background → foreground): all types navigate to Home.
    // Chat-type notifications (post_workout_review, missed_workout, pre_workout_checkin)
    // will have their chat modal opened by HomeScreen once it detects the navigation.
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (data?.type && navigationRef.isReady()) {
        navigationRef.navigate('Home' as never);
      }
    });

    return () => {
      responseListenerRef.current?.remove();
      responseListenerRef.current = null;
    };
  }, [isAuthenticated]);
}
