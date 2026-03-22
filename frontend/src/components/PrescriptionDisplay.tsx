import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';

interface Props {
  activityType: string;
  prescription: Record<string, any>;
}

function LabeledRow({ label, value, colors }: { label: string; value: string | number | undefined; colors: ThemeColors }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{String(value)}</Text>
    </View>
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

function SetCard({ set, index, fields, colors }: { set: any; index: number; fields: { key: string; label: string }[]; colors: ThemeColors }) {
  return (
    <View style={[styles.setCard, { backgroundColor: colors.surfaceAlt }]}>
      <Text style={[styles.setNumber, { color: colors.textSecondary }]}>Set {index + 1}</Text>
      <View style={styles.setDetails}>
        {set.reps && <Text style={[styles.setPill, { color: colors.textSecondary, backgroundColor: colors.background }]}>{set.reps}x</Text>}
        {fields.map(({ key, label }) =>
          set[key] ? <Text key={key} style={[styles.setPill, { color: colors.textSecondary, backgroundColor: colors.background }]}>{label}: {set[key]}</Text> : null,
        )}
        {set.rpe && <Text style={[styles.setPill, { color: colors.textSecondary, backgroundColor: colors.background }]}>RPE {set.rpe}</Text>}
      </View>
      {set.effort && <Text style={[styles.inlineEffort, { color: colors.primary }]}>{set.effort}</Text>}
      {set.description && <Text style={[styles.setDescription, { color: colors.textSecondary }]}>{set.description}</Text>}
    </View>
  );
}

function WarmupCooldown({ warmup, cooldown, colors }: { warmup?: string; cooldown?: string; colors: ThemeColors }) {
  return (
    <>
      {warmup && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Warmup</Text>
          <Text style={[styles.sectionText, { color: colors.textPrimary }]}>{warmup}</Text>
        </View>
      )}
      {cooldown && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Cooldown</Text>
          <Text style={[styles.sectionText, { color: colors.textPrimary }]}>{cooldown}</Text>
        </View>
      )}
    </>
  );
}

function RunDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  if (sets.length > 0) {
    return (
      <View>
        <WarmupCooldown warmup={prescription.warmup} cooldown={prescription.cooldown} colors={colors} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sets</Text>
          {sets.map((set: any, i: number) => (
            <SetCard key={i} set={set} index={i} colors={colors} fields={[
              { key: 'distance', label: 'Dist' },
              { key: 'pace', label: 'Pace' },
              { key: 'rest', label: 'Rest' },
            ]} />
          ))}
        </View>
        <LabeledRow label="Total Distance" value={prescription.total_distance} colors={colors} />
      </View>
    );
  }

  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} colors={colors} />
      <LabeledRow label="Pace" value={prescription.pace} colors={colors} />
      <LabeledRow label="HR Zone" value={prescription.heart_rate_zone} colors={colors} />
      <LabeledRow label="Terrain" value={prescription.terrain} colors={colors} />
      <LabeledRow label="Duration" value={prescription.duration} colors={colors} />
      <LabeledRow label="RPE" value={prescription.rpe} colors={colors} />
      <EffortBadge effort={prescription.effort} colors={colors} />
    </View>
  );
}

function StrengthDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];
  return (
    <View>
      {!Array.isArray(prescription.exercises) && prescription.exercises && (
        <LabeledRow label="Exercises" value={String(prescription.exercises)} colors={colors} />
      )}
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={[styles.exerciseCard, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name || `Exercise ${i + 1}`}</Text>
          <View style={styles.exerciseDetails}>
            {ex.sets && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>{ex.sets} sets</Text>}
            {ex.reps && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>{ex.reps} reps</Text>}
            {ex.weight && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>{ex.weight}</Text>}
            {ex.rpe && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>RPE {ex.rpe}</Text>}
            {ex.rest && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>Rest: {ex.rest}</Text>}
          </View>
          {ex.effort && <Text style={[styles.inlineEffort, { color: colors.primary }]}>{ex.effort}</Text>}
          {ex.notes && <Text style={[styles.exerciseNotes, { color: colors.textSecondary }]}>{ex.notes}</Text>}
        </View>
      ))}
      <LabeledRow label="Duration" value={prescription.duration} colors={colors} />
    </View>
  );
}

function SwimDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  if (sets.length > 0) {
    return (
      <View>
        <WarmupCooldown warmup={prescription.warmup} cooldown={prescription.cooldown} colors={colors} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sets</Text>
          {sets.map((set: any, i: number) => (
            <SetCard key={i} set={set} index={i} colors={colors} fields={[
              { key: 'distance', label: 'Dist' },
              { key: 'type', label: 'Type' },
              { key: 'pace', label: 'Pace' },
              { key: 'rest', label: 'Rest' },
            ]} />
          ))}
        </View>
        <LabeledRow label="Total Distance" value={prescription.total_distance} colors={colors} />
      </View>
    );
  }

  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} colors={colors} />
      <LabeledRow label="Stroke" value={prescription.stroke} colors={colors} />
      <LabeledRow label="Pace" value={prescription.pace} colors={colors} />
      <LabeledRow label="Duration" value={prescription.duration} colors={colors} />
      <LabeledRow label="RPE" value={prescription.rpe} colors={colors} />
      <EffortBadge effort={prescription.effort} colors={colors} />
    </View>
  );
}

function CyclingDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  if (sets.length > 0) {
    return (
      <View>
        <WarmupCooldown warmup={prescription.warmup} cooldown={prescription.cooldown} colors={colors} />
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Sets</Text>
          {sets.map((set: any, i: number) => (
            <SetCard key={i} set={set} index={i} colors={colors} fields={[
              { key: 'duration', label: 'Duration' },
              { key: 'intensity', label: 'Intensity' },
              { key: 'rest', label: 'Rest' },
            ]} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} colors={colors} />
      <LabeledRow label="Duration" value={prescription.duration} colors={colors} />
      <LabeledRow label="Intensity" value={prescription.intensity} colors={colors} />
      <LabeledRow label="Cadence" value={prescription.cadence} colors={colors} />
      <LabeledRow label="RPE" value={prescription.rpe} colors={colors} />
      <EffortBadge effort={prescription.effort} colors={colors} />
    </View>
  );
}

function MobilityDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];
  return (
    <View>
      <LabeledRow label="Duration" value={prescription.duration} colors={colors} />
      <LabeledRow label="Style" value={prescription.style} colors={colors} />
      <LabeledRow label="Focus" value={prescription.focus} colors={colors} />
      <LabeledRow label="RPE" value={prescription.rpe} colors={colors} />
      {prescription.instructions && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Instructions</Text>
          <Text style={[styles.sectionText, { color: colors.textPrimary }]}>{prescription.instructions}</Text>
        </View>
      )}
      {exercises.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Exercises</Text>
          {exercises.map((ex: any, i: number) => (
            <View key={i} style={[styles.exerciseCard, { backgroundColor: colors.surfaceAlt }]}>
              <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name || `Exercise ${i + 1}`}</Text>
              <View style={styles.exerciseDetails}>
                {ex.duration && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>{ex.duration}</Text>}
                {ex.sets && <Text style={[styles.exerciseDetail, { color: colors.textSecondary, backgroundColor: colors.background }]}>{ex.sets} sets</Text>}
              </View>
              {ex.description && <Text style={[styles.exerciseDescription, { color: colors.textPrimary }]}>{ex.description}</Text>}
              {ex.notes && <Text style={[styles.exerciseNotes, { color: colors.textSecondary }]}>{ex.notes}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DrillDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  return (
    <View>
      <LabeledRow label="Drill" value={prescription.drill_name || prescription.name} colors={colors} />
      <LabeledRow label="Duration" value={prescription.duration} colors={colors} />
      <LabeledRow label="Focus" value={prescription.focus_area || prescription.focus} colors={colors} />
      {prescription.description && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Description</Text>
          <Text style={[styles.sectionText, { color: colors.textPrimary }]}>{prescription.description}</Text>
        </View>
      )}
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

function GenericDisplay({ prescription, colors }: { prescription: Record<string, any>; colors: ThemeColors }) {
  return (
    <View>
      {Object.entries(prescription).map(([key, value]) => (
        <LabeledRow
          key={key}
          label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
          colors={colors}
        />
      ))}
    </View>
  );
}

export function PrescriptionDisplay({ activityType, prescription }: Props) {
  const { colors } = useTheme();

  if (!prescription || Object.keys(prescription).length === 0) {
    return <Text style={[styles.empty, { color: colors.textSecondary }]}>No prescription details</Text>;
  }

  const type = activityType.toLowerCase().replace(/\s+/g, '_');

  if (type.includes('rest')) return <RestDisplay colors={colors} />;
  if (type.includes('run') || type.includes('jog')) return <RunDisplay prescription={prescription} colors={colors} />;
  if (type.includes('strength') || type.includes('weight')) return <StrengthDisplay prescription={prescription} colors={colors} />;
  if (type.includes('swim')) return <SwimDisplay prescription={prescription} colors={colors} />;
  if (type.includes('cycl') || type.includes('bike')) return <CyclingDisplay prescription={prescription} colors={colors} />;
  if (type.includes('mobility') || type.includes('recovery') || type.includes('yoga') || type.includes('stretch'))
    return <MobilityDisplay prescription={prescription} colors={colors} />;
  if (type.includes('drill')) return <DrillDisplay prescription={prescription} colors={colors} />;

  return <GenericDisplay prescription={prescription} colors={colors} />;
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
  exerciseDetail: {
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
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
