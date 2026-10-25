import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { fieldLabel, hasSets, INPUT_CODECS, PRESCRIPTION_FIELDS, withField, type InputCodec, type Rx } from '../utils/prescription';

interface Props {
  activityType: string;
  prescription: Rx;
  onChange: (updated: Rx) => void;
}

type EditorProps = Omit<Props, 'activityType'> & { colors: ThemeColors };

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
  keyboardType?: 'default' | InputCodec['keyboard'];
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.inputBackground,
            color: colors.textPrimary,
            borderColor: colors.border,
          },
          multiline && styles.fieldInputMultiline,
        ]}
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

/** Text field bound to obj[field]; empty input removes the key. */
function TextField({ label, obj, field, onChange, colors, multiline }: {
  label: string; obj: Rx; field: string; onChange: (o: Rx) => void; colors: ThemeColors; multiline?: boolean;
}) {
  return (
    <FieldInput
      label={label}
      value={obj[field] == null ? '' : String(obj[field])}
      onChangeText={(v) => onChange(withField(obj, field, v === '' ? undefined : v))}
      multiline={multiline}
      colors={colors}
    />
  );
}

/**
 * Numeric field bound to obj[field], stored in base units and edited in the
 * codec's unit. The typed text is kept while it still parses to the stored
 * value, so partial input like "5." or "5:3" isn't reformatted mid-typing.
 */
function NumberField({ label, obj, field, codec, onChange, colors }: {
  label: string; obj: Rx; field: string; codec: InputCodec; onChange: (o: Rx) => void; colors: ThemeColors;
}) {
  const value: unknown = obj[field];
  const [draft, setDraft] = useState<string | null>(null);
  const formatted = typeof value === 'number' ? codec.toInput(value) : '';
  const shown = draft !== null && codec.fromInput(draft) === value ? draft : formatted;
  return (
    <FieldInput
      label={codec.unit ? `${label} (${codec.unit})` : label}
      value={shown}
      onChangeText={(text) => {
        setDraft(text);
        onChange(withField(obj, field, codec.fromInput(text)));
      }}
      keyboardType={codec.keyboard}
      colors={colors}
    />
  );
}

function RemovableCard({ title, onRemove, colors, children }: { title: string; onRemove: () => void; colors: ThemeColors; children: React.ReactNode }) {
  return (
    <View style={[styles.setCard, { backgroundColor: colors.primaryLight, borderColor: `${colors.primary}22` }]}>
      <View style={styles.setHeader}>
        <View style={[styles.cardIndexBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardIndexBadgeText, { color: colors.textPrimary }]}>{title}</Text>
        </View>
        <Pressable style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.primary} />
        </Pressable>
      </View>
      {children}
    </View>
  );
}

