import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { fieldLabel, formatPrescriptionField as fmt, hasSets, type Rx } from '../utils/prescription';

interface Props {
  activityType: string;
  prescription: Rx;
}

function LabeledRow({ label, value, colors }: { label: string; value: string | undefined; colors: ThemeColors }) {
  if (!value) return null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

/** Renders labeled rows for the given [label, key] pairs, skipping absent fields. */
function FieldRows({ rx, fields, colors }: { rx: Rx; fields: [string, string][]; colors: ThemeColors }) {
  return (
    <>
      {fields.map(([label, key]) => (
        <LabeledRow key={key} label={label} value={fmt(rx, key)} colors={colors} />
      ))}
    </>
  );
}

function EffortBadge({ effort, colors }: { effort?: string; colors: ThemeColors }) {
  if (!effort) return null;
  return (
    <View style={[styles.effortBadge, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.effortText, { color: colors.primary }]}>{effort}</Text>
    </View>
  );
}

function Pill({ text, colors }: { text: string | undefined; colors: ThemeColors }) {
  if (!text) return null;
  return <Text style={[styles.setPill, { color: colors.textSecondary, backgroundColor: colors.background }]}>{text}</Text>;
}

function SetCard({ set, index, colors }: { set: Rx; index: number; colors: ThemeColors }) {
  const rest = fmt(set, 'rest_sec') ?? fmt(set, 'rest');
  return (
    <View style={[styles.setCard, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.setNumber, { color: colors.textSecondary }]}>Set {index + 1}</Text>
      <View style={styles.setDetails}>
        <Pill text={set.reps ? `${set.reps}x` : undefined} colors={colors} />
        <Pill text={fmt(set, 'distance_m')} colors={colors} />
        <Pill text={fmt(set, 'duration_sec')} colors={colors} />
        <Pill text={fmt(set, 'type')} colors={colors} />
        <Pill text={fmt(set, 'pace_sec_per_km') ?? fmt(set, 'pace_sec_per_100m')} colors={colors} />
        <Pill text={fmt(set, 'power_w')} colors={colors} />
        <Pill text={fmt(set, 'intensity')} colors={colors} />
        <Pill text={rest ? `Rest: ${rest}` : undefined} colors={colors} />
        <Pill text={set.rpe ? `RPE ${set.rpe}` : undefined} colors={colors} />
      </View>
      {set.effort && <Text style={[styles.inlineEffort, { color: colors.primary }]}>{set.effort}</Text>}
      {set.description && <Text style={[styles.setDescription, { color: colors.textSecondary }]}>{set.description}</Text>}
    </View>
  );
}

function TextSection({ title, text, colors }: { title: string; text?: string; colors: ThemeColors }) {
  if (!text) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
      <Text style={[styles.sectionText, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

/** Warmup → sets → cooldown → totals, shared by run, swim and cycling sessions. */
function StructuredDisplay({ rx, colors }: { rx: Rx; colors: ThemeColors }) {
  const sets: Rx[] = rx.sets;
  return (
    <View>
      <TextSection title="Warmup" text={rx.warmup} colors={colors} />
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sets</Text>
        {sets.map((set, i) => (
          <SetCard key={i} set={set} index={i} colors={colors} />
        ))}
      </View>
      <TextSection title="Cooldown" text={rx.cooldown} colors={colors} />
      <FieldRows rx={rx} fields={[['Total Distance', 'total_distance_m'], ['Duration', 'duration_sec']]} colors={colors} />
    </View>
  );
}

function EnduranceDisplay({ rx, fields, colors }: { rx: Rx; fields: [string, string][]; colors: ThemeColors }) {
  if (hasSets(rx)) return <StructuredDisplay rx={rx} colors={colors} />;
  return (
    <View>
      <FieldRows rx={rx} fields={[...fields, ['RPE', 'rpe']]} colors={colors} />
      <EffortBadge effort={rx.effort} colors={colors} />
    </View>
  );
}

const RUN_FIELDS: [string, string][] = [['Distance', 'distance_m'], ['Pace', 'pace_sec_per_km'], ['HR Zone', 'heart_rate_zone'], ['Terrain', 'terrain'], ['Duration', 'duration_sec']];
const SWIM_FIELDS: [string, string][] = [['Distance', 'distance_m'], ['Stroke', 'stroke'], ['Pace', 'pace_sec_per_100m'], ['Duration', 'duration_sec']];
const CYCLING_FIELDS: [string, string][] = [['Distance', 'distance_m'], ['Duration', 'duration_sec'], ['Intensity', 'intensity'], ['Power', 'power_w'], ['Cadence', 'cadence']];

function ExerciseCard({ ex, index, colors }: { ex: Rx; index: number; colors: ThemeColors }) {
  const rest = fmt(ex, 'rest_sec');
  return (
    <View style={[styles.exerciseCard, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name || `Exercise ${index + 1}`}</Text>
      <View style={styles.exerciseDetails}>
        <Pill text={ex.sets ? `${ex.sets} sets` : undefined} colors={colors} />
        <Pill text={ex.reps ? `${ex.reps} reps` : undefined} colors={colors} />
        <Pill text={fmt(ex, 'weight_kg')} colors={colors} />
        <Pill text={fmt(ex, 'duration_sec')} colors={colors} />
        <Pill text={ex.rpe ? `RPE ${ex.rpe}` : undefined} colors={colors} />
        <Pill text={rest ? `Rest: ${rest}` : undefined} colors={colors} />
      </View>
      {ex.effort && <Text style={[styles.inlineEffort, { color: colors.primary }]}>{ex.effort}</Text>}
      {ex.description && <Text style={[styles.exerciseDescription, { color: colors.textPrimary }]}>{ex.description}</Text>}
      {ex.notes && <Text style={[styles.exerciseNotes, { color: colors.textSecondary }]}>{ex.notes}</Text>}
    </View>
  );
}

function ExerciseList({ rx, colors }: { rx: Rx; colors: ThemeColors }) {
  const exercises: Rx[] = Array.isArray(rx.exercises) ? rx.exercises : [];
  return (
    <>
      {exercises.map((ex, i) => (
        <ExerciseCard key={i} ex={ex} index={i} colors={colors} />
      ))}
    </>
  );
}

function StrengthDisplay({ rx, colors }: { rx: Rx; colors: ThemeColors }) {
  return (
    <View>
      <ExerciseList rx={rx} colors={colors} />
      <LabeledRow label="Duration" value={fmt(rx, 'duration_sec')} colors={colors} />
    </View>
  );
}

function MobilityDisplay({ rx, colors }: { rx: Rx; colors: ThemeColors }) {
  const hasExercises = Array.isArray(rx.exercises) && rx.exercises.length > 0;
  return (
    <View>
      <FieldRows rx={rx} fields={[['Duration', 'duration_sec'], ['Style', 'style'], ['Focus', 'focus'], ['RPE', 'rpe']]} colors={colors} />
      <TextSection title="Instructions" text={rx.instructions} colors={colors} />
      {hasExercises && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Exercises</Text>
          <ExerciseList rx={rx} colors={colors} />
        </View>
      )}
    </View>
  );
}

function DrillDisplay({ rx, colors }: { rx: Rx; colors: ThemeColors }) {
  return (
    <View>
      <LabeledRow label="Drill" value={rx.drill_name || rx.name} colors={colors} />
      <LabeledRow label="Duration" value={fmt(rx, 'duration_sec')} colors={colors} />
      <LabeledRow label="Focus" value={rx.focus_area || rx.focus} colors={colors} />
      <TextSection title="Description" text={rx.description} colors={colors} />
    </View>
  );
}

function RestDisplay({ colors }: { colors: ThemeColors }) {
  return (
    <View style={styles.restContainer}>
      <Text style={[styles.restText, { color: colors.textPrimary }]}>Rest Day</Text>
      <Text style={[styles.restSubtext, { color: colors.textSecondary }]}>Recovery is an essential part of your program</Text>
    </View>
  );
}

function GenericDisplay({ rx, colors }: { rx: Rx; colors: ThemeColors }) {
  return (
    <View>
      {Object.keys(rx).map((key) => (
        <LabeledRow
          key={key}
          label={fieldLabel(key)}
          value={fmt(rx, key)}
          colors={colors}
        />
      ))}
    </View>
  );
}

export function PrescriptionDisplay({ activityType, prescription: rx }: Props) {
  const { colors } = useTheme();

  if (!rx || Object.keys(rx).length === 0) {
    return <Text style={[styles.empty, { color: colors.textSecondary }]}>No prescription details</Text>;
  }

  const type = activityType.toLowerCase().replace(/\s+/g, '_');

  if (type.includes('rest')) return <RestDisplay colors={colors} />;
  if (type.includes('run') || type.includes('jog')) return <EnduranceDisplay rx={rx} fields={RUN_FIELDS} colors={colors} />;
  if (type.includes('strength') || type.includes('weight')) return <StrengthDisplay rx={rx} colors={colors} />;
  if (type.includes('swim')) return <EnduranceDisplay rx={rx} fields={SWIM_FIELDS} colors={colors} />;
  if (type.includes('cycl') || type.includes('bike')) return <EnduranceDisplay rx={rx} fields={CYCLING_FIELDS} colors={colors} />;
  if (type.includes('mobility') || type.includes('recovery') || type.includes('yoga') || type.includes('stretch'))
    return <MobilityDisplay rx={rx} colors={colors} />;
  if (type.includes('drill')) return <DrillDisplay rx={rx} colors={colors} />;

  return <GenericDisplay rx={rx} colors={colors} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontSize: 14,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  setCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  setNumber: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  setDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setPill: {
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  inlineEffort: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 4,
  },
  setDescription: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  exerciseCard: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  exerciseNotes: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  restContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  restText: {
    fontSize: 20,
    fontWeight: '700',
  },
  restSubtext: {
    fontSize: 14,
    marginTop: 6,
  },
  effortBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  effortText: {
    fontSize: 12,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  empty: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
