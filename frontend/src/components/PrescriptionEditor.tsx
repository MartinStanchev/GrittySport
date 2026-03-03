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
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad';
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder || label}
        placeholderTextColor="#BBB"
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
}: {
  prescription: Record<string, any>;
  onChange: Props['onChange'];
  fields: { key: string; label: string; keyboard?: 'default' | 'numeric' }[];
  emptySet: Record<string, string>;
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
      <FieldInput label="Warmup" value={prescription.warmup || ''} onChangeText={v => updateField(prescription, 'warmup', v, onChange)} />
      <Text style={styles.sectionTitle}>Sets</Text>
      {sets.map((set: any, i: number) => (
        <View key={i} style={styles.setCard}>
          <View style={styles.setHeader}>
            <Text style={styles.setLabel}>Set {i + 1}</Text>
            <Pressable onPress={() => removeSet(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          <View style={styles.rowFields}>
            <View style={styles.smallField}>
              <FieldInput label="Reps" value={String(set.reps || '')} onChangeText={v => updateSet(i, 'reps', v)} keyboardType="numeric" />
            </View>
            {fields.map(({ key, label, keyboard }) => (
              <View key={key} style={styles.flexField}>
                <FieldInput label={label} value={set[key] || ''} onChangeText={v => updateSet(i, key, v)} keyboardType={keyboard || 'default'} />
              </View>
            ))}
          </View>
          <FieldInput label="Rest" value={set.rest || ''} onChangeText={v => updateSet(i, 'rest', v)} />
        </View>
      ))}
      <Pressable style={styles.addButton} onPress={addSet}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addButtonText}>Add Set</Text>
      </Pressable>
      <FieldInput label="Cooldown" value={prescription.cooldown || ''} onChangeText={v => updateField(prescription, 'cooldown', v, onChange)} />
    </View>
  );
}

function RunEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  const hasSets = Array.isArray(prescription.sets) && prescription.sets.length > 0;

  if (hasSets) {
    return (
      <View>
        <SetsEditor
          prescription={prescription}
          onChange={onChange}
          fields={[
            { key: 'distance', label: 'Distance' },
            { key: 'pace', label: 'Pace' },
          ]}
          emptySet={{ reps: '', distance: '', pace: '', rest: '' }}
        />
        <FieldInput label="Total Distance" value={prescription.total_distance || ''} onChangeText={v => updateField(prescription, 'total_distance', v, onChange)} />
      </View>
    );
  }

  return (
    <View>
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} />
      <FieldInput label="Pace" value={prescription.pace || ''} onChangeText={v => updateField(prescription, 'pace', v, onChange)} />
      <FieldInput label="HR Zone" value={prescription.heart_rate_zone || ''} onChangeText={v => updateField(prescription, 'heart_rate_zone', v, onChange)} />
      <FieldInput label="Terrain" value={prescription.terrain || ''} onChangeText={v => updateField(prescription, 'terrain', v, onChange)} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
      <Pressable style={styles.addButton} onPress={() => onChange({ ...prescription, sets: [{ reps: '', distance: '', pace: '', rest: '' }] })}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addButtonText}>Add Sets</Text>
      </Pressable>
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
    onChange({ ...prescription, exercises: exercises.filter((_, i) => i !== index) });
  };

  return (
    <View>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.setCard}>
          <View style={styles.setHeader}>
            <Text style={styles.setLabel}>Exercise {i + 1}</Text>
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
      <SetsEditor
        prescription={prescription}
        onChange={onChange}
        fields={[
          { key: 'distance', label: 'Distance' },
          { key: 'type', label: 'Type' },
          { key: 'pace', label: 'Pace' },
        ]}
        emptySet={{ reps: '', distance: '', type: '', pace: '', rest: '', description: '' }}
      />
      <FieldInput label="Total Distance" value={prescription.total_distance || ''} onChangeText={v => updateField(prescription, 'total_distance', v, onChange)} />
    </View>
  );
}

function CyclingEditor({ prescription, onChange }: Omit<Props, 'activityType'>) {
  const hasSets = Array.isArray(prescription.sets) && prescription.sets.length > 0;

  if (hasSets) {
    return (
      <SetsEditor
        prescription={prescription}
        onChange={onChange}
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
      <FieldInput label="Distance" value={prescription.distance || ''} onChangeText={v => updateField(prescription, 'distance', v, onChange)} />
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
      <FieldInput label="Intensity" value={prescription.intensity || ''} onChangeText={v => updateField(prescription, 'intensity', v, onChange)} />
      <FieldInput label="Cadence" value={prescription.cadence || ''} onChangeText={v => updateField(prescription, 'cadence', v, onChange)} />
      <Pressable style={styles.addButton} onPress={() => onChange({ ...prescription, sets: [{ reps: '', duration: '', intensity: '', rest: '' }] })}>
        <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
        <Text style={styles.addButtonText}>Add Sets</Text>
      </Pressable>
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
    onChange({ ...prescription, exercises: [...exercises, { name: '', duration: '', sets: '', description: '' }] });
  };

  const removeExercise = (index: number) => {
    onChange({ ...prescription, exercises: exercises.filter((_, i) => i !== index) });
  };

  return (
    <View>
      <FieldInput label="Duration" value={prescription.duration || ''} onChangeText={v => updateField(prescription, 'duration', v, onChange)} />
      <FieldInput label="Style" value={prescription.style || ''} onChangeText={v => updateField(prescription, 'style', v, onChange)} />
      <FieldInput label="Focus" value={prescription.focus || ''} onChangeText={v => updateField(prescription, 'focus', v, onChange)} />
      <FieldInput label="Instructions" value={prescription.instructions || ''} onChangeText={v => updateField(prescription, 'instructions', v, onChange)} multiline />
      <Text style={styles.sectionTitle}>Exercises</Text>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.setCard}>
          <View style={styles.setHeader}>
            <Text style={styles.setLabel}>Exercise {i + 1}</Text>
            <Pressable onPress={() => removeExercise(i)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={Colors.primary} />
            </Pressable>
          </View>
          <FieldInput label="Name" value={ex.name || ''} onChangeText={v => updateExercise(i, 'name', v)} />
          <View style={styles.rowFields}>
            <View style={styles.halfField}>
              <FieldInput label="Duration" value={ex.duration || ''} onChangeText={v => updateExercise(i, 'duration', v)} />
            </View>
            <View style={styles.halfField}>
              <FieldInput label="Sets" value={String(ex.sets || '')} onChangeText={v => updateExercise(i, 'sets', v)} keyboardType="numeric" />
            </View>
          </View>
          <FieldInput label="Notes" value={ex.notes || ''} onChangeText={v => updateExercise(i, 'notes', v)} />
          <FieldInput label="Description" value={ex.description || ''} onChangeText={v => updateExercise(i, 'description', v)} multiline />
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
  fieldInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
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
  setCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
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
    color: Colors.textPrimary,
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
    color: Colors.primary,
  },
});
