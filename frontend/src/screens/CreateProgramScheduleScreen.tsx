import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { PrescriptionEditor } from '../components/PrescriptionEditor';
import StepIndicator from '../components/StepIndicator';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_VALUES = [1, 2, 3, 4, 5, 6, 0]; // Mon=1 .. Sat=6, Sun=0

const ACTIVITY_TYPES = [
  'Easy Run', 'Long Run', 'Tempo Run', 'Interval Training',
  'Strength', 'Cycling', 'Swimming', 'Yoga',
  'Mobility', 'Recovery', 'Cross Training', 'Rest',
];

interface TemplateActivity {
  day_of_week: number;
  activity_type: string;
  prescription: Record<string, any>;
  notes?: string;
  order_index: number;
}

interface Phase {
  name: string;
  order_index: number;
  duration_weeks: number;
  template_week: { activities: TemplateActivity[] };
}

interface EditingActivity {
  phaseIndex: number;
  activityIndex: number | null; // null = new activity
  dayOfWeek: number;
  activity_type: string;
  prescription: Record<string, any>;
  notes: string;
}

interface Props {
  navigation: any;
  route: any;
}

const DEFAULT_PHASE: Phase = {
  name: 'Training', order_index: 0, duration_weeks: 4, template_week: { activities: [] },
};

