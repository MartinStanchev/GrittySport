import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { updateProgramCriteria } from '../services/api';
import type { CriterionResponse, CriterionInput } from '../services/api';

interface CriteriaEditorModalProps {
  visible: boolean;
  programId: string;
  criteria: CriterionResponse[];
  onClose: () => void;
  onSaved: () => void;
}

export function CriteriaEditorModal({
  visible,
  programId,
  criteria,
  onClose,
  onSaved,
}: CriteriaEditorModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [editedCriteria, setEditedCriteria] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      const initial: Record<string, string> = {};
      criteria.forEach((c) => {
        initial[c.key] = c.value;
      });
      setEditedCriteria(initial);
    }
  }, [visible, criteria]);

  const handleChange = useCallback((key: string, value: string) => {
    setEditedCriteria((prev) => ({ ...prev, [key]: value }));
  }, []);

  const hasChanges = criteria.some((c) => editedCriteria[c.key] !== c.value);

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const input: CriterionInput[] = criteria.map((c) => ({
        key: c.key,
        label: c.label,
        value: editedCriteria[c.key] ?? c.value,
        value_type: c.value_type,
        display_order: c.display_order,
      }));

      await updateProgramCriteria(programId, input);
      onSaved();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save criteria');
    } finally {
      setSaving(false);
    }
  }, [criteria, editedCriteria, hasChanges, programId, onClose, onSaved]);

  const getKeyboardType = (valueType: string) => {
    if (valueType === 'number') return 'numeric' as const;
    return 'default' as const;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Edit Program Settings</Text>
          <Pressable onPress={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.saveText,
                  { color: colors.primary },
                  !hasChanges && styles.saveTextDisabled,
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
          keyboardShouldPersistTaps="handled"
        >
          {criteria.map((c) => (
            <View key={c.key} style={styles.fieldContainer}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{c.label}</Text>
              <TextInput
                style={[styles.fieldInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border }]}
                value={editedCriteria[c.key] ?? c.value}
                onChangeText={(text) => handleChange(c.key, text)}
                keyboardType={getKeyboardType(c.value_type)}
                placeholder={c.label}
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          ))}

          {hasChanges && (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              After saving, Grit will review the changes and suggest adjustments to your program.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveTextDisabled: {
    opacity: 0.4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  hint: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
});
