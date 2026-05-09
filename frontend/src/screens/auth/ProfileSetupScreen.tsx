import { useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { ageBasedMaxHR, inchesToCm, lbsToKg } from '../../utils/units';

export default function ProfileSetupScreen() {
  const { updateUser, user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(user?.name ?? '');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [isSaving, setIsSaving] = useState(false);

  // Birth year is captured at the consent step; here we only use it to estimate max HR.
  const ageFromBirthYear = user?.birth_year ? new Date().getFullYear() - user.birth_year : null;
  const estimatedMaxHR = ageFromBirthYear !== null ? ageBasedMaxHR(ageFromBirthYear) : null;

  async function handleContinue() {
    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert('Name Required', 'Please tell Grit what to call you.');
      return;
    }
    if (isNaN(parsedHeight) || parsedHeight <= 0) {
      Alert.alert('Invalid Height', 'Please enter a valid height.');
      return;
    }
    if (isNaN(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }

    setIsSaving(true);
    try {
      const heightCm = units === 'imperial' ? inchesToCm(parsedHeight) : parsedHeight;
      const weightKg = units === 'imperial' ? lbsToKg(parsedWeight) : parsedWeight;

      await updateUser({
        name: trimmedName,
        height_cm: heightCm,
        weight_kg: weightKg,
        max_heart_rate: estimatedMaxHR ?? 185,
        profile_completed: true,
      });
    } catch {
      Alert.alert('Error', 'Failed to save your profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSkip() {
    setIsSaving(true);
    try {
      await updateUser({ profile_completed: true });
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>About You</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Help Grit personalise your training by sharing a few details. This is used to calculate your heart rate zones and estimate calories burned.
        </Text>

        <View style={styles.unitsRow}>
          <TouchableOpacity
            style={[styles.unitButton, { borderColor: colors.border }, units === 'metric' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setUnits('metric')}
          >
            <Text style={[styles.unitText, { color: colors.textPrimary }, units === 'metric' && { color: colors.surface }]}>
              Metric
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.unitButton, { borderColor: colors.border }, units === 'imperial' && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            onPress={() => setUnits('imperial')}
          >
            <Text style={[styles.unitText, { color: colors.textPrimary }, units === 'imperial' && { color: colors.surface }]}>
              Imperial
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Name</Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={name}
          onChangeText={setName}
          placeholder="What should Grit call you?"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="words"
          maxLength={60}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Height ({units === 'metric' ? 'cm' : 'inches'})
        </Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={height}
          onChangeText={setHeight}
          placeholder={units === 'metric' ? 'e.g. 175' : 'e.g. 69'}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          maxLength={5}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Weight ({units === 'metric' ? 'kg' : 'lbs'})
        </Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={weight}
          onChangeText={setWeight}
          placeholder={units === 'metric' ? 'e.g. 70' : 'e.g. 154'}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          maxLength={5}
        />

        {estimatedMaxHR !== null && (
          <View style={[styles.infoBox, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Estimated Max Heart Rate</Text>
            <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{estimatedMaxHR} bpm</Text>
            <Text style={[styles.infoHint, { color: colors.textSecondary }]}>
              Calculated as 220 - age. You can change this later in Settings.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors.primary }, isSaving && styles.disabled]}
          onPress={handleContinue}
          disabled={isSaving}
        >
          <Text style={[styles.continueText, { color: colors.surface }]}>
            {isSaving ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          disabled={isSaving}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  unitsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  unitText: {
    fontSize: 15,
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  infoBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  continueButton: {
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  disabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  skipText: {
    fontSize: 15,
  },
});
