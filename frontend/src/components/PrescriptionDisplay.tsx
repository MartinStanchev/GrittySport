import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';

interface Props {
  activityType: string;
  prescription: Record<string, any>;
}

function LabeledRow({ label, value }: { label: string; value: string | number | undefined }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{String(value)}</Text>
    </View>
  );
}

function SetCard({ set, index, fields }: { set: any; index: number; fields: { key: string; label: string }[] }) {
  return (
    <View style={styles.setCard}>
      <Text style={styles.setNumber}>Set {index + 1}</Text>
      <View style={styles.setDetails}>
        {set.reps && <Text style={styles.setPill}>{set.reps}x</Text>}
        {fields.map(({ key, label }) =>
          set[key] ? <Text key={key} style={styles.setPill}>{label}: {set[key]}</Text> : null,
        )}
      </View>
      {set.description && <Text style={styles.setDescription}>{set.description}</Text>}
    </View>
  );
}

function WarmupCooldown({ warmup, cooldown }: { warmup?: string; cooldown?: string }) {
  return (
    <>
      {warmup && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warmup</Text>
          <Text style={styles.sectionText}>{warmup}</Text>
        </View>
      )}
      {cooldown && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooldown</Text>
          <Text style={styles.sectionText}>{cooldown}</Text>
        </View>
      )}
    </>
  );
}

function RunDisplay({ prescription }: { prescription: Record<string, any> }) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  if (sets.length > 0) {
    return (
      <View>
        <WarmupCooldown warmup={prescription.warmup} cooldown={prescription.cooldown} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sets</Text>
          {sets.map((set: any, i: number) => (
            <SetCard key={i} set={set} index={i} fields={[
              { key: 'distance', label: 'Dist' },
              { key: 'pace', label: 'Pace' },
              { key: 'rest', label: 'Rest' },
            ]} />
          ))}
        </View>
        <LabeledRow label="Total Distance" value={prescription.total_distance} />
      </View>
    );
  }

  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} />
      <LabeledRow label="Pace" value={prescription.pace} />
      <LabeledRow label="HR Zone" value={prescription.heart_rate_zone} />
      <LabeledRow label="Terrain" value={prescription.terrain} />
      <LabeledRow label="Duration" value={prescription.duration} />
    </View>
  );
}

function StrengthDisplay({ prescription }: { prescription: Record<string, any> }) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];
  return (
    <View>
      {!Array.isArray(prescription.exercises) && prescription.exercises && (
        <LabeledRow label="Exercises" value={String(prescription.exercises)} />
      )}
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{ex.name || `Exercise ${i + 1}`}</Text>
          <View style={styles.exerciseDetails}>
            {ex.sets && <Text style={styles.exerciseDetail}>{ex.sets} sets</Text>}
            {ex.reps && <Text style={styles.exerciseDetail}>{ex.reps} reps</Text>}
            {ex.weight && <Text style={styles.exerciseDetail}>{ex.weight}</Text>}
            {ex.rpe && <Text style={styles.exerciseDetail}>RPE {ex.rpe}</Text>}
            {ex.rest && <Text style={styles.exerciseDetail}>Rest: {ex.rest}</Text>}
          </View>
          {ex.notes && <Text style={styles.exerciseNotes}>{ex.notes}</Text>}
        </View>
      ))}
      <LabeledRow label="Duration" value={prescription.duration} />
    </View>
  );
}

function SwimDisplay({ prescription }: { prescription: Record<string, any> }) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  if (sets.length > 0) {
    return (
      <View>
        <WarmupCooldown warmup={prescription.warmup} cooldown={prescription.cooldown} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sets</Text>
          {sets.map((set: any, i: number) => (
            <SetCard key={i} set={set} index={i} fields={[
              { key: 'distance', label: 'Dist' },
              { key: 'type', label: 'Type' },
              { key: 'pace', label: 'Pace' },
              { key: 'rest', label: 'Rest' },
            ]} />
          ))}
        </View>
        <LabeledRow label="Total Distance" value={prescription.total_distance} />
      </View>
    );
  }

  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} />
      <LabeledRow label="Stroke" value={prescription.stroke} />
      <LabeledRow label="Pace" value={prescription.pace} />
      <LabeledRow label="Duration" value={prescription.duration} />
    </View>
  );
}

