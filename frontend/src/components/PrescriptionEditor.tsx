import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

interface Props {
  activityType: string;
  prescription: Record<string, any>;
  onChange: (updated: Record<string, any>) => void;
}

function FieldInput({
  label,
  value,
  onChangeText,
  keyboardType = 'default',
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder || label}
        placeholderTextColor="#BBB"
      />
    </View>
  );
}

function updateField(prescription: Record<string, any>, key: string, value: string, onChange: Props['onChange']) {
  onChange({ ...prescription, [key]: value });
}

function RunEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  return (
    <View>
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} />
      <FieldInput label="Pace" value={prescription.pace || ''} onChangeText={v => updateField(prescription, 'pace', v, onChange)} />
      <FieldInput label="HR Zone" value={prescription.heart_rate_zone || ''} onChangeText={v => updateField(prescription, 'heart_rate_zone', v, onChange)} />
      <FieldInput label="Terrain" value={prescription.terrain || ''} onChangeText={v => updateField(prescription, 'terrain', v, onChange)} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
    </View>
  );
}

function IntervalEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  const intervals: any[] = Array.isArray(prescription.intervals) ? prescription.intervals : [];

  const updateInterval = (index: number, key: string, value: string) => {
    const updated = [...intervals];
    updated[index] = { ...updated[index], [key]: value };
    onChange({ ...prescription, intervals: updated });
  };

  const addInterval = () => {
    onChange({ ...prescription, intervals: [...intervals, { distance: '', pace: '', rest: '' }] });
  };

  const removeInterval = (index: number) => {
    const updated = intervals.filter((_, i) => i !== index);
    onChange({ ...prescription, intervals: updated });
  };

  return (
    <View>
      <FieldInput label="Warmup" value={prescription.warmup || ''} onChangeText={v => updateField(prescription, 'warmup', v, onChange)} />
      <Text style={styles.sectionTitle}>Intervals</Text>
      {intervals.map((interval: any, i: number) => (
        <View key={i} style={styles.intervalRow}>
          <Text style={styles.intervalLabel}>Set {i + 1}</Text>
          <View style={styles.intervalFields}>
            <TextInput style={styles.intervalInput} value={interval.distance || ''} onChangeText={v => updateInterval(i, 'distance', v)} placeholder="Distance" placeholderTextColor="#BBB" />
            <TextInput style={styles.intervalInput} value={interval.pace || ''} onChangeText={v => updateInterval(i, 'pace', v)} placeholder="Pace" placeholderTextColor="#BBB" />
            <TextInput style={styles.intervalInput} value={interval.rest || ''} onChangeText={v => updateInterval(i, 'rest', v)} placeholder="Rest" placeholderTextColor="#BBB" />
          </View>
          <Pressable onPress={() => removeInterval(i)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={Colors.primary} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addInterval}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addButtonText}>Add Interval</Text>
      </Pressable>
      <FieldInput label="Cooldown" value={prescription.cooldown || ''} onChangeText={v => updateField(prescription, 'cooldown', v, onChange)} />
    </View>
  );
}

function StrengthEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];

  const updateExercise = (index: number, key: string, value: string) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [key]: value };
    onChange({ ...prescription, exercises: updated });
  };

  const addExercise = () => {
    onChange({ ...prescription, exercises: [...exercises, { name: '', sets: '', reps: '', weight: '' }] });
  };

  const removeExercise = (index: number) => {
    const updated = exercises.filter((_, i) => i !== index);
    onChange({ ...prescription, exercises: updated });
  };

  return (
    <View>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseLabel}>Exercise {i + 1}</Text>
            <Pressable onPress={() => removeExercise(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          <FieldInput label="Name" value={ex.name || ''} onChangeText={v => updateExercise(i, 'name', v)} />
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FieldInput label="Sets" value={String(ex.sets || '')} onChangeText={v => updateExercise(i, 'sets', v)} keyboardType="numeric" />
            </View>
            <View style={styles.halfField}>
              <FieldInput label="Reps" value={String(ex.reps || '')} onChangeText={v => updateExercise(i, 'reps', v)} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FieldInput label="Weight" value={ex.weight || ''} onChangeText={v => updateExercise(i, 'weight', v)} />
            </View>
            <View style={styles.halfField}>
              <FieldInput label="RPE" value={String(ex.rpe || '')} onChangeText={v => updateExercise(i, 'rpe', v)} keyboardType="decimal-pad" />
            </View>
          </View>
          <FieldInput label="Rest" value={ex.rest || ''} onChangeText={v => updateExercise(i, 'rest', v)} />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addButtonText}>Add Exercise</Text>
      </Pressable>
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
    </View>
  );
}

function SwimEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  return (
    <View>
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} />
      <FieldInput label="Stroke" value={prescription.stroke || ''} onChangeText={v => updateField(prescription, 'stroke', v, onChange)} />
      <FieldInput label="Pace" value={prescription.pace || ''} onChangeText={v => updateField(prescription, 'pace', v, onChange)} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
    </View>
  );
}

function CyclingEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  return (
    <View>
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
      <FieldInput label="Target Power" value={prescription.power || ''} onChangeText={v => updateField(prescription, 'power', v, onChange)} />
      <FieldInput label="Terrain" value={prescription.terrain || ''} onChangeText={v => updateField(prescription, 'terrain', v, onChange)} />
      <FieldInput label="Cadence" value={prescription.cadence || ''} onChangeText={v => updateField(prescription, 'cadence', v, onChange)} />
    </View>
  );
}

function MobilityEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];

  const updateExercise = (index: number, key: string, value: string) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [key]: value };
    onChange({ ...prescription, exercises: updated });
  };

  const addExercise = () => {
    onChange({ ...prescription, exercises: [...exercises, { name: '', duration: '' }] });
  };

  const removeExercise = (index: number) => {
    const updated = exercises.filter((_, i) => i !== index);
    onChange({ ...prescription, exercises: updated });
  };

  return (
    <View>
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.exerciseCard}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseLabel}>Exercise {i + 1}</Text>
            <Pressable onPress={() => removeExercise(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          <FieldInput label="Name" value={ex.name || ''} onChangeText={v => updateExercise(i, 'name', v)} />
          <FieldInput label="Duration" value={ex.duration || ''} onChangeText={v => updateExercise(i, 'duration', v)} />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addButtonText}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

function GenericEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  return (
    <View>
      {Object.entries(prescription).map(([key, value]) => {
        if (typeof value === 'object') return null;
        return (
          <FieldInput
            key={key}
            label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            value={String(value ?? '')}
            onChangeText={v => updateField(prescription, key, v, onChange)}
          />
        );
      })}
    </View>
  );
}

export function PrescriptionEditor({ activityType, prescription, onChange }: Props) {
  const type = activityType.toLowerCase().replace(/\s+/g, '_');

  if (type.includes('interval')) return <IntervalEditor prescription={prescription} onChange={onChange} />;
  if (type.includes('run') || type.includes('jog')) return <RunEditor prescription={prescription} onChange={onChange} />;
  if (type.includes('strength') || type.includes('weight')) return <StrengthEditor prescription={prescription} onChange={onChange} />;
  if (type.includes('swim')) return <SwimEditor prescription={prescription} onChange={onChange} />;
  if (type.includes('cycl') || type.includes('bike')) return <CyclingEditor prescription={prescription} onChange={onChange} />;
  if (type.includes('mobility') || type.includes('recovery') || type.includes('yoga') || type.includes('stretch'))
    return <MobilityEditor prescription={prescription} onChange={onChange} />;

  return <GenericEditor prescription={prescription} onChange={onChange} />;
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  intervalLabel: {
    width: 40,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  intervalFields: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  intervalInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  exerciseCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    marginBottom: 12,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
