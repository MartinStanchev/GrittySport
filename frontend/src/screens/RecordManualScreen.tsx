import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { formatTime } from '../constants/workoutUtils';
import { getActivity, saveWorkout } from '../services/api';
import { isGPSActivity } from '../constants/activityIcons';
import {
  useWorkout,
  type WorkoutType,
  type ExerciseLog,
  type MobilityExerciseLog,
} from '../contexts/WorkoutContext';
import { useProgram } from '../contexts/ProgramContext';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function parseDurationToSeconds(duration: string | undefined): number {
  if (!duration) return 60;
  const match = String(duration).match(/(\d+)\s*(min|sec|s|m)?/i);
  if (!match) return 60;
  const val = parseInt(match[1], 10);
  const unit = (match[2] || 'm').toLowerCase();
  return unit.startsWith('s') ? val : val * 60;
}

function inferWorkoutType(type: string): WorkoutType {
  const t = type.toLowerCase();
  if (t.includes('strength') || t.includes('weight')) return 'strength';
  if (t.includes('mobility') || t.includes('yoga') || t.includes('recovery') || t.includes('stretch')) return 'mobility';
  return 'drill';
}

const BLANK_STRENGTH: ExerciseLog[] = [
  { name: '', sets: [{ reps: '', weight: '', rpe: '', completed: false }] },
];

const BLANK_MOBILITY: MobilityExerciseLog[] = [
  { name: '', targetDurationSeconds: 60, remainingSeconds: 60, timerActive: false, completed: false },
];

const DISPLAY_TYPE_LABELS: Record<string, string> = {
  strength: 'Strength Training',
  mobility: 'Mobility / Recovery',
  drill: 'Sport-Specific Drill',
  indoor_run: 'Indoor Run',
  indoor_cycling: 'Indoor Cycling',
};

// ─────────────────────────────────────────────
// TYPE SELECTOR
// ─────────────────────────────────────────────

interface TypeOption {
  activityType: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  desc: string;
}

const GPS_OPTIONS: TypeOption[] = [
  { activityType: 'run', icon: 'walk-outline', label: 'Run', desc: 'Outdoor run with GPS tracking' },
  { activityType: 'walk', icon: 'walk-outline', label: 'Walk', desc: 'Walk or hike with GPS tracking' },
  { activityType: 'cycling', icon: 'bicycle-outline', label: 'Cycling', desc: 'Outdoor cycling with GPS tracking' },
];

const INDOOR_OPTIONS: TypeOption[] = [
  { activityType: 'indoor_run', icon: 'walk-outline', label: 'Indoor Run', desc: 'Treadmill or indoor track' },
  { activityType: 'indoor_cycling', icon: 'bicycle-outline', label: 'Indoor Cycling', desc: 'Stationary bike or spin class' },
  { activityType: 'strength', icon: 'barbell-outline', label: 'Strength', desc: 'Log sets, reps, and weight' },
  { activityType: 'mobility', icon: 'body-outline', label: 'Mobility', desc: 'Timed exercises with countdowns' },
  { activityType: 'drill', icon: 'flag-outline', label: 'Drill', desc: 'Drill session with notes' },
];

