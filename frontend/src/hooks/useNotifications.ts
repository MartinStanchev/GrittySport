import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { navigationRef } from '../navigation/navigationRef';
import { registerPushToken } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';

// Notification types whose tap should open the chat modal on Home.
const CHAT_OPEN_TYPES = new Set(['post_workout_review', 'missed_workout', 'pre_workout_checkin']);

// Notification types that correspond to a server-persisted chat message from Grit.
// When one of these arrives while the app is foregrounded we refresh the chat so
// the new message (and unread badge) appears without needing to tap or restart.
const CHAT_MESSAGE_TYPES = new Set([
  'post_workout_review',
  'missed_workout',
  'pre_workout_checkin',
  'reminder',
]);

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
  const receivedListenerRef = useRef<Notifications.Subscription | null>(null);
  const { requestOpenChat, notifyChatRefresh } = useProgram();

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

    // Handle notifications that arrive while the app is foregrounded. Grit's
    // server-generated chat messages aren't pushed over the chat WebSocket, so
    // pull them in and bump the unread badge instead of silently dropping them.
    receivedListenerRef.current = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, string> | undefined;
      if (data?.type && CHAT_MESSAGE_TYPES.has(data.type)) {
        notifyChatRefresh();
      }
    });

    // Handle notification taps (background → foreground).
    // Chat-driven types open the chat modal on Home; reminders just land on Home.
    responseListenerRef.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data?.type || !navigationRef.isReady()) return;

      if (CHAT_OPEN_TYPES.has(data.type)) {
        requestOpenChat();
      }
      navigationRef.navigate('Home' as never);
    });

    return () => {
      receivedListenerRef.current?.remove();
      receivedListenerRef.current = null;
      responseListenerRef.current?.remove();
      responseListenerRef.current = null;
    };
  }, [isAuthenticated, requestOpenChat, notifyChatRefresh]);
}
