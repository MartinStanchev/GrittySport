import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ActivityDetailScreen from '../screens/ActivityDetailScreen';
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
    </Stack.Navigator>
  );
}