function TypeSelector({
  onSelectManual,
  onSelectGPS,
}: {
  onSelectManual: (activityType: string) => void;
  onSelectGPS: (activityType: string) => void;
}) {
  return (
    <View style={styles.typeSelectorContainer}>
      <Text style={styles.typeSectionHeader}>Outdoor</Text>
      {GPS_OPTIONS.map((opt) => (
        <Pressable key={opt.activityType} style={styles.typeOption} onPress={() => onSelectGPS(opt.activityType)}>
          <View style={[styles.typeIconCircle, styles.typeIconGPS]}>
            <Ionicons name={opt.icon} size={24} color={Colors.primary} />
          </View>
          <View style={styles.typeOptionText}>
            <View style={styles.typeOptionTitleRow}>
              <Text style={styles.typeOptionLabel}>{opt.label}</Text>
              <View style={styles.gpsBadge}><Text style={styles.gpsBadgeText}>GPS</Text></View>
            </View>
            <Text style={styles.typeOptionDesc}>{opt.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </Pressable>
      ))}

      <Text style={[styles.typeSectionHeader, { marginTop: 16 }]}>Indoor & Gym</Text>
      {INDOOR_OPTIONS.map((opt) => (
        <Pressable key={opt.activityType} style={styles.typeOption} onPress={() => onSelectManual(opt.activityType)}>
          <View style={styles.typeIconCircle}>
            <Ionicons name={opt.icon} size={24} color={Colors.primary} />
          </View>
          <View style={styles.typeOptionText}>
            <Text style={styles.typeOptionLabel}>{opt.label}</Text>
            <Text style={styles.typeOptionDesc}>{opt.desc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
        </Pressable>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────
// STRENGTH LOGGER
// ─────────────────────────────────────────────

function StrengthLogger({
  exercises,
  onChange,
  onRest,
}: {
  exercises: ExerciseLog[];
  onChange: (exercises: ExerciseLog[]) => void;
  onRest: (restSeconds: number) => void;
}) {
  function updateExercise(idx: number, updated: ExerciseLog) {
    onChange(exercises.map((e, i) => (i === idx ? updated : e)));
  }

  function addSet(exIdx: number) {
    const ex = exercises[exIdx];
    const prev = ex.sets[ex.sets.length - 1];
    const newSet = { reps: prev?.reps ?? '', weight: prev?.weight ?? '', rpe: prev?.rpe ?? '', completed: false };
    updateExercise(exIdx, { ...ex, sets: [...ex.sets, newSet] });
  }

  function updateSet(exIdx: number, setIdx: number, field: keyof typeof exercises[0]['sets'][0], value: string | boolean) {
    const ex = exercises[exIdx];
    updateExercise(exIdx, { ...ex, sets: ex.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)) });
  }

  function removeSet(exIdx: number, setIdx: number) {
    const ex = exercises[exIdx];
    updateExercise(exIdx, { ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) });
  }

  return (
    <View>
      {exercises.map((ex, exIdx) => (
        <View key={exIdx} style={styles.exerciseBlock}>
          <View style={styles.exerciseHeader}>
            <TextInput
              style={styles.exerciseNameInput}
              value={ex.name}
              onChangeText={(t) => updateExercise(exIdx, { ...ex, name: t })}
              placeholder="Exercise name"
              placeholderTextColor={Colors.textSecondary}
            />
            {exercises.length > 1 && (
              <Pressable onPress={() => onChange(exercises.filter((_, i) => i !== exIdx))} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={16} color="#999" />
              </Pressable>
            )}
          </View>

          {(ex.targetSets || ex.targetReps || ex.targetWeight) && (
            <Text style={styles.targetLabel}>
              Target: {ex.targetSets} sets × {ex.targetReps}
              {ex.targetWeight ? ` @ ${ex.targetWeight}` : ''}
              {ex.targetRpe ? ` RPE ${ex.targetRpe}` : ''}
            </Text>
          )}

          <View style={styles.setTableHeader}>
            <Text style={[styles.setCell, styles.setHeaderText, { flex: 0.4 }]}>Set</Text>
            <Text style={[styles.setCell, styles.setHeaderText]}>Reps</Text>
            <Text style={[styles.setCell, styles.setHeaderText]}>Weight</Text>
            <Text style={[styles.setCell, styles.setHeaderText, { flex: 0.6 }]}>RPE</Text>
            <View style={{ width: 52 }} />
          </View>

          {ex.sets.map((set, setIdx) => (
            <View key={setIdx} style={[styles.setRow, set.completed && styles.setRowDone]}>
              <Text style={[styles.setCell, { flex: 0.4, color: Colors.textSecondary }]}>{setIdx + 1}</Text>
              <TextInput
                style={[styles.setCell, styles.setInput]}
                value={set.reps}
                onChangeText={(t) => updateSet(exIdx, setIdx, 'reps', t)}
                keyboardType="number-pad"
                placeholder={ex.targetReps || '-'}
                placeholderTextColor="#CCC"
              />
              <TextInput
                style={[styles.setCell, styles.setInput]}
                value={set.weight}
                onChangeText={(t) => updateSet(exIdx, setIdx, 'weight', t)}
                keyboardType="decimal-pad"
                placeholder={ex.targetWeight || 'kg'}
                placeholderTextColor="#CCC"
              />
              <TextInput
                style={[styles.setCell, styles.setInput, { flex: 0.6 }]}
                value={set.rpe}
                onChangeText={(t) => updateSet(exIdx, setIdx, 'rpe', t)}
                keyboardType="number-pad"
                placeholder="-"
                placeholderTextColor="#CCC"
                maxLength={2}
              />
              <View style={styles.setActions}>
                <Pressable
                  style={styles.doneBtn}
                  onPress={() => updateSet(exIdx, setIdx, 'completed', !set.completed)}
                >
                  <Ionicons
                    name={set.completed ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={set.completed ? Colors.primary : '#CCC'}
                  />
                </Pressable>
                <Pressable onPress={() => removeSet(exIdx, setIdx)} style={styles.removeMiniBtn}>
                  <Ionicons name="close" size={14} color="#CCC" />
                </Pressable>
              </View>
            </View>
          ))}

          <View style={styles.exerciseFooter}>
            <Pressable style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
              <Ionicons name="add" size={14} color={Colors.primary} />
              <Text style={styles.addSetText}>Add Set</Text>
            </Pressable>
            <Pressable style={styles.restBtn} onPress={() => onRest(ex.restSeconds ?? 90)}>
              <Ionicons name="timer-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.restBtnText}>Rest</Text>
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable style={styles.addExerciseBtn} onPress={() => onChange([...exercises, { name: '', sets: [{ reps: '', weight: '', rpe: '', completed: false }] }])}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addExerciseText}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────
// MOBILITY LOGGER
// ─────────────────────────────────────────────

function MobilityLogger({
  exercises,
  onChange,
}: {
  exercises: MobilityExerciseLog[];
  onChange: (exercises: MobilityExerciseLog[]) => void;
}) {
  function toggleTimer(idx: number) {
    onChange(exercises.map((ex, i) => {
      if (i === idx) return { ...ex, timerActive: !ex.timerActive };
      return { ...ex, timerActive: false };
    }));
  }

  function markComplete(idx: number) {
    onChange(exercises.map((ex, i) =>
      i === idx ? { ...ex, completed: !ex.completed, timerActive: false } : ex
    ));
  }

  return (
    <View>
      {exercises.map((ex, idx) => (
        <View key={idx} style={[styles.exerciseBlock, ex.completed && styles.exerciseBlockDone]}>
          <TextInput
            style={styles.exerciseNameInput}
            value={ex.name}
            onChangeText={(t) => onChange(exercises.map((e, i) => (i === idx ? { ...e, name: t } : e)))}
            placeholder="Exercise name"
            placeholderTextColor={Colors.textSecondary}
            editable={!ex.completed}
          />
          {ex.targetDurationSeconds > 0 && (
            <Text style={styles.targetLabel}>Target: {formatTime(ex.targetDurationSeconds)}</Text>
          )}
          <View style={styles.mobilityTimerRow}>
            <Text style={styles.mobilityTimerText}>{formatTime(ex.remainingSeconds)}</Text>
            <Pressable
              style={[styles.startTimerBtn, ex.timerActive && styles.startTimerBtnActive]}
              onPress={() => toggleTimer(idx)}
              disabled={ex.completed}
            >
              <Ionicons name={ex.timerActive ? 'pause' : 'play'} size={16} color="#FFF" />
              <Text style={styles.startTimerBtnText}>{ex.timerActive ? 'Pause' : 'Start'}</Text>
            </Pressable>
            <Pressable style={styles.doneExBtn} onPress={() => markComplete(idx)}>
              <Ionicons
                name={ex.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={26}
                color={ex.completed ? Colors.primary : '#CCC'}
              />
            </Pressable>
          </View>
        </View>
      ))}

      <Pressable
        style={styles.addExerciseBtn}
        onPress={() => onChange([...exercises, { name: '', targetDurationSeconds: 60, remainingSeconds: 60, timerActive: false, completed: false }])}
      >
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addExerciseText}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

// ─────────────────────────────────────────────
// DRILL LOGGER
// ─────────────────────────────────────────────

function DrillLogger({
  drillName,
  drillDescription,
  notes,
  onNotesChange,
}: {
  drillName: string;
  drillDescription: string;
  notes: string;
  onNotesChange: (t: string) => void;
}) {
  return (
    <View>
      {drillName ? (
        <View style={styles.drillCard}>
          <Text style={styles.drillName}>{drillName}</Text>
          {drillDescription ? <Text style={styles.drillDesc}>{drillDescription}</Text> : null}
        </View>
      ) : null}
      <Text style={styles.sectionLabel}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={onNotesChange}
        placeholder="What did you do? Any observations?"
        placeholderTextColor={Colors.textSecondary}
        multiline
        textAlignVertical="top"
      />
    </View>
  );
}

// ─────────────────────────────────────────────
// REST TIMER MODAL
// ─────────────────────────────────────────────

function RestTimerModal({ visible, seconds, onClose }: { visible: boolean; seconds: number; onClose: () => void }) {
  const [remaining, setRemaining] = useState(seconds);
  const [active, setActive] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (visible) { setRemaining(seconds); setActive(true); }
  }, [visible, seconds]);

  useEffect(() => {
    if (active && remaining > 0) {
      intervalRef.current = setInterval(() => setRemaining((r) => r - 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (remaining === 0) onClose();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [active, remaining]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.restModalOverlay}>
        <View style={styles.restModalBox}>
          <Text style={styles.restModalTitle}>Rest</Text>
          <Text style={styles.restModalTimer}>{formatTime(remaining)}</Text>
          <View style={styles.restModalActions}>
            <Pressable style={styles.restModalPause} onPress={() => setActive(!active)}>
              <Text style={styles.restModalPauseText}>{active ? 'Pause' : 'Resume'}</Text>
            </Pressable>
            <Pressable style={styles.restModalSkip} onPress={onClose}>
              <Text style={styles.restModalSkipText}>Skip Rest</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────

function WorkoutSummary({
  workoutType,
  elapsedSeconds,
  strengthExercises,
  mobilityExercises,
  drillNotes,
  notes,
  onNotesChange,
  onSave,
  onDiscard,
  isSaving,
}: {
  workoutType: WorkoutType;
  elapsedSeconds: number;
  strengthExercises: ExerciseLog[];
  mobilityExercises: MobilityExerciseLog[];
  drillNotes: string;
  notes: string;
  onNotesChange: (t: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  isSaving: boolean;
}) {
  return (
    <View>
      <View style={styles.summaryHeader}>
        <Ionicons name="checkmark-circle" size={48} color={Colors.primary} />
        <Text style={styles.summaryTitle}>Workout Complete!</Text>
        <Text style={styles.summaryTime}>{formatTime(elapsedSeconds)}</Text>
        <Text style={styles.summaryTimeLabel}>Total Time</Text>
      </View>

      {workoutType === 'strength' && (
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Exercises Logged</Text>
          {strengthExercises.map((ex, i) => (
            <View key={i} style={styles.summaryExRow}>
              <Text style={styles.summaryExName}>{ex.name || `Exercise ${i + 1}`}</Text>
              <Text style={styles.summaryExDetail}>
                {ex.sets.filter((s) => s.completed).length}/{ex.sets.length} sets
              </Text>
            </View>
          ))}
        </View>
      )}

      {workoutType === 'mobility' && (
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Exercises Completed</Text>
          {mobilityExercises.map((ex, i) => (
            <View key={i} style={styles.summaryExRow}>
              <Text style={styles.summaryExName}>{ex.name || `Exercise ${i + 1}`}</Text>
              <Ionicons
                name={ex.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={18}
                color={ex.completed ? Colors.primary : '#CCC'}
              />
            </View>
          ))}
        </View>
      )}

      {workoutType === 'drill' && drillNotes ? (
        <View style={styles.summarySection}>
          <Text style={styles.summarySectionTitle}>Your Notes</Text>
          <Text style={styles.summaryNotePreview}>{drillNotes}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>Additional Notes</Text>
      <TextInput
        style={styles.notesInput}
        value={notes}
        onChangeText={onNotesChange}
        placeholder="Any additional notes about this workout?"
        placeholderTextColor={Colors.textSecondary}
        multiline
        textAlignVertical="top"
      />

      <View style={styles.summaryBtns}>
        <Pressable style={styles.discardBtn} onPress={onDiscard} disabled={isSaving}>
          <Text style={styles.discardBtnText}>Discard</Text>
        </Pressable>
        <Pressable style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]} onPress={onSave} disabled={isSaving}>
          {isSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Save Workout</Text>}
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// MAIN SCREEN
// ─────────────────────────────────────────────

export default function RecordManualScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { scheduledActivityId, activityType: paramActivityType } = route.params ?? {};

  const { activeWorkout, startWorkout, updateWorkout, clearWorkout, workoutMode } = useWorkout();
  const { notifyProgramDataChanged } = useProgram();

  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [isSaving, setIsSaving] = useState(false);

  // Elapsed timer — always derived from startedAt
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!activeWorkout || activeWorkout.phase !== 'recording') return;
    const tick = () => setElapsed(Math.floor((Date.now() - activeWorkout.startedAt.getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout?.startedAt, activeWorkout?.phase]);

  // Mobility countdown timers
  useEffect(() => {
    if (!activeWorkout || activeWorkout.phase !== 'recording' || activeWorkout.workoutType !== 'mobility') return;
    if (!activeWorkout.mobilityExercises.some((e) => e.timerActive)) return;
    const interval = setInterval(() => {
      updateWorkout({
        mobilityExercises: activeWorkout.mobilityExercises.map((ex) => {
          if (!ex.timerActive) return ex;
          const next = ex.remainingSeconds - 1;
          return next <= 0
            ? { ...ex, remainingSeconds: 0, timerActive: false, completed: true }
            : { ...ex, remainingSeconds: next };
        }),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout?.mobilityExercises]);

  // On mount: if no active workout, start one (from params or wait for type-select)
  useEffect(() => {
    if (workoutMode === 'gps') {
      Alert.alert(
        'GPS Workout In Progress',
        'You have a GPS workout in progress. Finish it before starting a new workout.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    if (activeWorkout) return; // resume existing

    if (!scheduledActivityId && !paramActivityType) return; // type-select will handle it

    // If the param type is a GPS activity, redirect to RecordGPS
    if (paramActivityType && isGPSActivity(paramActivityType)) {
      navigation.replace('RecordGPS', { activityType: paramActivityType });
      return;
    }

    if (scheduledActivityId) {
      setIsLoadingActivity(true);
      getActivity(scheduledActivityId)
        .then((detail) => {
          const type = inferWorkoutType(detail.activity_type);
          const [strength, mobility, drill] = buildPrescriptionState(type, detail.prescription);
          startWorkout({
            workoutType: type,
            activityDisplayType: detail.activity_type,
            scheduledActivityId,
            startedAt: new Date(),
            strengthExercises: strength,
            mobilityExercises: mobility,
            drillName: drill.name,
            drillDescription: drill.description,
            drillNotes: '',
          });
        })
        .catch(() => {})
        .finally(() => setIsLoadingActivity(false));
    } else if (paramActivityType) {
      const type = inferWorkoutType(paramActivityType);
      startWorkout({
        workoutType: type,
        activityDisplayType: paramActivityType,
        startedAt: new Date(),
        strengthExercises: BLANK_STRENGTH,
        mobilityExercises: BLANK_MOBILITY,
        drillName: '',
        drillDescription: '',
        drillNotes: '',
      });
    }
  }, []); // run once on mount

  function buildPrescriptionState(type: WorkoutType, prescription: Record<string, any>): [ExerciseLog[], MobilityExerciseLog[], { name: string; description: string }] {
    const strength: ExerciseLog[] = type === 'strength' && (prescription.exercises ?? []).length > 0
      ? prescription.exercises.map((ex: any) => ({
          name: ex.name || '',
          targetSets: ex.sets,
          targetReps: ex.reps ? String(ex.reps) : undefined,
          targetWeight: ex.weight ? String(ex.weight) : undefined,
          targetRpe: ex.rpe ? String(ex.rpe) : undefined,
          restSeconds: ex.rest_seconds ?? 90,
          sets: Array.from({ length: ex.sets || 1 }, () => ({ reps: '', weight: '', rpe: '', completed: false })),
        }))
      : BLANK_STRENGTH;

    const mobility: MobilityExerciseLog[] = type === 'mobility' && (prescription.exercises ?? []).length > 0
      ? prescription.exercises.map((ex: any) => {
          const secs = parseDurationToSeconds(ex.duration);
          return { name: ex.name || '', targetDurationSeconds: secs, remainingSeconds: secs, timerActive: false, completed: false };
        })
      : BLANK_MOBILITY;

    const drill = type === 'drill'
      ? { name: prescription.drill_name || prescription.name || '', description: prescription.description || '' }
      : { name: '', description: '' };

    return [strength, mobility, drill];
  }

  function handleManualTypeSelect(activityType: string) {
    const type = inferWorkoutType(activityType);
    startWorkout({
      workoutType: type,
      activityDisplayType: DISPLAY_TYPE_LABELS[activityType] ?? activityType,
      startedAt: new Date(),
      strengthExercises: BLANK_STRENGTH,
      mobilityExercises: BLANK_MOBILITY,
      drillName: '',
      drillDescription: '',
      drillNotes: '',
    });
  }

  function buildRecordedData(): Record<string, any> {
    if (!activeWorkout) return {};
    if (activeWorkout.workoutType === 'strength') {
      return {
        exercises: activeWorkout.strengthExercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets.map((s) => ({
            reps: s.reps ? parseInt(s.reps, 10) : null,
            weight: s.weight ? parseFloat(s.weight) : null,
            rpe: s.rpe ? parseFloat(s.rpe) : null,
            completed: s.completed,
          })),
        })),
      };
    }
    if (activeWorkout.workoutType === 'mobility') {
      return {
        exercises: activeWorkout.mobilityExercises.map((ex) => ({
          name: ex.name,
          completed: ex.completed,
          duration_seconds: ex.targetDurationSeconds - ex.remainingSeconds,
        })),
      };
    }
    return { notes: activeWorkout.drillNotes };
  }

  function handleFinishWorkout() {
    updateWorkout({ phase: 'summary', finishedAt: new Date() });
  }

  async function handleSave() {
    if (!activeWorkout) return;
    setIsSaving(true);
    try {
      await saveWorkout({
        scheduled_activity_id: activeWorkout.scheduledActivityId,
        activity_type: activeWorkout.activityDisplayType,
        recorded_data: buildRecordedData(),
        source: 'manual',
        started_at: activeWorkout.startedAt.toISOString(),
        finished_at: activeWorkout.finishedAt?.toISOString(),
        notes: activeWorkout.workoutNotes || undefined,
      });
      clearWorkout();
      notifyProgramDataChanged();
      navigation.navigate('HomeMain');
    } catch {
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    Alert.alert('Discard Workout', 'Are you sure you want to discard this workout? Your data will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard', style: 'destructive', onPress: () => {
          clearWorkout();
          navigation.goBack();
        }
      },
    ]);
  }

  if (isLoadingActivity) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  const phase = !activeWorkout ? 'type-select' : activeWorkout.phase;
  const elapsedSeconds = activeWorkout?.phase === 'summary' && activeWorkout.finishedAt
    ? Math.floor((activeWorkout.finishedAt.getTime() - activeWorkout.startedAt.getTime()) / 1000)
    : elapsed;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Timer bar — only shown while recording */}
      {phase === 'recording' && (
        <View style={styles.timerBar}>
          <View>
            <Text style={styles.timerLabel}>ELAPSED</Text>
            <Text style={styles.timerValue}>{formatTime(elapsedSeconds)}</Text>
          </View>
          <Pressable style={styles.finishBtn} onPress={handleFinishWorkout}>
            <Text style={styles.finishBtnText}>Finish Workout</Text>
          </Pressable>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {activeWorkout?.scheduledActivityId && phase === 'recording' && (
          <View style={styles.activityBanner}>
            <Text style={styles.activityBannerLabel}>Logging against</Text>
            <Text style={styles.activityBannerName}>{activeWorkout.activityDisplayType}</Text>
          </View>
        )}

        {phase === 'type-select' && (
          <TypeSelector
            onSelectManual={handleManualTypeSelect}
            onSelectGPS={(activityType) => navigation.navigate('RecordGPS', { activityType })}
          />
        )}

        {phase === 'recording' && activeWorkout?.workoutType === 'strength' && (
          <StrengthLogger
            exercises={activeWorkout.strengthExercises}
            onChange={(ex) => updateWorkout({ strengthExercises: ex })}
            onRest={(secs) => { setRestTimerSeconds(secs); setRestTimerVisible(true); }}
          />
        )}

        {phase === 'recording' && activeWorkout?.workoutType === 'mobility' && (
          <MobilityLogger
            exercises={activeWorkout.mobilityExercises}
            onChange={(ex) => updateWorkout({ mobilityExercises: ex })}
          />
        )}

        {phase === 'recording' && activeWorkout?.workoutType === 'drill' && (
          <DrillLogger
            drillName={activeWorkout.drillName}
            drillDescription={activeWorkout.drillDescription}
            notes={activeWorkout.drillNotes}
            onNotesChange={(t) => updateWorkout({ drillNotes: t })}
          />
        )}

        {phase === 'summary' && activeWorkout && (
          <WorkoutSummary
            workoutType={activeWorkout.workoutType}
            elapsedSeconds={elapsedSeconds}
            strengthExercises={activeWorkout.strengthExercises}
            mobilityExercises={activeWorkout.mobilityExercises}
            drillNotes={activeWorkout.drillNotes}
            notes={activeWorkout.workoutNotes}
            onNotesChange={(t) => updateWorkout({ workoutNotes: t })}
            onSave={handleSave}
            onDiscard={handleDiscard}
            isSaving={isSaving}
          />
        )}
      </ScrollView>

      <RestTimerModal
        visible={restTimerVisible}
        seconds={restTimerSeconds}
        onClose={() => setRestTimerVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
  timerBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  timerLabel: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700', letterSpacing: 1 },
  timerValue: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'] },
  finishBtn: { backgroundColor: Colors.primary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20 },
  finishBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  activityBanner: {
    backgroundColor: '#FEF0F0',
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  activityBannerLabel: { fontSize: 11, color: Colors.primary, fontWeight: '700', letterSpacing: 0.5 },
  activityBannerName: { fontSize: 14, color: Colors.textPrimary, fontWeight: '600', marginTop: 2 },

  typeSelectorContainer: { paddingTop: 4 },
  typeSectionHeader: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: 14,
    padding: 16, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  typeIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FEF0F0', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  typeIconGPS: { backgroundColor: Colors.primary + '14' },
  typeOptionText: { flex: 1 },
  typeOptionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeOptionLabel: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  typeOptionDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  gpsBadge: { backgroundColor: Colors.primary + '18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  gpsBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.primary, letterSpacing: 0.5 },

  exerciseBlock: {
    backgroundColor: Colors.surface, borderRadius: 14, padding: 14, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  exerciseBlockDone: { opacity: 0.6 },
  exerciseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  exerciseNameInput: {
    flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
    borderBottomWidth: 1, borderBottomColor: '#E0E0E0', paddingBottom: 4,
  },
  removeBtn: { padding: 6, marginLeft: 8 },
  targetLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8, fontStyle: 'italic' },

  setTableHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  setHeaderText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  setRowDone: { backgroundColor: '#F8FFF8' },
  setCell: { flex: 1, fontSize: 14, color: Colors.textPrimary },
  setInput: {
    borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4,
    marginHorizontal: 2, fontSize: 14, color: Colors.textPrimary, textAlign: 'center', minHeight: 32,
  },
  setActions: { flexDirection: 'row', alignItems: 'center', width: 52, justifyContent: 'flex-end' },
  doneBtn: { padding: 2 },
  removeMiniBtn: { padding: 4, marginLeft: 2 },
  exerciseFooter: { flexDirection: 'row', marginTop: 10, gap: 8 },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FEF0F0' },
  addSetText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  restBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F5F5F5' },
  restBtnText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  addExerciseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.primary, marginTop: 4 },
  addExerciseText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },

  mobilityTimerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12 },
  mobilityTimerText: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'], minWidth: 70 },
  startTimerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.textSecondary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  startTimerBtnActive: { backgroundColor: Colors.primary },
  startTimerBtnText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  doneExBtn: { marginLeft: 'auto' },

  drillCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginBottom: 16 },
  drillName: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  drillDesc: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, lineHeight: 20 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  notesInput: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, fontSize: 15, color: Colors.textPrimary, minHeight: 100, borderWidth: 1, borderColor: '#E0E0E0' },

  restModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  restModalBox: { backgroundColor: Colors.surface, borderRadius: 20, padding: 32, alignItems: 'center', width: 260 },
  restModalTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  restModalTimer: { fontSize: 56, fontWeight: '700', color: Colors.textPrimary, fontVariant: ['tabular-nums'], marginBottom: 24 },
  restModalActions: { gap: 10, width: '100%' },
  restModalPause: { backgroundColor: '#F0F0F0', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  restModalPauseText: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  restModalSkip: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  restModalSkipText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  summaryHeader: { alignItems: 'center', paddingVertical: 24 },
  summaryTitle: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginTop: 12 },
  summaryTime: { fontSize: 40, fontWeight: '700', color: Colors.primary, marginTop: 8, fontVariant: ['tabular-nums'] },
  summaryTimeLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  summarySection: { backgroundColor: Colors.surface, borderRadius: 14, padding: 16, marginBottom: 16 },
  summarySectionTitle: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  summaryExRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F0' },
  summaryExName: { fontSize: 15, color: Colors.textPrimary, fontWeight: '500' },
  summaryExDetail: { fontSize: 14, color: Colors.textSecondary },
  summaryNotePreview: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  summaryBtns: { flexDirection: 'row', gap: 12, marginTop: 24, marginBottom: 16 },
  discardBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E0E0E0', alignItems: 'center' },
  discardBtnText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primary, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
