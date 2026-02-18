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

function RunDisplay({ prescription }: { prescription: Record<string, any> }) {
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

function IntervalDisplay({ prescription }: { prescription: Record<string, any> }) {
  const intervals: any[] = prescription.intervals || [];
  return (
    <View>
      {prescription.warmup && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Warmup</Text>
          <Text style={styles.sectionText}>{prescription.warmup}</Text>
        </View>
      )}
      {intervals.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intervals</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Set</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Distance</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Pace</Text>
            <Text style={[styles.tableCell, styles.tableHeaderText]}>Rest</Text>
          </View>
          {intervals.map((interval: any, i: number) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.tableCell}>{i + 1}</Text>
              <Text style={styles.tableCell}>{interval.distance || '-'}</Text>
              <Text style={styles.tableCell}>{interval.pace || '-'}</Text>
              <Text style={styles.tableCell}>{interval.rest || '-'}</Text>
            </View>
          ))}
        </View>
      )}
      {prescription.cooldown && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cooldown</Text>
          <Text style={styles.sectionText}>{prescription.cooldown}</Text>
        </View>
      )}
    </View>
  );
}

function StrengthDisplay({ prescription }: { prescription: Record<string, any> }) {
  const exercises: any[] = prescription.exercises || [];
  return (
    <View>
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
  const drills: any[] = prescription.drills || [];
  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} />
      <LabeledRow label="Stroke" value={prescription.stroke} />
      <LabeledRow label="Pace" value={prescription.pace} />
      <LabeledRow label="Duration" value={prescription.duration} />
      {drills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Drills</Text>
          {drills.map((drill: any, i: number) => (
            <Text key={i} style={styles.sectionText}>
              {typeof drill === 'string' ? drill : drill.name || `Drill ${i + 1}`}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function CyclingDisplay({ prescription }: { prescription: Record<string, any> }) {
  return (
    <View>
      <LabeledRow label="Distance" value={prescription.distance} />
      <LabeledRow label="Duration" value={prescription.duration} />
      <LabeledRow label="Target Power" value={prescription.power} />
      <LabeledRow label="Terrain" value={prescription.terrain} />
      <LabeledRow label="Cadence" value={prescription.cadence} />
    </View>
  );
}

function MobilityDisplay({ prescription }: { prescription: Record<string, any> }) {
  const exercises: any[] = prescription.exercises || [];
  return (
    <View>
      <LabeledRow label="Duration" value={prescription.duration} />
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{ex.name || `Exercise ${i + 1}`}</Text>
          {ex.duration && <Text style={styles.exerciseDetail}>{ex.duration}</Text>}
          {ex.notes && <Text style={styles.exerciseNotes}>{ex.notes}</Text>}
        </View>
      ))}
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
  if (type.includes('interval')) return <IntervalDisplay prescription={prescription} />;
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
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 6,
    marginBottom: 4,
  },
  tableHeaderText: {
    fontWeight: '700',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  tableCell: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
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
