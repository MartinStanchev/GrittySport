import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

const CONFIRM_PHRASE = 'delete';

const REMOVED_ITEMS = [
  'Your profile, settings, and preferences',
  'All training programs and scheduled activities',
  'All recorded and imported workouts',
  "Your full chat history with Grit and everything Grit remembers about you",
  'Connected devices and notification preferences',
];

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteAccountModal({ visible, onClose, onConfirm }: DeleteAccountModalProps) {
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setInput('');
      setError(null);
      setSubmitting(false);
    }
  }, [visible]);

  const canConfirm = input.trim().toLowerCase() === CONFIRM_PHRASE && !submitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError('Could not delete your account. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={submitting ? undefined : onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: `${colors.error}22` }]}>
            <Ionicons name="warning" size={24} color={colors.error} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>Delete account</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This is permanent and cannot be undone. We will remove:
          </Text>

          <View style={styles.list}>
            {REMOVED_ITEMS.map((item) => (
              <View key={item} style={styles.listRow}>
                <Ionicons name="ellipse" size={6} color={colors.textSecondary} style={styles.bullet} />
                <Text style={[styles.listText, { color: colors.textPrimary }]}>{item}</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Type <Text style={[styles.labelStrong, { color: colors.textPrimary }]}>{CONFIRM_PHRASE}</Text> to confirm.
          </Text>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!submitting}
            style={[styles.input, {
              color: colors.textPrimary,
              backgroundColor: colors.inputBackground,
              borderColor: colors.border,
            }]}
          />

          {error && (
            <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { borderColor: colors.border }]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={[styles.cancelText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                { backgroundColor: colors.error },
                !canConfirm && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmText}>Delete forever</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 22,
    padding: 24,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.headingMedium,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
    marginBottom: 12,
  },
  list: {
    marginBottom: 20,
    gap: 8,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  bullet: {
    marginTop: 7,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    marginBottom: 6,
  },
  labelStrong: {
    fontFamily: Fonts.bodySemiBold,
  },
  input: {
    fontSize: 16,
    borderWidth: 1,
    borderRadius: 14,
    fontFamily: Fonts.body,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  error: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  confirmButtonDisabled: {
    opacity: 0.45,
  },
  confirmText: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    color: '#FFFFFF',
  },
});