export default function CreateProgramScheduleScreen({ navigation, route }: Props) {
  const { name, sport, goal, startDate, phases: initialPhases } = route.params;
  const insets = useSafeAreaInsets();

  const [phases, setPhases] = useState<Phase[]>(initialPhases ?? [DEFAULT_PHASE]);
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [editing, setEditing] = useState<EditingActivity | null>(null);
  const [renamingPhase, setRenamingPhase] = useState<number | null>(null);
  const [renameText, setRenameText] = useState('');

  // Save schedule state back to Basics screen when navigating away
  const isNavigatingRef = useRef(false);
  const phasesRef = useRef(phases);
  phasesRef.current = phases;

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e: any) => {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      e.preventDefault();
      navigation.navigate('CreateProgramBasics', { phases: phasesRef.current });
    });
  }, [navigation]);

  const selectedPhase = phases[selectedPhaseIdx];

  const updatePhase = useCallback((index: number, updater: (p: Phase) => Phase) => {
    setPhases(prev => prev.map((p, i) => (i === index ? updater(p) : p)));
  }, []);

  const addPhase = useCallback(() => {
    setPhases(prev => [
      ...prev,
      {
        name: `Phase ${prev.length + 1}`,
        order_index: prev.length,
        duration_weeks: 4,
        template_week: { activities: [] },
      },
    ]);
    setSelectedPhaseIdx(phases.length);
  }, [phases.length]);

  const deletePhase = useCallback((index: number) => {
    if (phases.length <= 1) return;
    Alert.alert('Delete Phase', `Delete "${phases[index].name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPhases(prev => {
            const updated = prev.filter((_, i) => i !== index)
              .map((p, i) => ({ ...p, order_index: i }));
            return updated;
          });
          setSelectedPhaseIdx(prev => Math.min(prev, phases.length - 2));
        },
      },
    ]);
  }, [phases]);

  const applyPreset = useCallback(() => {
    const totalWeeks = 12;
    setPhases([
      { name: 'Base', order_index: 0, duration_weeks: Math.ceil(totalWeeks * 0.4), template_week: { activities: [] } },
      { name: 'Build', order_index: 1, duration_weeks: Math.ceil(totalWeeks * 0.35), template_week: { activities: [] } },
      { name: 'Peak', order_index: 2, duration_weeks: totalWeeks - Math.ceil(totalWeeks * 0.4) - Math.ceil(totalWeeks * 0.35), template_week: { activities: [] } },
    ]);
    setSelectedPhaseIdx(0);
  }, []);

  const startRename = useCallback((index: number) => {
    setRenamingPhase(index);
    setRenameText(phases[index].name);
  }, [phases]);

  const confirmRename = useCallback(() => {
    if (renamingPhase !== null && renameText.trim()) {
      updatePhase(renamingPhase, p => ({ ...p, name: renameText.trim() }));
    }
    setRenamingPhase(null);
  }, [renamingPhase, renameText, updatePhase]);

  const getActivitiesForDay = (dayOfWeek: number): TemplateActivity[] => {
    return selectedPhase.template_week.activities
      .filter(a => a.day_of_week === dayOfWeek)
      .sort((a, b) => a.order_index - b.order_index);
  };

  const openNewActivity = (dayOfWeek: number) => {
    setEditing({
      phaseIndex: selectedPhaseIdx,
      activityIndex: null,
      dayOfWeek,
      activity_type: '',
      prescription: {},
      notes: '',
    });
  };

  const openEditActivity = (actIndex: number, act: TemplateActivity) => {
    setEditing({
      phaseIndex: selectedPhaseIdx,
      activityIndex: actIndex,
      dayOfWeek: act.day_of_week,
      activity_type: act.activity_type,
      prescription: typeof act.prescription === 'object' ? { ...act.prescription } : {},
      notes: act.notes || '',
    });
  };

  const saveActivity = () => {
    if (!editing || !editing.activity_type) return;
    updatePhase(editing.phaseIndex, p => {
      const activities = [...p.template_week.activities];
      if (editing.activityIndex !== null) {
        activities[editing.activityIndex] = {
          day_of_week: editing.dayOfWeek,
          activity_type: editing.activity_type,
          prescription: editing.prescription,
          notes: editing.notes || undefined,
          order_index: activities[editing.activityIndex].order_index,
        };
      } else {
        activities.push({
          day_of_week: editing.dayOfWeek,
          activity_type: editing.activity_type,
          prescription: editing.prescription,
          notes: editing.notes || undefined,
          order_index: activities.filter(a => a.day_of_week === editing.dayOfWeek).length,
        });
      }
      return { ...p, template_week: { activities } };
    });
    setEditing(null);
  };

  const deleteActivity = () => {
    if (!editing || editing.activityIndex === null) return;
    updatePhase(editing.phaseIndex, p => ({
      ...p,
      template_week: {
        activities: p.template_week.activities.filter((_, i) => i !== editing.activityIndex),
      },
    }));
    setEditing(null);
  };

  const totalWeeks = phases.reduce((sum, p) => sum + p.duration_weeks, 0);
  const hasActivities = phases.some(p => p.template_week.activities.length > 0);

  const handleReview = () => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + totalWeeks * 7 - 1);
    const endDate = end.toISOString().split('T')[0];

    navigation.navigate('CreateProgramReview', {
      name,
      sport,
      goal,
      startDate,
      endDate,
      phases,
    });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        <StepIndicator current={2} total={3} />

        {/* Phase tabs */}
        <View style={styles.phaseSection}>
          <View style={styles.phaseHeader}>
            <Text style={styles.sectionLabel}>Phases</Text>
            <Pressable style={styles.presetButton} onPress={applyPreset}>
              <Text style={styles.presetButtonText}>Base / Build / Peak</Text>
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.phaseTabs}>
            {phases.map((phase, i) => (
              <Pressable
                key={i}
                style={[styles.phaseTab, i === selectedPhaseIdx && styles.phaseTabActive]}
                onPress={() => setSelectedPhaseIdx(i)}
                onLongPress={() => deletePhase(i)}
              >
                <Pressable onPress={() => startRename(i)}>
                  <Text style={[styles.phaseTabText, i === selectedPhaseIdx && styles.phaseTabTextActive]}>
                    {phase.name}
                  </Text>
                </Pressable>
                <Text style={[styles.phaseTabWeeks, i === selectedPhaseIdx && styles.phaseTabWeeksActive]}>
                  {phase.duration_weeks}w
                </Text>
              </Pressable>
            ))}
            <Pressable style={styles.addPhaseButton} onPress={addPhase}>
              <Ionicons name="add" size={20} color={Colors.primary} />
            </Pressable>
          </ScrollView>

          {/* Duration stepper */}
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Duration</Text>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperButton}
                onPress={() =>
                  updatePhase(selectedPhaseIdx, p => ({
                    ...p,
                    duration_weeks: Math.max(1, p.duration_weeks - 1),
                  }))
                }
              >
                <Ionicons name="remove" size={18} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.stepperValue}>{selectedPhase.duration_weeks} weeks</Text>
              <Pressable
                style={styles.stepperButton}
                onPress={() =>
                  updatePhase(selectedPhaseIdx, p => ({
                    ...p,
                    duration_weeks: p.duration_weeks + 1,
                  }))
                }
              >
                <Ionicons name="add" size={18} color={Colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Weekly template grid */}
        <Text style={styles.sectionLabel}>Weekly Template</Text>
        <Text style={styles.sectionHint}>This pattern repeats for {selectedPhase.duration_weeks} weeks</Text>

        {DAY_LABELS.map((dayLabel, i) => {
          const dayValue = DAY_VALUES[i];
          const dayActivities = getActivitiesForDay(dayValue);
          return (
            <View key={dayLabel} style={styles.dayRow}>
              <View style={styles.dayLabelContainer}>
                <Text style={styles.dayLabel}>{dayLabel}</Text>
              </View>
              <View style={styles.dayContent}>
                {dayActivities.map((act, actIdx) => {
                  const globalIdx = selectedPhase.template_week.activities.indexOf(act);
                  return (
                    <Pressable
                      key={actIdx}
                      style={styles.activityChip}
                      onPress={() => openEditActivity(globalIdx, act)}
                    >
                      <Text style={styles.activityChipText} numberOfLines={1}>
                        {act.activity_type}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                    </Pressable>
                  );
                })}
                <Pressable style={styles.addActivityButton} onPress={() => openNewActivity(dayValue)}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={styles.addActivityText}>Add</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerInfo}>{totalWeeks} weeks total</Text>
        <Pressable
          style={[styles.reviewButton, !hasActivities && styles.reviewButtonDisabled]}
          onPress={handleReview}
          disabled={!hasActivities}
        >
          <Text style={styles.reviewButtonText}>Review</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      </View>

      {/* Rename phase modal */}
      <Modal visible={renamingPhase !== null} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={confirmRename}>
          <View style={styles.renameModal}>
            <Text style={styles.renameTitle}>Rename Phase</Text>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
              onSubmitEditing={confirmRename}
              selectTextOnFocus
            />
            <Pressable style={styles.renameButton} onPress={confirmRename}>
              <Text style={styles.renameButtonText}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Activity editor bottom sheet */}
      <Modal visible={editing !== null} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setEditing(null)}>
            <Pressable style={[styles.bottomSheet, { paddingBottom: insets.bottom + 20 }]} onPress={e => e.stopPropagation()}>
              <View style={styles.sheetHandle} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.sheetTitle}>
                {editing?.activityIndex !== null ? 'Edit Activity' : 'Add Activity'}
              </Text>
              <Text style={styles.sheetDay}>
                {editing ? DAY_LABELS[DAY_VALUES.indexOf(editing.dayOfWeek)] : ''}
              </Text>

              <Text style={styles.sheetLabel}>Activity Type</Text>
              <View style={styles.typeChipsWrap}>
                {ACTIVITY_TYPES.map(item => (
                  <Pressable
                    key={item}
                    style={[styles.typeChip, editing?.activity_type === item && styles.typeChipActive]}
                    onPress={() => setEditing(prev => prev ? { ...prev, activity_type: item } : null)}
                  >
                    <Text style={[styles.typeChipText, editing?.activity_type === item && styles.typeChipTextActive]}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {editing?.activity_type ? (
                <>
                  <Text style={styles.sheetLabel}>Prescription</Text>
                  <PrescriptionEditor
                    activityType={editing.activity_type}
                    prescription={editing.prescription}
                    onChange={p => setEditing(prev => prev ? { ...prev, prescription: p } : null)}
                  />

                  <Text style={styles.sheetLabel}>Notes (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="Any additional notes..."
                    placeholderTextColor="#BBB"
                    value={editing.notes}
                    onChangeText={t => setEditing(prev => prev ? { ...prev, notes: t } : null)}
                    multiline
                  />
                </>
              ) : null}

              <View style={styles.sheetActions}>
                {editing?.activityIndex !== null && (
                  <Pressable style={styles.deleteButton} onPress={deleteActivity}>
                    <Ionicons name="trash-outline" size={18} color={Colors.primary} />
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                )}
                <Pressable
                  style={[styles.saveButton, !editing?.activity_type && styles.saveButtonDisabled]}
                  onPress={saveActivity}
                  disabled={!editing?.activity_type}
                >
                  <Text style={styles.saveButtonText}>
                    {editing?.activityIndex !== null ? 'Update' : 'Add'}
                  </Text>
                </Pressable>
              </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 12,
    marginTop: -4,
  },

  // Phase section
  phaseSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  presetButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FEE8EA',
  },
  presetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  phaseTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  phaseTab: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phaseTabActive: {
    backgroundColor: Colors.primary,
  },
  phaseTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  phaseTabTextActive: {
    color: '#FFF',
  },
  phaseTabWeeks: {
    fontSize: 12,
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  phaseTabWeeksActive: {
    color: '#FFF',
    opacity: 0.8,
  },
  addPhaseButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  durationLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 70,
    textAlign: 'center',
  },

  // Day rows
  dayRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 6,
    overflow: 'hidden',
  },
  dayLabelContainer: {
    width: 50,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
  },
  dayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  dayContent: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    gap: 6,
    alignItems: 'center',
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE8EA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  activityChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  addActivityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  addActivityText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: Colors.surface,
  },
  footerInfo: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  reviewButtonDisabled: {
    opacity: 0.4,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Modal / bottom sheet
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sheetDay: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
  },
  typeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    minHeight: 50,
    textAlignVertical: 'top',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },

  // Rename modal
  renameModal: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 40,
    marginBottom: 'auto',
    marginTop: 'auto',
  },
  renameTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  renameInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  renameButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.primary,
  },
  renameButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
