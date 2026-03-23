import { View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeStackNavigator from './HomeStackNavigator';
import HistoryStackNavigator from './HistoryStackNavigator';
import ProgramsStackNavigator from './ProgramsStackNavigator';
import SettingsStackNavigator from './SettingsStackNavigator';
import { useTheme } from '../contexts/ThemeContext';
import { useProgram } from '../contexts/ProgramContext';
import { Fonts } from '../constants/fonts';

const Tab = createBottomTabNavigator();

/** Placeholder — the Chat tab never actually renders; its press is intercepted. */
function ChatPlaceholder() {
  return <View />;
}

export default function BottomTabNavigator() {
  const { colors } = useTheme();
  const { chatUnreadCount, requestOpenChat } = useProgram();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontFamily: Fonts.bodySemiBold,
          fontSize: 10,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontFamily: Fonts.headingMedium,
          fontSize: 18,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatPlaceholder}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            requestOpenChat();
            navigation.navigate('Home');
          },
        })}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses" size={size} color={color} />
          ),
          tabBarBadge: chatUnreadCount > 0 ? chatUnreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.error,
            fontSize: 10,
            fontFamily: Fonts.bodySemiBold,
          },
        }}
      />
      <Tab.Screen
        name="Programs"
        component={ProgramsStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barbell" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