function CyclingDisplay({ prescription }: { prescription: Record<string, any> }) {
  const sets: any[] = Array.isArray(prescription.sets) ? prescription.sets : [];

  if (sets.length > 0) {
    return (
      <View>
        <WarmupCooldown warmup={prescription.warmup} cooldown={prescription.cooldown} />
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sets</Text>
          {sets.map((set: any, i: number) => (
            <SetCard key={i} set={set} index={i} fields={[
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
      <LabeledRow label="Distance" value={prescription.distance} />
      <LabeledRow label="Duration" value={prescription.duration} />
      <LabeledRow label="Intensity" value={prescription.intensity} />
      <LabeledRow label="Cadence" value={prescription.cadence} />
    </View>
  );
}

function MobilityDisplay({ prescription }: { prescription: Record<string, any> }) {
  const exercises: any[] = Array.isArray(prescription.exercises) ? prescription.exercises : [];
  return (
    <View>
      <LabeledRow label="Duration" value={prescription.duration} />
      <LabeledRow label="Style" value={prescription.style} />
      <LabeledRow label="Focus" value={prescription.focus} />
      {prescription.instructions && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          <Text style={styles.sectionText}>{prescription.instructions}</Text>
        </View>
      )}
      {exercises.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {exercises.map((ex: any, i: number) => (
            <View key={i} style={styles.exerciseCard}>
              <Text style={styles.exerciseName}>{ex.name || `Exercise ${i + 1}`}</Text>
              <View style={styles.exerciseDetails}>
                {ex.duration && <Text style={styles.exerciseDetail}>{ex.duration}</Text>}
                {ex.sets && <Text style={styles.exerciseDetail}>{ex.sets} sets</Text>}
              </View>
              {ex.description && <Text style={styles.exerciseDescription}>{ex.description}</Text>}
              {ex.notes && <Text style={styles.exerciseNotes}>{ex.notes}</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DrillDisplay({ prescription }: { prescription: Record<string, any> }) {
  return (
    <View>
      <LabeledRow label="Drill" value={prescription.drill_name || prescription.name} />
      <LabeledRow label="Duration" value={prescription.duration} />
      <LabeledRow label="Focus" value={prescription.focus_area || prescription.focus} />
      {prescription.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.sectionText}>{prescription.description}</Text>
        </View>
      )}
    </View>
  );
}

function RestDisplay() {
  return (
    <View style={styles.restContainer}>
      <Text style={styles.restText}>Rest Day</Text>
      <Text style={styles.restSubtext}>Recovery is an essential part of your program</Text>
    </View>
  );
}

function GenericDisplay({ prescription }: { prescription: Record<string, any> }) {
  return (
    <View>
      {Object.entries(prescription).map(([key, value]) => (
        <LabeledRow
          key={key}
          label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
        />
      ))}
    </View>
  );
}

export function PrescriptionDisplay({ activityType, prescription }: Props) {
  if (!prescription || Object.keys(prescription).length === 0) {
    return <Text style={styles.empty}>No prescription details</Text>;
  }

  const type = activityType.toLowerCase().replace(/\s+/g, '_');

  if (type.includes('rest')) return <RestDisplay />;
  if (type.includes('run') || type.includes('jog')) return <RunDisplay prescription={prescription} />;
  if (type.includes('strength') || type.includes('weight')) return <StrengthDisplay prescription={prescription} />;
  if (type.includes('swim')) return <SwimDisplay prescription={prescription} />;
  if (type.includes('cycl') || type.includes('bike')) return <CyclingDisplay prescription={prescription} />;
  if (type.includes('mobility') || type.includes('recovery') || type.includes('yoga') || type.includes('stretch'))
    return <MobilityDisplay prescription={prescription} />;
  if (type.includes('drill')) return <DrillDisplay prescription={prescription} />;

  return <GenericDisplay prescription={prescription} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
  },
  label: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  setCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  setNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  setDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setPill: {
    fontSize: 13,
    color: Colors.textSecondary,
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  setDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  exerciseCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    backgroundColor: '#EEEEEE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  exerciseDescription: {
    fontSize: 13,
    color: Colors.textPrimary,
    marginTop: 4,
    lineHeight: 18,
  },
  exerciseNotes: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
  },
  restSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  empty: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
