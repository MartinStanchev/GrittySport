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
import { useAuth } from '../contexts/AuthContext';
import { clearChatMemory } from '../services/api';
import { bleService } from '../services/bleService';
import HRSensorModal from '../components/HRSensorModal';
import * as healthKit from '../services/healthKitService';
import type { HealthKitStatus } from '../services/healthKitService';
import { useUsage } from '../hooks/useUsage';
import type { SettingsStackParamList } from '../navigation/SettingsStackNavigator';

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
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Account</Text>
        <View style={styles.section}>
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
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Preferences</Text>
        <View style={styles.section}>
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
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Training</Text>
        <View style={styles.section}>
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
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Body & Heart Rate</Text>
        <View style={styles.section}>
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
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Connected Devices</Text>
        <View style={styles.section}>
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
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text style={[styles.saveText, { color: colors.surface }]}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Appearance</Text>
        <View style={styles.section}>
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
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Subscription</Text>
        <View style={styles.section}>
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
        </View>

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Grit AI</Text>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Coaching Memory</Text>
          <Text style={[styles.helpText, { color: colors.textSecondary }]}>
            Grit remembers key details from past conversations to personalise coaching. Clearing memory resets this.
          </Text>
          <TouchableOpacity
            style={[styles.clearMemoryButton, { borderColor: colors.primary }]}
            onPress={() =>
              Alert.alert(
                "Clear Grit's Memory",
                "This will erase all of Grit's coaching memory. He won't remember past conversations or program details. Continue?",
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Clear Memory',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await clearChatMemory();
                        Alert.alert('Done', "Grit's memory has been cleared.");
                      } catch {
                        Alert.alert('Error', 'Failed to clear memory. Please try again.');
                      }
                    },
                  },
                ],
              )
            }
          >
            <Text style={[styles.clearMemoryText, { color: colors.primary }]}>Clear Grit&apos;s Memory</Text>
          </TouchableOpacity>
        </View>

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
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  section: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
  },
  readOnly: {
    fontSize: 16,
    paddingVertical: 4,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
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
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  clearMemoryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  clearMemoryText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  navRowInfo: {
    flex: 1,
  },
  navRowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  navRowHint: {
    fontSize: 13,
    marginTop: 2,
  },
  hrDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  hrDeviceText: {
    flex: 1,
    fontSize: 15,
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
    fontWeight: '500',
  },
  deviceStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  deviceActionButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  deviceActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '600',
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
  },
  usageValue: {
    fontSize: 14,
  },
  upgradeSettingsButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 12,
  },
  upgradeSettingsText: {
    fontSize: 15,
    fontWeight: '600',
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
    fontWeight: '500',
  },
});
