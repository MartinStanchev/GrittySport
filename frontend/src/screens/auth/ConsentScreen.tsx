import { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { Fonts } from '../../constants/fonts';
import { LEGAL_URLS } from '../../constants/legalUrls';
import { ConsentVersions } from '../../constants/consents';
import { recordConsents } from '../../services/api';
import type { ConsentInput } from '../../services/api';

type ConsentKey = 'terms_privacy' | 'health_data' | 'age_16_plus' | 'marketing';

const REQUIRED_KEYS: ConsentKey[] = ['terms_privacy', 'health_data', 'age_16_plus'];

export default function ConsentScreen() {
  const { colors } = useTheme();
  const { signOut, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [checked, setChecked] = useState<Record<ConsentKey, boolean>>({
    terms_privacy: false,
    health_data: false,
    age_16_plus: false,
    marketing: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  function toggle(key: ConsentKey) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() =>
      Alert.alert('Error', 'Could not open the page. Please try again later.'),
    );
  }

  const allRequiredAccepted = REQUIRED_KEYS.every((k) => checked[k]);

  async function handleContinue() {
    if (!allRequiredAccepted) return;

    const consents: ConsentInput[] = [
      { type: 'terms', version: ConsentVersions.terms },
      { type: 'privacy', version: ConsentVersions.privacy },
      { type: 'health_data', version: ConsentVersions.health_data },
      { type: 'age_16_plus', version: ConsentVersions.age_16_plus },
    ];
    if (checked.marketing) {
      consents.push({ type: 'marketing', version: ConsentVersions.marketing });
    }

    setIsSaving(true);
    try {
      await recordConsents(consents);
      await refreshUser();
    } catch {
      Alert.alert('Error', 'Could not save your choices. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome to Gritty Fitness</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Before we get you set up, please review and accept the following. We need this so we can run the app legally and so you know how we handle your data.
        </Text>

        <ConsentRow
          label="I accept the Terms of Service and have read the Privacy Policy."
          required
          checked={checked.terms_privacy}
          onToggle={() => toggle('terms_privacy')}
          colors={colors}
        >
          <View style={styles.linkRow}>
            <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.terms)}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Read Terms</Text>
            </TouchableOpacity>
            <Text style={[styles.linkSeparator, { color: colors.textSecondary }]}>·</Text>
            <TouchableOpacity onPress={() => openUrl(LEGAL_URLS.privacy)}>
              <Text style={[styles.linkText, { color: colors.primary }]}>Read Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </ConsentRow>

        <ConsentRow
          label="I explicitly consent to the processing of my health data (e.g. heart rate, training performance, body measurements) to provide the personalized training features."
          required
          checked={checked.health_data}
          onToggle={() => toggle('health_data')}
          colors={colors}
        />

        <ConsentRow
          label="I am at least 16 years old."
          required
          checked={checked.age_16_plus}
          onToggle={() => toggle('age_16_plus')}
          colors={colors}
        />

        <ConsentRow
          label="I'd like to occasionally receive emails with tips, new features, and offers."
          checked={checked.marketing}
          onToggle={() => toggle('marketing')}
          colors={colors}
        />

        <TouchableOpacity
          style={[
            styles.continueButton,
            { backgroundColor: colors.primary },
            (!allRequiredAccepted || isSaving) && styles.disabled,
          ]}
          onPress={handleContinue}
          disabled={!allRequiredAccepted || isSaving}
        >
          <Text style={[styles.continueText, { color: colors.surface }]}>
            {isSaving ? 'Saving...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutLink} onPress={signOut} disabled={isSaving}>
          <Text style={[styles.signOutText, { color: colors.textSecondary }]}>Use a different account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ConsentRow({
  label,
  required,
  checked,
  onToggle,
  colors,
  children,
}: {
  label: string;
  required?: boolean;
  checked: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  children?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderColor: colors.border }]}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? colors.primary : colors.border, backgroundColor: checked ? colors.primary : 'transparent' },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={18} color={colors.surface} />}
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>
          {label}
          {required ? <Text style={{ color: colors.primary }}> *</Text> : null}
        </Text>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.heading,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.body,
    lineHeight: 22,
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'ios' ? 1 : 0,
  },
  rowBody: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  linkText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  linkSeparator: {
    fontSize: 13,
  },
  continueButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  continueText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
  },
  disabled: {
    opacity: 0.5,
  },
  signOutLink: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontFamily: Fonts.body,
  },
});
