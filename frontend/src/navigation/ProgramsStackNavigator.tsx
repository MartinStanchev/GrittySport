import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProgramsScreen from '../screens/ProgramsScreen';
import ProgramDetailScreen from '../screens/ProgramDetailScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
import RecordManualScreen from '../screens/RecordManualScreen';
import RecordGPSScreen from '../screens/RecordGPSScreen';
import WorkoutSummaryScreen from '../screens/WorkoutSummaryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import ImportPreviewScreen from '../screens/ImportPreviewScreen';
import CreateProgramBasicsScreen from '../screens/CreateProgramBasicsScreen';
import CreateProgramPhasesScreen from '../screens/CreateProgramPhasesScreen';
import CreateProgramScheduleScreen from '../screens/CreateProgramScheduleScreen';
import CreateProgramReviewScreen from '../screens/CreateProgramReviewScreen';
import { useTheme } from '../contexts/ThemeContext';

const Stack = createNativeStackNavigator();

export default function ProgramsStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerBackTitle: 'Back',
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
        options={{ title: 'Log Workout' }}
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
        name="ImportPreview"
        component={ImportPreviewScreen}
        options={{ title: 'Import Workout' }}
      />
      <Stack.Screen
        name="CreateProgramBasics"
        component={CreateProgramBasicsScreen}
        options={{ title: 'New Program' }}
      />
      <Stack.Screen
        name="CreateProgramPhases"
        component={CreateProgramPhasesScreen}
        options={{ title: 'Phases' }}
      />
      <Stack.Screen
        name="CreateProgramSchedule"
        component={CreateProgramScheduleScreen}
        options={{ title: 'Schedule' }}
      />
      <Stack.Screen
        name="CreateProgramReview"
        component={CreateProgramReviewScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
