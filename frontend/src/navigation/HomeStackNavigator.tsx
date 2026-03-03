import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import RecordManualScreen from '../screens/RecordManualScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import RecordGPSScreen from '../screens/RecordGPSScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import ImportScreen from '../screens/ImportScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
      }}
    >
      <Stack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ActivityDetail"
        component={ActivityDetailScreen}
        options={{ title: 'Activity' }}
      />
      <Stack.Screen
        name="RecordManual"
        component={RecordManualScreen}
        options={{ title: 'Log Workout', headerBackTitle: 'Back' }}
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
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ title: 'Workout' }}
      />
      <Stack.Screen
        name="Import"
        component={ImportScreen}
        options={{ title: 'Import Workouts' }}
      />
    </Stack.Navigator>
  );
}
