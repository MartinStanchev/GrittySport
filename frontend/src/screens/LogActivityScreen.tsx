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
import { Colors } from '../constants/colors';
import { getActivityIcon } from '../constants/activityIcons';
import { saveWorkout } from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type LogType = 'run' | 'cycling' | 'swim' | 'strength' | 'mobility' | 'drill';

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
  { type: 'run', label: 'Running' },
  { type: 'cycling', label: 'Cycling' },
  { type: 'swim', label: 'Swimming' },
  { type: 'strength', label: 'Strength' },
  { type: 'mobility', label: 'Mobility' },
  { type: 'drill', label: 'Drill' },
];

const DISPLAY_LABELS: Record<LogType, string> = {
  run: 'Running',
  cycling: 'Cycling',
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
  if (type === 'run') {
    const avgPaceSec = dist > 0 && durationSec > 0 ? Math.round(durationSec / dist) : 0;
    return { distance_km: dist || 0, avg_pace_sec_per_km: avgPaceSec };
  }
  if (type === 'cycling') {
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

function TypeSelector({ onSelect }: { onSelect: (t: LogType) => void }) {
  return (
    <View style={styles.typeGrid}>
      {TYPE_OPTIONS.map(({ type, label }) => (
        <Pressable key={type} style={styles.typeCard} onPress={() => onSelect(type)}>
          <Ionicons name={getActivityIcon(type)} size={28} color={Colors.primary} />
          <Text style={styles.typeCardLabel}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ExerciseEditor({
  exercises,
  onChange,
}: {
  exercises: ExerciseLog[];
  onChange: (ex: ExerciseLog[]) => void;
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
        <View key={i} style={styles.exerciseBlock}>
          <View style={styles.exHeader}>
            <TextInput
              style={[styles.input, styles.exNameInput]}
              placeholder="Exercise name"
              placeholderTextColor={Colors.textSecondary}
              value={ex.name}
              onChangeText={(t) => updateName(i, t)}
            />
            <Pressable onPress={() => removeExercise(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.setHeaderRow}>
            <Text style={[styles.setColLabel, { flex: 2 }]}>Reps</Text>
            <Text style={[styles.setColLabel, { flex: 2 }]}>Weight (kg)</Text>
          </View>
          {ex.sets.map((s, si) => (
            <View key={si} style={styles.setRow}>
              <TextInput
                style={[styles.input, styles.setInput]}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                value={s.reps}
                onChangeText={(v) => updateSet(i, si, 'reps', v)}
              />
              <TextInput
                style={[styles.input, styles.setInput]}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
                value={s.weight}
                onChangeText={(v) => updateSet(i, si, 'weight', v)}
              />
            </View>
          ))}
          <Pressable style={styles.addSetBtn} onPress={() => addSet(i)}>
            <Ionicons name="add" size={14} color={Colors.primary} />
            <Text style={styles.addSetLabel}>Add Set</Text>
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addExerciseBtn} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addExerciseLabel}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

function MobilityEditor({
  exercises,
  onChange,
}: {
  exercises: MobilityExLog[];
  onChange: (ex: MobilityExLog[]) => void;
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
        <View key={i} style={styles.exerciseBlock}>
          <View style={styles.exHeader}>
            <TextInput
              style={[styles.input, styles.exNameInput]}
              placeholder="Exercise name"
              placeholderTextColor={Colors.textSecondary}
              value={ex.name}
              onChangeText={(t) => update(i, { name: t })}
            />
            <Pressable onPress={() => removeExercise(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.mobilityRow}>
            <TextInput
              style={[styles.input, styles.durationInput]}
              placeholder="Duration (sec)"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={ex.durationSeconds}
              onChangeText={(t) => update(i, { durationSeconds: t })}
            />
            <Pressable
              style={[styles.completedToggle, ex.completed && styles.completedToggleOn]}
              onPress={() => update(i, { completed: !ex.completed })}
            >
              <Ionicons
                name={ex.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={ex.completed ? Colors.primary : Colors.textSecondary}
              />
              <Text style={[styles.completedLabel, ex.completed && { color: Colors.primary }]}>Done</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={styles.addExerciseBtn} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addExerciseLabel}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<any, 'LogActivity'>;

export default function LogActivityScreen({ navigation }: Props) {
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
  const avgPaceSec = selectedType === 'run' && dist > 0 && durationSec > 0
    ? Math.round(durationSec / dist) : 0;
  const avgSpeed = selectedType === 'cycling' && dist > 0 && durationSec > 0
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

      await saveWorkout({
        activity_type: selectedType,
        recorded_data: recordedData,
        source: 'manual',
        started_at: startedAt.toISOString(),
        finished_at: finishedAt.toISOString(),
        notes: notes.trim() || undefined,
      });
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save activity. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!selectedType) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.typeSelectorContent}>
        <Text style={styles.sectionTitle}>What did you do?</Text>
        <TypeSelector onSelect={setSelectedType} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">

        {/* Activity type badge */}
        <View style={styles.typeBadge}>
          <Ionicons name={getActivityIcon(selectedType)} size={20} color={Colors.primary} />
          <Text style={styles.typeBadgeLabel}>{DISPLAY_LABELS[selectedType]}</Text>
          <Pressable onPress={() => setSelectedType(null)} style={styles.changeTypeBtn}>
            <Text style={styles.changeTypeLabel}>Change</Text>
          </Pressable>
        </View>

        {/* Date */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Date</Text>
          <View style={styles.dateRow}>
            <Pressable style={styles.dateArrow} onPress={() => setDateOffset(dateOffset - 1)}>
              <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.dateText}>{formatDisplayDate(date)}</Text>
            <Pressable
              style={styles.dateArrow}
              onPress={() => setDateOffset(Math.min(0, dateOffset + 1))}
              disabled={dateOffset >= 0}
            >
              <Ionicons name="chevron-forward" size={20} color={dateOffset >= 0 ? Colors.textSecondary : Colors.textPrimary} />
            </Pressable>
          </View>
        </View>

        {/* Duration */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Duration</Text>
          <View style={styles.durationRow}>
            <View style={styles.durationField}>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                value={hours}
                onChangeText={setHours}
                maxLength={2}
              />
              <Text style={styles.durationUnit}>h</Text>
            </View>
            <View style={styles.durationField}>
              <TextInput
                style={styles.input}
                placeholder="0"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="numeric"
                value={minutes}
                onChangeText={setMinutes}
                maxLength={2}
              />
              <Text style={styles.durationUnit}>min</Text>
            </View>
          </View>
        </View>

        {/* Type-specific fields */}
        {(selectedType === 'run' || selectedType === 'cycling') && (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Distance (km)</Text>
            <TextInput
              style={styles.input}
              placeholder="0.0"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
              value={distanceKm}
              onChangeText={setDistanceKm}
            />
            {selectedType === 'run' && avgPaceSec > 0 && (
              <Text style={styles.computedStat}>Avg pace: {formatPace(avgPaceSec)}</Text>
            )}
            {selectedType === 'cycling' && avgSpeed > 0 && (
              <Text style={styles.computedStat}>Avg speed: {avgSpeed} km/h</Text>
            )}
          </View>
        )}

        {selectedType === 'swim' && (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Distance (m)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={distanceKm}
              onChangeText={setDistanceKm}
            />
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Laps (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="numeric"
              value={laps}
              onChangeText={setLaps}
            />
          </View>
        )}

        {selectedType === 'strength' && (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Exercises</Text>
            <ExerciseEditor exercises={exercises} onChange={setExercises} />
          </View>
        )}

        {selectedType === 'mobility' && (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Exercises</Text>
            <MobilityEditor exercises={mobilityExercises} onChange={setMobilityExercises} />
          </View>
        )}

        {/* Notes */}
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Notes (optional)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="How did it go?"
            placeholderTextColor={Colors.textSecondary}
            multiline
            numberOfLines={3}
            value={notes}
            onChangeText={setNotes}
          />
        </View>

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
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
    backgroundColor: Colors.background,
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
    color: Colors.textPrimary,
    marginBottom: 20,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    width: '46%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  typeCardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
  },
  typeBadgeLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  changeTypeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  changeTypeLabel: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  fieldBlock: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
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
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  computedStat: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
  exerciseBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
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
    color: Colors.textSecondary,
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
    color: Colors.primary,
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
    color: Colors.primary,
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
    backgroundColor: Colors.background,
  },
  completedToggleOn: {
    backgroundColor: '#FEE2E5',
  },
  completedLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
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
