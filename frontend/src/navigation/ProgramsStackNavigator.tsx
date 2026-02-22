import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProgramsScreen from '../screens/ProgramsScreen';
import ProgramDetailScreen from '../screens/ProgramDetailScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import RecordManualScreen from '../screens/RecordManualScreen';
import RecordGPSScreen from '../screens/RecordGPSScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function ProgramsStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
      }}
    >
      <Stack.Screen
        name="ProgramsList"
        component={ProgramsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ProgramDetail"
        component={ProgramDetailScreen}
        options={{ title: 'Program' }}
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
    </Stack.Navigator>
  );
}
