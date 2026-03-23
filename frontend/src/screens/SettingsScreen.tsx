import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { useAuth } from '../contexts/AuthContext';
import { bleService } from '../services/bleService';
import HRSensorModal from '../components/HRSensorModal';
import * as healthKit from '../services/healthKitService';
import type { HealthKitStatus } from '../services/healthKitService';
import { useUsage } from '../hooks/useUsage';
import { deleteChatHistory, deleteGritMemory } from '../services/api';
import type { SettingsStackParamList } from '../navigation/SettingsStackNavigator';
import { KineticHeader, KineticPanel } from '../components/Kinetic';

function appleHealthStatusLabel(status: HealthKitStatus, enabled: boolean): string {
  if (status === 'not_supported') return 'Not available on this device';
  if (status === 'needs_dev_build') return 'Requires a development build';
  if (enabled) return 'Connected';
  return 'Not connected';
}

const DEFAULT_EFFORT_GOAL = 300;

export default function SettingsScreen() {
  const { user, signOut, updateUser } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<SettingsStackParamList>>();

  const [name, setName] = useState(user?.name ?? '');
  const [units, setUnits] = useState<'metric' | 'imperial'>(
    (user?.units_preference as 'metric' | 'imperial') ?? 'metric',
  );
  const [timezone, setTimezone] = useState(user?.timezone ?? '');
  const [effortGoal, setEffortGoal] = useState(`${user?.weekly_effort_goal ?? DEFAULT_EFFORT_GOAL}`);
  const [isSaving, setIsSaving] = useState(false);
  const [hrModalVisible, setHRModalVisible] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(
    bleService.isConnected() ? (bleService.getDeviceName() ?? null) : null,
  );
  const [appleHealthStatus, setAppleHealthStatus] = useState<HealthKitStatus>('not_supported');
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);
  const [appleHealthLoading, setAppleHealthLoading] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);

  function confirmClearData(
    title: string,
    message: string,
    setLoading: (v: boolean) => void,
    action: () => Promise<void>,
    successMessage: string,
    errorMessage: string,
  ) {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await action();
            Alert.alert('Done', successMessage);
          } catch {
            Alert.alert('Error', errorMessage);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const status = await healthKit.checkAvailability();
      if (!mounted) return;
      setAppleHealthStatus(status);
      if (status === 'available') {
        const stored = await import('expo-secure-store').then((s) =>
          s.getItemAsync('apple_health_enabled'),
        );
        if (mounted && stored === 'true') setAppleHealthEnabled(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const { usage, refresh: refreshUsage } = useUsage();

  useFocusEffect(
    useCallback(() => {
      refreshUsage();
    }, [refreshUsage]),
  );

  const hasChanges =
    name !== (user?.name ?? '') ||
    units !== (user?.units_preference ?? 'metric') ||
    timezone !== (user?.timezone ?? '') ||
    effortGoal !== `${user?.weekly_effort_goal ?? DEFAULT_EFFORT_GOAL}`;

  async function handleSave() {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const parsedEffortGoal = parseInt(effortGoal, 10);
      await updateUser({
        name: name.trim(),
        units_preference: units,
        timezone: timezone.trim(),
        weekly_effort_goal: isNaN(parsedEffortGoal) ? undefined : parsedEffortGoal,
      });
      Alert.alert('Saved', 'Your settings have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <KineticHeader
          eyebrow="Settings"
          title="Preferences"
          subtitle="Account details, devices, recovery metrics, and premium controls."
          style={styles.header}
        />

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Account</Text>
        <KineticPanel style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <Text style={[styles.readOnly, { color: colors.textPrimary }]}>{user?.email}</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textSecondary}
          />
        </KineticPanel>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Preferences</Text>
        <KineticPanel style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Units</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, { borderColor: colors.border }, units === 'metric' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setUnits('metric')}
            >
              <Text style={[styles.toggleText, { color: colors.textPrimary }, units === 'metric' && { color: colors.surface }]}>
                Metric
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, { borderColor: colors.border }, units === 'imperial' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setUnits('imperial')}
            >
              <Text style={[styles.toggleText, { color: colors.textPrimary }, units === 'imperial' && { color: colors.surface }]}>
                Imperial
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Timezone</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            value={timezone}
            onChangeText={setTimezone}
            placeholder="e.g. America/New_York"
            placeholderTextColor={colors.textSecondary}
          />
        </KineticPanel>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Training</Text>
        <KineticPanel style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Weekly Effort Goal</Text>
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Your target effort score for the week. Grit can also adjust this when creating or modifying programs.
          </Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
            value={effortGoal}
            onChangeText={setEffortGoal}
            placeholder={`${DEFAULT_EFFORT_GOAL}`}
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={4}
          />
        </KineticPanel>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Body & Heart Rate</Text>
        <KineticPanel style={styles.section}>
          <TouchableOpacity
            style={[styles.navRow, { borderColor: colors.border }]}
            onPress={() => navigation.navigate('BodyMetrics')}
          >
            <Ionicons name="body" size={20} color={colors.primary} />
            <View style={styles.navRowInfo}>
              <Text style={[styles.navRowLabel, { color: colors.textPrimary }]}>Body Metrics</Text>
              <Text style={[styles.navRowHint, { color: colors.textSecondary }]}>
                Age, height, weight, max heart rate
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <Text style={[styles.label, { marginTop: 16, color: colors.textSecondary }]}>HR Monitor</Text>
          <TouchableOpacity
            style={[styles.hrDeviceRow, { borderColor: colors.border }]}
            onPress={() => {
              if (bleService.isConnected()) {
                Alert.alert('Disconnect?', `Disconnect from ${connectedDevice}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Disconnect',
                    style: 'destructive',
                    onPress: async () => {
                      await bleService.disconnect();
                      setConnectedDevice(null);
                    },
                  },
                ]);
              } else {
                setHRModalVisible(true);
              }
            }}
          >
            <Ionicons
              name={connectedDevice ? 'heart' : 'heart-outline'}
              size={20}
              color={connectedDevice ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.hrDeviceText, { color: colors.textPrimary }]}>
              {connectedDevice ? `Connected: ${connectedDevice}` : 'Connect HR Monitor'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        </KineticPanel>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Connected Devices</Text>
        <KineticPanel style={styles.section}>
          <View style={styles.deviceRow}>
            <Ionicons name="heart" size={20} color="#FF2D55" />
            <View style={styles.deviceInfo}>
              <Text style={[styles.deviceName, { color: colors.textPrimary }]}>Apple Health</Text>
              <Text style={[styles.deviceStatus, { color: colors.textSecondary }]}>
                {appleHealthStatusLabel(appleHealthStatus, appleHealthEnabled)}
              </Text>
            </View>
            {appleHealthStatus === 'available' && (
              <TouchableOpacity
                style={[styles.deviceActionButton, { borderColor: colors.primary }, appleHealthEnabled && { borderColor: colors.border }]}
                disabled={appleHealthLoading}
                onPress={async () => {
                  setAppleHealthLoading(true);
                  try {
                    const SecureStore = await import('expo-secure-store');
                    if (appleHealthEnabled) {
                      await SecureStore.deleteItemAsync('apple_health_enabled');
                      setAppleHealthEnabled(false);
                    } else {
                      await healthKit.requestPermissions();
                      await SecureStore.setItemAsync('apple_health_enabled', 'true');
                      setAppleHealthEnabled(true);
                    }
                  } catch {
                    Alert.alert('Error', 'Could not update Apple Health connection.');
                  } finally {
                    setAppleHealthLoading(false);
                  }
                }}
              >
                {appleHealthLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.deviceActionText, { color: colors.primary }, appleHealthEnabled && { color: colors.textSecondary }]}>
                    {appleHealthEnabled ? 'Disable' : 'Enable'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KineticPanel>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text style={[styles.saveText, { color: colors.surface }]}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Appearance</Text>
        <KineticPanel style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Dark Mode</Text>
              <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                Switch between light and dark themes
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.themeToggle, isDark && { backgroundColor: colors.primary }]}
              onPress={toggleTheme}
            >
              <View style={[
                styles.themeToggleKnob,
                { backgroundColor: colors.surface },
                isDark && styles.themeToggleKnobOn,
              ]} />
            </TouchableOpacity>
          </View>
        </KineticPanel>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Subscription</Text>
        <KineticPanel style={styles.section}>
          <View style={styles.tierRow}>
            <Text style={[styles.tierLabel, { color: colors.textPrimary }]}>Current Plan</Text>
            <View style={[styles.tierBadge, { backgroundColor: colors.background }, usage?.tier === 'premium' && { backgroundColor: colors.primary }]}>
              <Text style={[styles.tierBadgeText, { color: colors.textSecondary }, usage?.tier === 'premium' && styles.tierBadgeTextPremium]}>
                {usage?.tier === 'premium' ? 'Premium' : 'Free'}
              </Text>
            </View>
          </View>

          {usage && usage.tier === 'free' && (
            <>
              <View style={[styles.usageRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.usageLabel, { color: colors.textPrimary }]}>Chat messages</Text>
                <Text style={[styles.usageValue, { color: colors.textSecondary }]}>{usage.chat_messages.used} / {usage.chat_messages.limit} this week</Text>
              </View>
              <View style={[styles.usageRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.usageLabel, { color: colors.textPrimary }]}>Programs</Text>
                <Text style={[styles.usageValue, { color: colors.textSecondary }]}>{usage.programs.current_count} / {usage.programs.limit}</Text>
              </View>
              <View style={[styles.usageRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.usageLabel, { color: colors.textPrimary }]}>Post-workout reviews</Text>
                <Text style={[styles.usageValue, { color: colors.textSecondary }]}>{usage.post_workout_reviews.used} / {usage.post_workout_reviews.limit} this month</Text>
              </View>
            </>
          )}

          <TouchableOpacity
            style={[styles.upgradeSettingsButton, { borderColor: colors.primary }]}
            onPress={() => Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!')}
          >
            <Text style={[styles.upgradeSettingsText, { color: colors.primary }]}>
              {usage?.tier === 'premium' ? 'Manage Subscription' : 'Upgrade to Premium'}
            </Text>
          </TouchableOpacity>
        </KineticPanel>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Data Management</Text>
        <KineticPanel style={styles.section}>
          <TouchableOpacity
            style={[styles.dangerRow, { borderColor: colors.border }]}
            disabled={clearingChat}
            onPress={() => confirmClearData(
              'Clear Chat History',
              'This will permanently delete all your messages with Grit. This cannot be undone.',
              setClearingChat,
              deleteChatHistory,
              'Chat history has been cleared.',
              'Failed to clear chat history.',
            )}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.error} />
            <View style={styles.dangerRowInfo}>
              <Text style={[styles.dangerRowLabel, { color: colors.textPrimary }]}>Clear Chat History</Text>
              <Text style={[styles.dangerRowHint, { color: colors.textSecondary }]}>
                Delete all messages with Grit
              </Text>
            </View>
            {clearingChat && <ActivityIndicator size="small" color={colors.textSecondary} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerRow, { borderColor: colors.border, marginTop: 8 }]}
            disabled={clearingMemory}
            onPress={() => confirmClearData(
              "Clear Grit's Memory",
              "This will erase everything Grit remembers about you (injuries, goals, preferences, etc.). Grit will start learning about you again from scratch. This cannot be undone.",
              setClearingMemory,
              deleteGritMemory,
              "Grit's memory has been cleared.",
              "Failed to clear Grit's memory.",
            )}
          >
            <Ionicons name="bulb-outline" size={20} color={colors.error} />
            <View style={styles.dangerRowInfo}>
              <Text style={[styles.dangerRowLabel, { color: colors.textPrimary }]}>Clear Grit&apos;s Memory</Text>
              <Text style={[styles.dangerRowHint, { color: colors.textSecondary }]}>
                Erase injuries, goals, preferences, and session history
              </Text>
            </View>
            {clearingMemory && <ActivityIndicator size="small" color={colors.textSecondary} />}
            </TouchableOpacity>
        </KineticPanel>

        <TouchableOpacity style={[styles.logoutButton, { borderColor: colors.border }]} onPress={signOut}>
          <Text style={[styles.logoutText, { color: colors.primary }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <HRSensorModal
        visible={hrModalVisible}
        onClose={() => setHRModalVisible(false)}
        onConnected={setConnectedDevice}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  section: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    marginBottom: 6,
    marginTop: 12,
  },
  readOnly: {
    fontSize: 16,
    fontFamily: Fonts.body,
    paddingVertical: 4,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 14,
    fontFamily: Fonts.body,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 15,
    fontFamily: Fonts.bodyMedium,
  },
  saveButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
  },
  helpText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  logoutButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  navRowInfo: {
    flex: 1,
  },
  navRowLabel: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  navRowHint: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  hrDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  hrDeviceText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.body,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  deviceStatus: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  deviceActionButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  deviceActionText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierLabel: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  tierBadgeTextPremium: {
    color: '#FFFFFF',
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  usageLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
  usageValue: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  upgradeSettingsButton: {
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  upgradeSettingsText: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  themeToggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#CCC', // overridden inline when active
    padding: 2,
    justifyContent: 'center',
  },
  themeToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  themeToggleKnobOn: {
    alignSelf: 'flex-end',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  dangerRowInfo: {
    flex: 1,
  },
  dangerRowLabel: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  dangerRowHint: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
});
