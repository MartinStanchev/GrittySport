import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HistoryScreen from '../screens/HistoryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import LogActivityScreen from '../screens/LogActivityScreen';
import RecordGPSScreen from '../screens/RecordGPSScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import { Colors } from '../constants/colors';

const Stack = createNativeStackNavigator();

export default function HistoryStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: Colors.surface },
        headerTintColor: Colors.textPrimary,
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
    </Stack.Navigator>
  );
}
