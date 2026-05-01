import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { useFonts, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ProgramProvider } from './src/contexts/ProgramContext';
import { WorkoutProvider } from './src/contexts/WorkoutContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import ProfileSetupScreen from './src/screens/auth/ProfileSetupScreen';
import { ActiveWorkoutBanner } from './src/components/ActiveWorkoutBanner';
import { OfflineBanner } from './src/components/OfflineBanner';
import { navigationRef } from './src/navigation/navigationRef';
import { syncPendingWorkouts } from './src/services/syncService';
import { useNotifications } from './src/hooks/useNotifications';

function RootNavigator() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <AuthStackNavigator />;

  if (!user?.profile_completed) return <ProfileSetupScreen />;

  return (
    <ProgramProvider>
      <WorkoutProvider>
        <NotificationsBridge />
        <View style={styles.appContainer}>
          <OfflineBanner />
          <ActiveWorkoutBanner />
          <BottomTabNavigator />
        </View>
      </WorkoutProvider>
    </ProgramProvider>
  );
}

// NotificationsBridge mounts inside ProgramProvider so useNotifications can access requestOpenChat.
function NotificationsBridge() {
  useNotifications(true);
  return null;
}

function AppContent() {
  const { isDark } = useTheme();

  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncPendingWorkouts();
    });
    const netInfoSub = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncPendingWorkouts();
    });
    return () => {
      appStateSub.remove();
      netInfoSub();
    };
  }, []);

  return (
    <AuthProvider>
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </NavigationContainer>
    </AuthProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appContainer: {
    flex: 1,
  },
});
