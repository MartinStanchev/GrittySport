import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import SettingsScreen from '../screens/SettingsScreen';
import BodyMetricsScreen from '../screens/BodyMetricsScreen';
import MarketingPlaygroundScreen from '../screens/MarketingPlaygroundScreen';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  BodyMetrics: undefined;
  MarketingPlayground: undefined;
};

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export default function SettingsStackNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BodyMetrics"
        component={BodyMetricsScreen}
        options={{ title: 'Body Metrics', headerBackTitle: 'Back' }}
      />
      {__DEV__ && (
        <Stack.Screen
          name="MarketingPlayground"
          component={MarketingPlaygroundScreen}
          options={{ headerShown: false }}
        />
      )}
    </Stack.Navigator>
  );
}
