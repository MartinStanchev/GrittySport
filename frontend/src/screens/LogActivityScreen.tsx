import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { getActivityIcon } from '../constants/activityIcons';
import { saveWorkout, getUpcomingActivities, linkWorkoutToActivity } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type LogType = 'run' | 'walk' | 'cycling' | 'indoor_cycling' | 'indoor_run' | 'swim' | 'strength' | 'mobility' | 'drill';

interface SetLog {
  reps: string;
  weight: string;
}
interface ExerciseLog {
  name: string;
  sets: SetLog[];
}
interface MobilityExLog {
  name: string;
  durationSeconds: string;
  completed: boolean;
}

const TYPE_OPTIONS: { type: LogType; label: string }[] = [
  { type: 'run', label: 'Run' },
  { type: 'walk', label: 'Walk' },
  { type: 'cycling', label: 'Cycling' },
  { type: 'indoor_run', label: 'Indoor Run' },
  { type: 'indoor_cycling', label: 'Indoor Cycling' },
  { type: 'swim', label: 'Swimming' },
  { type: 'strength', label: 'Strength' },
  { type: 'mobility', label: 'Mobility' },
  { type: 'drill', label: 'Drill' },
];

const DISPLAY_LABELS: Record<LogType, string> = {
  run: 'Running',
  walk: 'Walking',
  cycling: 'Cycling',
  indoor_run: 'Indoor Run',
  indoor_cycling: 'Indoor Cycling',
  swim: 'Swimming',
  strength: 'Strength Training',
  mobility: 'Mobility / Yoga',
  drill: 'Sport Drill',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function offsetDate(offset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d;
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildRecordedData(
  type: LogType,
  dist: number,
  durationSec: number,
  laps: string,
  exercises: ExerciseLog[],
  mobilityExercises: MobilityExLog[],
): Record<string, unknown> {
  if (type === 'run' || type === 'walk' || type === 'indoor_run') {
    const avgPaceSec = dist > 0 && durationSec > 0 ? Math.round(durationSec / dist) : 0;
    return { distance_km: dist || 0, avg_pace_sec_per_km: avgPaceSec };
  }
  if (type === 'cycling' || type === 'indoor_cycling') {
    const avgSpeed = dist > 0 && durationSec > 0 ? Math.round((dist / durationSec) * 3600 * 10) / 10 : 0;
    return { distance_km: dist || 0, avg_speed_kph: avgSpeed };
  }
  if (type === 'swim') {
    return { distance_m: dist || 0, ...(laps ? { laps: parseInt(laps, 10) } : {}) };
  }
  if (type === 'strength') {
    return {
      exercises: exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets.map((s) => ({ reps: parseInt(s.reps || '0', 10), weight: parseFloat(s.weight || '0') })),
      })),
    };
  }
  if (type === 'mobility') {
    return {
      exercises: mobilityExercises.map((ex) => ({
        name: ex.name,
        duration_seconds: parseInt(ex.durationSeconds || '0', 10),
        completed: ex.completed,
      })),
    };
  }
  return {};
}

