import React from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';

interface Props {
  activityType: string;
  prescription: Record<string, any>;
  onChange: (updated: Record<string, any>) => void;
}

function FieldInput({
  label,
  value,
  onChangeText,
  colors,
  keyboardType = 'default',
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  colors: ThemeColors;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary, borderColor: colors.border }, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder || label}
        placeholderTextColor={colors.textSecondary}
        multiline={multiline}
      />
    </View>
  );
}

function updateField(prescription: Record<string, any>, key: string, value: string, onChange: Props['onChange']) {
  onChange({ ...prescription, [key]: value });
}

function SetsEditor({
  prescription,
  onChange,
  fields,
  emptySet,
  colors,
}: {
  prescription: Record<string, any>;
  onChange: Props['onChange'];
  fields: { key: string; label: string; keyboard?: 'default' | 'numeric' }[];
  emptySet: Record<string, string>;
  colors: ThemeColors;
}) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  const updateSet = (index: number, key: string, value: string) => {
    const updated = [...sets];
    updated[index] = { ...updated[index], [key]: value };
    onChange({ ...prescription, sets: updated });
  };

  const addSet = () => {
    onChange({ ...prescription, sets: [...sets, { ...emptySet }] });
  };

  const removeSet = (index: number) => {
    onChange({ ...prescription, sets: sets.filter((_, i) => i !== index) });
  };

  return (
    <View>
      <FieldInput label="Warmup" value={prescription.warmup || ''} onChangeText={v => updateField(prescription, 'warmup', v, onChange)} colors={colors} />
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sets</Text>
      {sets.map((set: any, i: number) => (
        <View key={i} style={[styles.setCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.setHeader}>
            <Text style={[styles.setLabel, { color: colors.textPrimary }]}>Set {i + 1}</Text>
            <Pressable onPress={() => removeSet(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.smallField}>
              <FieldInput label="Reps" value={String(set.reps || '')} onChangeText={v => updateSet(i, 'reps', v)} keyboardType="numeric" colors={colors} />
            </View>
            {fields.map(({ key, label, keyboard }) => (
              <View key={key} style={styles.flexField}>
                <FieldInput label={label} value={set[key] || ''} onChangeText={v => updateSet(i, key, v)} keyboardType={keyboard || 'default'} colors={colors} />
              </View>
            ))}
          </View>
          <FieldInput label="Rest" value={set.rest || ''} onChangeText={v => updateSet(i, 'rest', v)} colors={colors} />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addSet}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Set</Text>
      </Pressable>
      <FieldInput label="Cooldown" value={prescription.cooldown || ''} onChangeText={v => updateField(prescription, 'cooldown', v, onChange)} colors={colors} />
    </View>
  );
}

function RunEditor({ prescription, onChange, colors }: Omit<Props, 'activityType'> & { colors: ThemeColors }) {
  const hasSets = Array.isArray(prescription.sets) && prescription.sets.length > 0;

  if (hasSets) {
    return (
      <View>
        <SetsEditor
          prescription={prescription}
          onChange={onChange}
          colors={colors}
          fields={[
            { key: 'distance', label: 'Distance' },
            { key: 'pace', label: 'Pace' },
          ]}
          emptySet={{ reps: '', distance: '', pace: '', rest: '' }}
        />
        <FieldInput label="Total Distance" value={prescription.total_distance || ''} onChangeText={v => updateField(prescription, 'total_distance', v, onChange)} colors={colors} />
      </View>
    );
  }

  return (
    <View>
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} colors={colors} />
      <FieldInput label="Pace" value={prescription.pace || ''} onChangeText={v => updateField(prescription, 'pace', v, onChange)} colors={colors} />
      <FieldInput label="HR Zone" value={prescription.heart_rate_zone || ''} onChangeText={v => updateField(prescription, 'heart_rate_zone', v, onChange)} colors={colors} />
      <FieldInput label="Terrain" value={prescription.terrain || ''} onChangeText={v => updateField(prescription, 'terrain', v, onChange)} colors={colors} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} colors={colors} />
      <Pressable style={styles.addButton} onPress={() => onChange({ ...prescription, sets: [{ reps: '', distance: '', pace: '', rest: '' }] })}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Sets</Text>
      </Pressable>
    </View>
  );
}

function StrengthEditor({ prescription, onChange, colors }: Omit<Props, 'activityType'> & { colors: ThemeColors }) {
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
    onChange({ ...prescription, exercises: exercises.filter((_, i) => i !== index) });
  };

  return (
    <View>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={[styles.setCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.setHeader}>
            <Text style={[styles.setLabel, { color: colors.textPrimary }]}>Exercise {i + 1}</Text>
            <Pressable onPress={() => removeExercise(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <FieldInput label="Name" value={ex.name || ''} onChangeText={v => updateExercise(i, 'name', v)} colors={colors} />
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FieldInput label="Sets" value={String(ex.sets || '')} onChangeText={v => updateExercise(i, 'sets', v)} keyboardType="numeric" colors={colors} />
            </View>
            <View style={styles.halfField}>
              <FieldInput label="Reps" value={String(ex.reps || '')} onChangeText={v => updateExercise(i, 'reps', v)} keyboardType="numeric" colors={colors} />
            </View>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FieldInput label="Weight" value={ex.weight || ''} onChangeText={v => updateExercise(i, 'weight', v)} colors={colors} />
            </View>
            <View style={styles.halfField}>
              <FieldInput label="RPE" value={String(ex.rpe || '')} onChangeText={v => updateExercise(i, 'rpe', v)} keyboardType="decimal-pad" colors={colors} />
            </View>
          </View>
          <FieldInput label="Rest" value={ex.rest || ''} onChangeText={v => updateExercise(i, 'rest', v)} colors={colors} />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Exercise</Text>
      </Pressable>
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} colors={colors} />
    </View>
  );
}

function SwimEditor({ prescription, onChange, colors }: Omit<Props, 'activityType'> & { colors: ThemeColors }) {
  return (
    <View>
      <SetsEditor
        prescription={prescription}
        onChange={onChange}
        colors={colors}
        fields={[
          { key: 'distance', label: 'Distance' },
          { key: 'type', label: 'Type' },
          { key: 'pace', label: 'Pace' },
        ]}
        emptySet={{ reps: '', distance: '', type: '', pace: '', rest: '', description: '' }}
      />
      <FieldInput label="Total Distance" value={prescription.total_distance || ''} onChangeText={v => updateField(prescription, 'total_distance', v, onChange)} colors={colors} />
    </View>
  );
}

function CyclingEditor({ prescription, onChange, colors }: Omit<Props, 'activityType'> & { colors: ThemeColors }) {
  const hasSets = Array.isArray(prescription.sets) && prescription.sets.length > 0;

  if (hasSets) {
    return (
      <SetsEditor
        prescription={prescription}
        onChange={onChange}
        colors={colors}
        fields={[
          { key: 'duration', label: 'Duration' },
          { key: 'intensity', label: 'Intensity' },
        ]}
        emptySet={{ reps: '', duration: '', intensity: '', rest: '' }}
      />
    );
  }

  return (
    <View>
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} colors={colors} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} colors={colors} />
      <FieldInput label="Intensity" value={prescription.intensity || ''} onChangeText={v => updateField(prescription, 'intensity', v, onChange)} colors={colors} />
      <FieldInput label="Cadence" value={prescription.cadence || ''} onChangeText={v => updateField(prescription, 'cadence', v, onChange)} colors={colors} />
      <Pressable style={styles.addButton} onPress={() => onChange({ ...prescription, sets: [{ reps: '', duration: '', intensity: '', rest: '' }] })}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Sets</Text>
      </Pressable>
    </View>
  );
}

