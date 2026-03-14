import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HistoryScreen from '../screens/HistoryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import RecordGPSScreen from '../screens/RecordGPSScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import ImportScreen from '../screens/ImportScreen';
import WorkoutFilePreviewScreen from '../screens/WorkoutFilePreviewScreen';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator();

export default function HistoryStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
      }}
    >
      <Stack.Screen
        name="HistoryMain"
        component={HistoryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ title: 'Workout' }}
      />
      <Stack.Screen
        name="LogActivity"
        component={LogActivityScreen}
        options={{ title: 'Log Activity' }}
      />
      <Stack.Screen
        name="RecordGPS"
        component={RecordGPSScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="WorkoutSummary"
        component={WorkoutSummaryScreen}
        options={{ title: 'Workout Summary' }}
      />
      <Stack.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: 'Import Workouts' }}
      />
      <Stack.Screen
        name="WorkoutFilePreview"
        component={WorkoutFilePreviewScreen}
        options={{ title: 'Import Workout' }}
      />
    </Stack.Navigator>
  );
}
