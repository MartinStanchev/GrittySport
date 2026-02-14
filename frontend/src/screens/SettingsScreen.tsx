import React, { useState } from 'react';
import {
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
import { Colors } from '../constants/colors';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsScreen() {
  const { user, signOut, updateUser } = useAuth();

  const [name, setName] = useState(user?.name ?? '');
  const [units, setUnits] = useState<'metric' | 'imperial'>(
    (user?.units_preference as 'metric' | 'imperial') ?? 'metric',
  );
  const [timezone, setTimezone] = useState(user?.timezone ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges =
    name !== (user?.name ?? '') ||
    units !== (user?.units_preference ?? 'metric') ||
    timezone !== (user?.timezone ?? '');

  async function handleSave() {
    if (!hasChanges) return;
    setIsSaving(true);
    try {
      await updateUser({
        name: name.trim(),
        units_preference: units,
        timezone: timezone.trim(),
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

        <TouchableOpacity
          style={[styles.saveButton, (!hasChanges || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
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
});
