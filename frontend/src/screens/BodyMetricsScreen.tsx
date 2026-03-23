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
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { useAuth } from '../contexts/AuthContext';
import { ageBasedMaxHR, cmToInches, inchesToCm, kgToLbs, lbsToKg } from '../utils/units';
import { KineticHeader, KineticPanel } from '../components/Kinetic';

function displayHeight(heightCm: number | undefined, isImperial: boolean): string {
  if (!heightCm) return '';
  return isImperial ? `${cmToInches(heightCm)}` : `${heightCm}`;
}

function displayWeight(weightKg: number | undefined, isImperial: boolean): string {
  if (!weightKg) return '';
  return isImperial ? `${kgToLbs(weightKg)}` : `${weightKg}`;
}

export default function BodyMetricsScreen() {
  const { user, updateUser } = useAuth();
  const { colors } = useTheme();

  const isImperial = user?.units_preference === 'imperial';
  const currentYear = new Date().getFullYear();
  const currentAge = user?.birth_year ? currentYear - user.birth_year : null;

  const initialAge = currentAge != null ? `${currentAge}` : '';
  const initialHeight = displayHeight(user?.height_cm, isImperial);
  const initialWeight = displayWeight(user?.weight_kg, isImperial);
  const initialMaxHR = `${user?.max_heart_rate ?? 185}`;

  const [age, setAge] = useState(initialAge);
  const [height, setHeight] = useState(initialHeight);
  const [weight, setWeight] = useState(initialWeight);
  const [maxHR, setMaxHR] = useState(initialMaxHR);
  const [isSaving, setIsSaving] = useState(false);

  const parsedAge = parseInt(age, 10);
  const estimatedMaxHR = !isNaN(parsedAge) ? ageBasedMaxHR(parsedAge) : null;

  const hasChanges =
    age !== initialAge ||
    height !== initialHeight ||
    weight !== initialWeight ||
    maxHR !== initialMaxHR;

  async function handleSave() {
    if (!hasChanges) return;

    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);
    const parsedMaxHR = parseInt(maxHR, 10);

    if (age && (isNaN(parsedAge) || parsedAge < 10 || parsedAge > 120)) {
      Alert.alert('Invalid Age', 'Please enter an age between 10 and 120.');
      return;
    }
    if (height && (isNaN(parsedHeight) || parsedHeight <= 0)) {
      Alert.alert('Invalid Height', 'Please enter a valid height.');
      return;
    }
    if (weight && (isNaN(parsedWeight) || parsedWeight <= 0)) {
      Alert.alert('Invalid Weight', 'Please enter a valid weight.');
      return;
    }

    setIsSaving(true);
    try {
      const input: Record<string, number | undefined> = {};

      if (age) {
        input.birth_year = currentYear - parsedAge;
      }
      if (height) {
        input.height_cm = isImperial ? inchesToCm(parsedHeight) : parsedHeight;
      }
      if (weight) {
        input.weight_kg = isImperial ? lbsToKg(parsedWeight) : parsedWeight;
      }
      if (!isNaN(parsedMaxHR)) {
        input.max_heart_rate = parsedMaxHR;
      }

      await updateUser(input);
      Alert.alert('Saved', 'Your body metrics have been updated.');
    } catch {
      Alert.alert('Error', 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleResetMaxHR() {
    if (estimatedMaxHR !== null) {
      setMaxHR(`${estimatedMaxHR}`);
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
          eyebrow="Body Metrics"
          title="Heart rate and physiology"
          subtitle="These numbers power zones, effort scoring, and recovery context."
          style={styles.header}
        />

        <KineticPanel>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Age</Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 30"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={3}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Height ({isImperial ? 'inches' : 'cm'})
        </Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={height}
          onChangeText={setHeight}
          placeholder={isImperial ? 'e.g. 69' : 'e.g. 175'}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          maxLength={5}
        />

        <Text style={[styles.label, { color: colors.textSecondary }]}>
          Weight ({isImperial ? 'lbs' : 'kg'})
        </Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={weight}
          onChangeText={setWeight}
          placeholder={isImperial ? 'e.g. 154' : 'e.g. 70'}
          placeholderTextColor={colors.textSecondary}
          keyboardType="decimal-pad"
          maxLength={5}
        />

        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>Heart Rate</Text>

        <Text style={[styles.label, { color: colors.textSecondary }]}>Max Heart Rate (bpm)</Text>
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          Used to calculate your heart rate zones during workouts.
        </Text>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground, borderColor: colors.border }]}
          value={maxHR}
          onChangeText={setMaxHR}
          placeholder="185"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={3}
        />

        {estimatedMaxHR !== null && parseInt(maxHR, 10) !== estimatedMaxHR && (
          <TouchableOpacity onPress={handleResetMaxHR} style={styles.resetRow}>
            <Text style={[styles.resetText, { color: colors.primary }]}>
              Reset to age-based estimate ({estimatedMaxHR} bpm)
            </Text>
          </TouchableOpacity>
        )}
        </KineticPanel>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, (!hasChanges || isSaving) && styles.disabled]}
          onPress={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Text style={[styles.saveText, { color: colors.surface }]}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
    marginTop: 28,
    marginLeft: 4,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    marginBottom: 6,
    marginTop: 12,
  },
  helpText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 14,
    fontFamily: Fonts.body,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resetRow: {
    marginTop: 8,
  },
  resetText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  saveButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 32,
  },
  disabled: {
    opacity: 0.5,
  },
  saveText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
  },
});
