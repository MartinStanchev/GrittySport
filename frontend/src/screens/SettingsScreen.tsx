import { useEffect, useState } from 'react';
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
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';
import { clearChatMemory } from '../services/api';
import { bleService } from '../services/bleService';
import HRSensorModal from '../components/HRSensorModal';
import * as healthKit from '../services/healthKitService';
import type { HealthKitStatus } from '../services/healthKitService';

function appleHealthStatusLabel(status: HealthKitStatus, enabled: boolean): string {
  if (status === 'not_supported') return 'Not available on this device';
  if (status === 'needs_dev_build') return 'Requires a development build';
  if (enabled) return 'Connected';
  return 'Not connected';
}

export default function SettingsScreen() {
  const { user, signOut, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [units, setUnits] = useState<'metric' | 'imperial'>(
    (user?.units_preference as 'metric' | 'imperial') ?? 'metric',
  );
  const [timezone, setTimezone] = useState(user?.timezone ?? '');
  const [maxHR, setMaxHR] = useState(`${user?.max_heart_rate ?? 185}`);
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

  const hasChanges =
    name !== (user?.name ?? '') ||
    units !== (user?.units_preference ?? 'metric') ||
    timezone !== (user?.timezone ?? '') ||
    maxHR !== `${user?.max_heart_rate ?? 185}`;

  async function handleSave() {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      const parsedMaxHR = parseInt(maxHR, 10);
      await updateUser({
        name: name.trim(),
        units_preference: units,
        timezone: timezone.trim(),
        max_heart_rate: isNaN(parsedMaxHR) ? undefined : parsedMaxHR,
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
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionHeader}>Account</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.readOnly}>{user?.email}</Text>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <Text style={styles.sectionHeader}>Preferences</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Units</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleButton, units === 'metric' && styles.toggleActive]}
              onPress={() => setUnits('metric')}
            >
              <Text style={[styles.toggleText, units === 'metric' && styles.toggleTextActive]}>
                Metric
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, units === 'imperial' && styles.toggleActive]}
              onPress={() => setUnits('imperial')}
            >
              <Text style={[styles.toggleText, units === 'imperial' && styles.toggleTextActive]}>
                Imperial
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Timezone</Text>
          <TextInput
            style={styles.input}
            value={timezone}
            onChangeText={setTimezone}
            placeholder="e.g. America/New_York"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <Text style={styles.sectionHeader}>Heart Rate</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Max Heart Rate</Text>
          <Text style={styles.helpText}>
            Used to calculate your heart rate zones during workouts.
          </Text>
          <TextInput
            style={styles.input}
            value={maxHR}
            onChangeText={setMaxHR}
            placeholder="185"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="number-pad"
            maxLength={3}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>HR Monitor</Text>
          <TouchableOpacity
            style={styles.hrDeviceRow}
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
              color={connectedDevice ? Colors.primary : Colors.textSecondary}
            />
            <Text style={styles.hrDeviceText}>
              {connectedDevice ? `Connected: ${connectedDevice}` : 'Connect HR Monitor'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionHeader}>Connected Devices</Text>
        <View style={styles.card}>
          <View style={styles.deviceRow}>
            <Ionicons name="heart" size={20} color="#FF2D55" />
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>Apple Health</Text>
              <Text style={styles.deviceStatus}>
                {appleHealthStatusLabel(appleHealthStatus, appleHealthEnabled)}
              </Text>
            </View>
            {appleHealthStatus === 'available' && (
              <TouchableOpacity
                style={[styles.deviceActionButton, appleHealthEnabled && styles.deviceActionDanger]}
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
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Text style={[styles.deviceActionText, appleHealthEnabled && styles.deviceActionTextDanger]}>
                    {appleHealthEnabled ? 'Disable' : 'Enable'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>Grit AI</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Coaching Memory</Text>
          <Text style={styles.helpText}>
            Grit remembers key details from past conversations to personalise coaching. Clearing memory resets this.
          </Text>
          <TouchableOpacity
            style={styles.clearMemoryButton}
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
            <Text style={styles.clearMemoryText}>Clear Grit&apos;s Memory</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
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
    backgroundColor: Colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 24,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 12,
  },
  readOnly: {
    fontSize: 16,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  input: {
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.tabBarBorder,
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
    borderColor: Colors.tabBarBorder,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  toggleTextActive: {
    color: Colors.surface,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  clearMemoryButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  clearMemoryText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.tabBarBorder,
  },
  logoutText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  hrDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.tabBarBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  hrDeviceText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
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
    color: Colors.textPrimary,
  },
  deviceStatus: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deviceActionButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  deviceActionDanger: {
    borderColor: Colors.tabBarBorder,
  },
  deviceActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  deviceActionTextDanger: {
    color: Colors.textSecondary,
  },
});