function formatPace(paceSecPerKm: number): string {
  if (!paceSecPerKm) return '—';
  const m = Math.floor(paceSecPerKm / 60);
  const s = paceSecPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TypeSelector({ onSelect, colors }: { onSelect: (t: LogType) => void; colors: ThemeColors }) {
  return (
    <View style={styles.typeGrid}>
      {TYPE_OPTIONS.map(({ type, label }) => (
        <Pressable
          key={type}
          style={[styles.typeCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
          onPress={() => onSelect(type)}
        >
          <Ionicons name={getActivityIcon(type)} size={28} color={colors.primary} />
          <Text style={[styles.typeCardLabel, { color: colors.textPrimary }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ExerciseEditor({
  exercises,
  onChange,
  colors,
}: {
  exercises: ExerciseLog[];
  onChange: (ex: ExerciseLog[]) => void;
  colors: ThemeColors;
}) {
  function addExercise() {
    onChange([...exercises, { name: '', sets: [{ reps: '', weight: '' }] }]);
  }
  function removeExercise(i: number) {
    onChange(exercises.filter((_, idx) => idx !== i));
  }
  function updateName(i: number, name: string) {
    const next = [...exercises];
    next[i] = { ...next[i], name };
    onChange(next);
  }
  function addSet(i: number) {
    const next = [...exercises];
    next[i] = { ...next[i], sets: [...next[i].sets, { reps: '', weight: '' }] };
    onChange(next);
  }
  function updateSet(ei: number, si: number, field: 'reps' | 'weight', val: string) {
    const next = [...exercises];
    const sets = [...next[ei].sets];
    sets[si] = { ...sets[si], [field]: val };
    next[ei] = { ...next[ei], sets };
    onChange(next);
  }

  return (
    <View>
      {exercises.map((ex, i) => (
        <View key={i} style={[styles.exerciseBlock, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <View style={styles.exHeader}>
            <TextInput
              style={[styles.input, styles.exNameInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder="Exercise name"
              placeholderTextColor={colors.textSecondary}
              value={ex.name}
              onChangeText={(t) => updateName(i, t)}
            />
            <Pressable onPress={() => removeExercise(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.setHeaderRow}>
            <Text style={[styles.setColLabel, { flex: 2, color: colors.textSecondary }]}>Reps</Text>
            <Text style={[styles.setColLabel, { flex: 2, color: colors.textSecondary }]}>Weight (kg)</Text>
          </View>
          {ex.sets.map((s, si) => (
            <View key={si} style={styles.setRow}>
              <TextInput
                style={[styles.input, styles.setInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={s.reps}
                onChangeText={(v) => updateSet(i, si, 'reps', v)}
              />
              <TextInput
                style={[styles.input, styles.setInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={s.weight}
                onChangeText={(v) => updateSet(i, si, 'weight', v)}
              />
            </View>
          ))}
          <Pressable style={styles.addSetBtn} onPress={() => addSet(i)}>
            <Ionicons name="add" size={14} color={colors.primary} />
            <Text style={[styles.addSetLabel, { color: colors.primary }]}>Add Set</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addExerciseBtn} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addExerciseLabel, { color: colors.primary }]}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

function MobilityEditor({
  exercises,
  onChange,
  colors,
}: {
  exercises: MobilityExLog[];
  onChange: (ex: MobilityExLog[]) => void;
  colors: ThemeColors;
}) {
  function addExercise() {
    onChange([...exercises, { name: '', durationSeconds: '', completed: false }]);
  }
  function removeExercise(i: number) {
    onChange(exercises.filter((_, idx) => idx !== i));
  }
  function update(i: number, patch: Partial<MobilityExLog>) {
    const next = [...exercises];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  }

  return (
    <View>
      {exercises.map((ex, i) => (
        <View key={i} style={[styles.exerciseBlock, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
          <View style={styles.exHeader}>
            <TextInput
              style={[styles.input, styles.exNameInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder="Exercise name"
              placeholderTextColor={colors.textSecondary}
              value={ex.name}
              onChangeText={(t) => update(i, { name: t })}
            />
            <Pressable onPress={() => removeExercise(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.mobilityRow}>
            <TextInput
              style={[styles.input, styles.durationInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder="Duration (sec)"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={ex.durationSeconds}
              onChangeText={(t) => update(i, { durationSeconds: t })}
            />
            <Pressable
              style={[styles.completedToggle, { backgroundColor: colors.surfaceAlt }, ex.completed && { backgroundColor: colors.primaryLight }]}
              onPress={() => update(i, { completed: !ex.completed })}
            >
              <Ionicons
                name={ex.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={ex.completed ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.completedLabel, { color: colors.textSecondary }, ex.completed && { color: colors.primary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={styles.addExerciseBtn} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addExerciseLabel, { color: colors.primary }]}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<any, 'LogActivity'>;

export default function LogActivityScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const { notifyProgramDataChanged } = useProgram();
  const [selectedType, setSelectedType] = useState<LogType | null>(null);
  const [dateOffset, setDateOffset] = useState(0); // 0 = today, -1 = yesterday, etc.
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [laps, setLaps] = useState('');
  const [exercises, setExercises] = useState<ExerciseLog[]>([{ name: '', sets: [{ reps: '', weight: '' }] }]);
  const [mobilityExercises, setMobilityExercises] = useState<MobilityExLog[]>([
    { name: '', durationSeconds: '', completed: false },
  ]);
  const [saving, setSaving] = useState(false);

  const date = offsetDate(dateOffset);
  const durationSec = (parseInt(hours || '0', 10) * 3600) + (parseInt(minutes || '0', 10) * 60);

  // Auto-computed stats
  const dist = parseFloat(distanceKm);
  const isPaceType = selectedType === 'run' || selectedType === 'walk' || selectedType === 'indoor_run';
  const isSpeedType = selectedType === 'cycling' || selectedType === 'indoor_cycling';
  const avgPaceSec = isPaceType && dist > 0 && durationSec > 0
    ? Math.round(durationSec / dist) : 0;
  const avgSpeed = isSpeedType && dist > 0 && durationSec > 0
    ? Math.round((dist / durationSec) * 3600 * 10) / 10 : 0;

  async function handleSave() {
    if (!selectedType) return;
    if (!hours && !minutes) {
      Alert.alert('Duration required', 'Please enter the duration of your workout.');
      return;
    }
    setSaving(true);
    try {
      const startedAt = new Date(date);
      startedAt.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
      const finishedAt = new Date(startedAt.getTime() + durationSec * 1000);
      const recordedData = buildRecordedData(selectedType, dist, durationSec, laps, exercises, mobilityExercises);

      const savedWorkout = await saveWorkout({
        activity_type: selectedType,
        recorded_data: recordedData,
        source: 'manual',
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        notes: notes.trim() || undefined,
      });
      notifyProgramDataChanged();
      navigation.goBack();

      // Offer to link to today's scheduled activity
      try {
        const today = new Date().toISOString().split('T')[0];
        const activities = await getUpcomingActivities();
        const todayActivity = activities.find((a) => a.date === today);
        if (todayActivity) {
          const label = todayActivity.activity_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
          Alert.alert(
            'Link to Program?',
            `Link this workout to your "${label}" activity?`,
            [
              { text: 'Skip', style: 'cancel' },
              { text: 'Link', onPress: () => linkWorkoutToActivity(savedWorkout.id, todayActivity.id) },
            ]
          );
        }
      } catch { /* ignore */ }
    } catch {
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedType) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.typeSelectorContent}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>What did you do?</Text>
        <TypeSelector onSelect={setSelectedType} colors={colors} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

        {/* Activity type badge */}
        <View style={[styles.typeBadge, { backgroundColor: colors.surface }]}>
          <Ionicons name={getActivityIcon(selectedType)} size={20} color={colors.primary} />
          <Text style={[styles.typeBadgeLabel, { color: colors.textPrimary }]}>{DISPLAY_LABELS[selectedType]}</Text>
          <Pressable onPress={() => setSelectedType(null)} style={[styles.changeTypeBtn, { backgroundColor: colors.background }]}>
            <Text style={[styles.changeTypeLabel, { color: colors.primary }]}>Change</Text>
          </Pressable>
        </View>

        {/* Date */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date</Text>
          <View style={[styles.dateRow, { backgroundColor: colors.surface }]}>
            <Pressable style={styles.dateArrow} onPress={() => setDateOffset(dateOffset - 1)}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Text style={[styles.dateText, { color: colors.textPrimary }]}>{formatDisplayDate(date)}</Text>
            <Pressable
              style={styles.dateArrow}
              onPress={() => setDateOffset(Math.min(0, dateOffset + 1))}
              disabled={dateOffset >= 0}
            >
              <Ionicons name="chevron-forward" size={20} color={dateOffset >= 0 ? colors.textSecondary : colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Duration</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={hours}
                onChangeText={setHours}
                maxLength={2}
              />
              <Text style={[styles.durationUnit, { color: colors.textSecondary }]}>h</Text>
            </View>
            <View style={styles.durationField}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={minutes}
                onChangeText={setMinutes}
                maxLength={2}
              />
              <Text style={[styles.durationUnit, { color: colors.textSecondary }]}>min</Text>
            </View>
          </View>
        </View>

        {/* Type-specific fields */}
        {(isPaceType || isSpeedType) && (
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Distance (km)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder="0.0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="decimal-pad"
              value={distanceKm}
              onChangeText={setDistanceKm}
            />
            {isPaceType && avgPaceSec > 0 && (
              <Text style={[styles.computedStat, { color: colors.primary }]}>Avg pace: {formatPace(avgPaceSec)}</Text>
            )}
            {isSpeedType && avgSpeed > 0 && (
              <Text style={[styles.computedStat, { color: colors.primary }]}>Avg speed: {avgSpeed} km/h</Text>
            )}
          </View>
        )}

        {selectedType === 'swim' && (
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Distance (m)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={distanceKm}
              onChangeText={setDistanceKm}
            />
            <Text style={[styles.fieldLabel, { marginTop: 12, color: colors.textSecondary }]}>Laps (optional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
              placeholder="0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={laps}
              onChangeText={setLaps}
            />
          </View>
        )}

        {selectedType === 'strength' && (
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Exercises</Text>
            <ExerciseEditor exercises={exercises} onChange={setExercises} colors={colors} />
          </View>
        )}

        {selectedType === 'mobility' && (
          <View style={styles.fieldBlock}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Exercises</Text>
            <MobilityEditor exercises={mobilityExercises} onChange={setMobilityExercises} colors={colors} />
          </View>
        )}

        {/* Notes */}
        <View style={styles.fieldBlock}>
          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
            placeholder="How did it go?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnLabel}>{saving ? 'Saving...' : 'Save Activity'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  typeSelectorContent: {
    padding: 20,
  },
  formContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '46%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  typeCardLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    borderRadius: 10,
    padding: 12,
  },
  typeBadgeLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  changeTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  changeTypeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  dateArrow: {
    padding: 8,
  },
  dateText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  durationUnit: {
    fontSize: 15,
    fontWeight: '600',
  },
  computedStat: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
  },
  exerciseBlock: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  exHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  exNameInput: {
    flex: 1,
    padding: 8,
  },
  removeBtn: {
    padding: 4,
  },
  setHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  setColLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  setRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  setInput: {
    flex: 1,
    padding: 8,
    textAlign: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingVertical: 4,
  },
  addSetLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  addExerciseLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  mobilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  durationInput: {
    flex: 1,
    padding: 8,
  },
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: 8,
  },
  completedLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
