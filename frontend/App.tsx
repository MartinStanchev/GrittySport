import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import NetInfo from '@react-native-community/netinfo';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ProgramProvider } from './src/contexts/ProgramContext';
import { WorkoutProvider } from './src/contexts/WorkoutContext';
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import AuthStackNavigator from './src/navigation/AuthStackNavigator';
import { ActiveWorkoutBanner } from './src/components/ActiveWorkoutBanner';
import { navigationRef } from './src/navigation/navigationRef';
import { syncPendingWorkouts } from './src/services/syncService';

function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <AuthStackNavigator />;

  return (
    <ProgramProvider>
      <WorkoutProvider>
        <View style={styles.appContainer}>
          <ActiveWorkoutBanner />
          <BottomTabNavigator />
        </View>
      </WorkoutProvider>
    </ProgramProvider>
  );
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