function AddButton({ label, onPress, colors }: { label: string; onPress: () => void; colors: ThemeColors }) {
  return (
    <Pressable style={[styles.addButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
      <Text style={[styles.addButtonText, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}

/** Editable list stored under rx[key] (sets or exercises). */
function useListEditor(rx: Rx, key: string, onChange: (o: Rx) => void) {
  const items: Rx[] = Array.isArray(rx[key]) ? rx[key] : [];
  return {
    items,
    update: (index: number, item: Rx) => onChange({ ...rx, [key]: items.map((it, i) => (i === index ? item : it)) }),
    add: (item: Rx) => onChange({ ...rx, [key]: [...items, item] }),
    remove: (index: number) => onChange({ ...rx, [key]: items.filter((_, i) => i !== index) }),
  };
}

type SetField = { label: string; field: string; codec?: InputCodec };

function SetsEditor({ prescription, onChange, fields, colors }: EditorProps & { fields: SetField[] }) {
  const { items: sets, update, add, remove } = useListEditor(prescription, 'sets', onChange);
  return (
    <View style={styles.editorGroup}>
      <TextField label="Warmup" obj={prescription} field="warmup" onChange={onChange} colors={colors} />
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sets</Text>
      {sets.map((set, i) => (
        <RemovableCard key={i} title={`Set ${i + 1}`} onRemove={() => remove(i)} colors={colors}>
          <View style={styles.rowFields}>
            <View style={styles.smallField}>
              <NumberField label="Reps" obj={set} field="reps" codec={INPUT_CODECS.count} onChange={(o) => update(i, o)} colors={colors} />
            </View>
            {fields.map(({ label, field, codec }) => (
              <View key={field} style={styles.flexField}>
                {codec
                  ? <NumberField label={label} obj={set} field={field} codec={codec} onChange={(o) => update(i, o)} colors={colors} />
                  : <TextField label={label} obj={set} field={field} onChange={(o) => update(i, o)} colors={colors} />}
              </View>
            ))}
          </View>
          <TextField label="Rest" obj={set} field="rest" onChange={(o) => update(i, o)} colors={colors} />
        </RemovableCard>
      ))}
      <AddButton label="Add Set" onPress={() => add({})} colors={colors} />
      <TextField label="Cooldown" obj={prescription} field="cooldown" onChange={onChange} colors={colors} />
    </View>
  );
}

function RunEditor({ prescription, onChange, colors }: EditorProps) {
  if (hasSets(prescription)) {
    return (
      <View>
        <SetsEditor
          prescription={prescription}
          onChange={onChange}
          colors={colors}
          fields={[
            { label: 'Distance', field: 'distance_m', codec: INPUT_CODECS.meters },
            { label: 'Pace', field: 'pace_sec_per_km', codec: INPUT_CODECS.pacePerKm },
          ]}
        />
        <NumberField label="Total Distance" obj={prescription} field="total_distance_m" codec={INPUT_CODECS.km} onChange={onChange} colors={colors} />
      </View>
    );
  }

  return (
    <View style={styles.editorGroup}>
      <NumberField label="Distance" obj={prescription} field="distance_m" codec={INPUT_CODECS.km} onChange={onChange} colors={colors} />
      <NumberField label="Pace" obj={prescription} field="pace_sec_per_km" codec={INPUT_CODECS.pacePerKm} onChange={onChange} colors={colors} />
      <TextField label="HR Zone" obj={prescription} field="heart_rate_zone" onChange={onChange} colors={colors} />
      <TextField label="Terrain" obj={prescription} field="terrain" onChange={onChange} colors={colors} />
      <NumberField label="Duration" obj={prescription} field="duration_sec" codec={INPUT_CODECS.minutes} onChange={onChange} colors={colors} />
      <AddButton label="Add Sets" onPress={() => onChange({ ...prescription, sets: [{}] })} colors={colors} />
    </View>
  );
}

function ExerciseList({ prescription, onChange, colors, renderFields }: EditorProps & {
  renderFields: (ex: Rx, update: (o: Rx) => void) => React.ReactNode;
}) {
  const { items: exercises, update, add, remove } = useListEditor(prescription, 'exercises', onChange);
  return (
    <>
      {exercises.map((ex, i) => (
        <RemovableCard key={i} title={`Exercise ${i + 1}`} onRemove={() => remove(i)} colors={colors}>
          <TextField label="Name" obj={ex} field="name" onChange={(o) => update(i, o)} colors={colors} />
          {renderFields(ex, (o) => update(i, o))}
        </RemovableCard>
      ))}
      <AddButton label="Add Exercise" onPress={() => add({ name: '' })} colors={colors} />
    </>
  );
}

function StrengthEditor({ prescription, onChange, colors }: EditorProps) {
  return (
    <View style={styles.editorGroup}>
      <ExerciseList
        prescription={prescription}
        onChange={onChange}
        colors={colors}
        renderFields={(ex, update) => (
          <>
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <NumberField label="Sets" obj={ex} field="sets" codec={INPUT_CODECS.count} onChange={update} colors={colors} />
              </View>
              <View style={styles.halfField}>
                <NumberField label="Reps" obj={ex} field="reps" codec={INPUT_CODECS.count} onChange={update} colors={colors} />
              </View>
            </View>
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <NumberField label="Weight" obj={ex} field="weight_kg" codec={INPUT_CODECS.kg} onChange={update} colors={colors} />
              </View>
              <View style={styles.halfField}>
                <NumberField label="RPE" obj={ex} field="rpe" codec={INPUT_CODECS.rpe} onChange={update} colors={colors} />
              </View>
            </View>
            <NumberField label="Rest" obj={ex} field="rest_sec" codec={INPUT_CODECS.seconds} onChange={update} colors={colors} />
          </>
        )}
      />
      <NumberField label="Duration" obj={prescription} field="duration_sec" codec={INPUT_CODECS.minutes} onChange={onChange} colors={colors} />
    </View>
  );
}

function SwimEditor({ prescription, onChange, colors }: EditorProps) {
  return (
    <View style={styles.editorGroup}>
      <SetsEditor
        prescription={prescription}
        onChange={onChange}
        colors={colors}
        fields={[
          { label: 'Distance', field: 'distance_m', codec: INPUT_CODECS.meters },
          { label: 'Type', field: 'type' },
          { label: 'Pace', field: 'pace_sec_per_100m', codec: INPUT_CODECS.pacePer100m },
        ]}
      />
      <NumberField label="Total Distance" obj={prescription} field="total_distance_m" codec={INPUT_CODECS.meters} onChange={onChange} colors={colors} />
    </View>
  );
}

function CyclingEditor({ prescription, onChange, colors }: EditorProps) {
  if (hasSets(prescription)) {
    return (
      <SetsEditor
        prescription={prescription}
        onChange={onChange}
        colors={colors}
        fields={[
          { label: 'Duration', field: 'duration_sec', codec: INPUT_CODECS.minutes },
          { label: 'Intensity', field: 'intensity' },
        ]}
      />
    );
  }

  return (
    <View style={styles.editorGroup}>
      <NumberField label="Distance" obj={prescription} field="distance_m" codec={INPUT_CODECS.km} onChange={onChange} colors={colors} />
      <NumberField label="Duration" obj={prescription} field="duration_sec" codec={INPUT_CODECS.minutes} onChange={onChange} colors={colors} />
      <TextField label="Intensity" obj={prescription} field="intensity" onChange={onChange} colors={colors} />
      <NumberField label="Power" obj={prescription} field="power_w" codec={INPUT_CODECS.watts} onChange={onChange} colors={colors} />
      <TextField label="Cadence" obj={prescription} field="cadence" onChange={onChange} colors={colors} />
      <AddButton label="Add Sets" onPress={() => onChange({ ...prescription, sets: [{}] })} colors={colors} />
    </View>
  );
}

function MobilityEditor({ prescription, onChange, colors }: EditorProps) {
  return (
    <View style={styles.editorGroup}>
      <NumberField label="Duration" obj={prescription} field="duration_sec" codec={INPUT_CODECS.minutes} onChange={onChange} colors={colors} />
      <TextField label="Style" obj={prescription} field="style" onChange={onChange} colors={colors} />
      <TextField label="Focus" obj={prescription} field="focus" onChange={onChange} colors={colors} />
      <TextField label="Instructions" obj={prescription} field="instructions" onChange={onChange} multiline colors={colors} />
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Exercises</Text>
      <ExerciseList
        prescription={prescription}
        onChange={onChange}
        colors={colors}
        renderFields={(ex, update) => (
          <>
            <View style={styles.rowFields}>
              <View style={styles.halfField}>
                <NumberField label="Duration" obj={ex} field="duration_sec" codec={INPUT_CODECS.seconds} onChange={update} colors={colors} />
              </View>
              <View style={styles.halfField}>
                <NumberField label="Sets" obj={ex} field="sets" codec={INPUT_CODECS.count} onChange={update} colors={colors} />
              </View>
            </View>
            <TextField label="Notes" obj={ex} field="notes" onChange={update} colors={colors} />
            <TextField label="Description" obj={ex} field="description" onChange={update} multiline colors={colors} />
          </>
        )}
      />
    </View>
  );
}

function GenericEditor({ prescription, onChange, colors }: EditorProps) {
  return (
    <View style={styles.editorGroup}>
      {Object.entries(prescription).map(([key, value]) => {
        if (typeof value === 'object') return null;
        const label = fieldLabel(key);
        const codec = PRESCRIPTION_FIELDS[key]?.codec ?? (typeof value === 'number' ? INPUT_CODECS.rpe : undefined);
        return codec
          ? <NumberField key={key} label={label} obj={prescription} field={key} codec={codec} onChange={onChange} colors={colors} />
          : <TextField key={key} label={label} obj={prescription} field={key} onChange={onChange} colors={colors} />;
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
  editorGroup: {
    gap: 2,
  },
  field: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldInput: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: Fonts.body,
    borderWidth: 1,
  },
  fieldInputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: 6,
    marginBottom: 10,
  },
  setCard: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIndexBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  cardIndexBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
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
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
});