function MobilityEditor({ prescription, onChange, colors }: Omit<Props, 'activityType'> & { colors: ThemeColors }) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];

  const updateExercise = (index: number, key: string, value: string) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [key]: value };
    onChange({ ...prescription, exercises: updated });
  };

  const addExercise = () => {
    onChange({ ...prescription, exercises: [...exercises, { name: '', duration: '', sets: '', description: '' }] });
  };

  const removeExercise = (index: number) => {
    onChange({ ...prescription, exercises: exercises.filter((_, i) => i !== index) });
  };

  return (
    <View>
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} colors={colors} />
      <FieldInput label="Style" value={prescription.style || ''} onChangeText={v => updateField(prescription, 'style', v, onChange)} colors={colors} />
      <FieldInput label="Focus" value={prescription.focus || ''} onChangeText={v => updateField(prescription, 'focus', v, onChange)} colors={colors} />
      <FieldInput label="Instructions" value={prescription.instructions || ''} onChangeText={v => updateField(prescription, 'instructions', v, onChange)} multiline colors={colors} />
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Exercises</Text>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={[styles.setCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <View style={styles.setHeader}>
            <Text style={[styles.setLabel, { color: colors.textPrimary }]}>Exercise {i + 1}</Text>
            <Pressable onPress={() => removeExercise(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <FieldInput label="Name" value={ex.name || ''} onChangeText={v => updateExercise(i, 'name', v)} colors={colors} />
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FieldInput label="Duration" value={ex.duration || ''} onChangeText={v => updateExercise(i, 'duration', v)} colors={colors} />
            </View>
            <View style={styles.halfField}>
              <FieldInput label="Sets" value={String(ex.sets || '')} onChangeText={v => updateExercise(i, 'sets', v)} keyboardType="numeric" colors={colors} />
            </View>
          </View>
          <FieldInput label="Notes" value={ex.notes || ''} onChangeText={v => updateExercise(i, 'notes', v)} colors={colors} />
          <FieldInput label="Description" value={ex.description || ''} onChangeText={v => updateExercise(i, 'description', v)} multiline colors={colors} />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addExercise}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Exercise</Text>
      </Pressable>
    </View>
  );
}

function GenericEditor({ prescription, onChange, colors }: Omit<Props, 'activityType'> & { colors: ThemeColors }) {
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
            colors={colors}
          />
        );
      })}
    </View>
  );
}

export function PrescriptionEditor({ activityType, prescription, onChange }: Props) {
  const { colors } = useTheme();
  const type = activityType.toLowerCase().replace(/\s+/g, '_');

  if (type.includes('run') || type.includes('jog')) return <RunEditor prescription={prescription} onChange={onChange} colors={colors} />;
  if (type.includes('strength') || type.includes('weight')) return <StrengthEditor prescription={prescription} onChange={onChange} colors={colors} />;
  if (type.includes('swim')) return <SwimEditor prescription={prescription} onChange={onChange} colors={colors} />;
  if (type.includes('cycl') || type.includes('bike')) return <CyclingEditor prescription={prescription} onChange={onChange} colors={colors} />;
  if (type.includes('mobility') || type.includes('recovery') || type.includes('yoga') || type.includes('stretch'))
    return <MobilityEditor prescription={prescription} onChange={onChange} colors={colors} />;

  return <GenericEditor prescription={prescription} onChange={onChange} colors={colors} />;
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
  },
  fieldInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  setCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  setLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 10,
  },
  smallField: {
    width: 70,
  },
  flexField: {
    flex: 1,
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
  },
});
