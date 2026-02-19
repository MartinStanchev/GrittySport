import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { getActivityIcon } from '../constants/activityIcons';
import { getWorkout } from '../services/api';
import type { WorkoutResponse } from '../services/api';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(startedAt: string, finishedAt?: string): string {
  if (!finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPace(paceSecPerKm: number): string {
  if (!paceSecPerKm) return '—';
  const m = Math.floor(paceSecPerKm / 60);
  const s = paceSecPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

type NormalizedType = 'run' | 'cycling' | 'swim' | 'strength' | 'mobility' | 'drill' | 'other';

function normalizeActivityType(type: string): NormalizedType {
  const t = type.toLowerCase();
  if (t === 'run' || t.includes('run')) return 'run';
  if (t === 'cycling' || t.includes('cycl')) return 'cycling';
  if (t === 'swim') return 'swim';
  if (t.includes('strength') || t.includes('weight')) return 'strength';
  if (t.includes('mobility') || t.includes('yoga')) return 'mobility';
  if (t.includes('drill')) return 'drill';
  return 'other';
}

const ACTIVITY_TYPE_LABELS: Record<NormalizedType, string> = {
  run: 'Running',
  cycling: 'Cycling',
  swim: 'Swimming',
  strength: 'Strength Training',
  mobility: 'Mobility / Yoga',
  drill: 'Sport Drill',
  other: '',
};

function activityTypeLabel(type: string): string {
  const normalized = normalizeActivityType(type);
  if (normalized === 'other') return type.charAt(0).toUpperCase() + type.slice(1);
  return ACTIVITY_TYPE_LABELS[normalized];
}

// ── Detail Section Renderers ────────────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RunDetail({ data }: { data: Record<string, any> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Run Stats</Text>
      <StatRow label="Distance" value={data.distance_km ? `${data.distance_km} km` : '—'} />
      <StatRow label="Avg Pace" value={formatPace(data.avg_pace_sec_per_km)} />
    </View>
  );
}

function CyclingDetail({ data }: { data: Record<string, any> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Cycling Stats</Text>
      <StatRow label="Distance" value={data.distance_km ? `${data.distance_km} km` : '—'} />
      <StatRow label="Avg Speed" value={data.avg_speed_kph ? `${data.avg_speed_kph} km/h` : '—'} />
    </View>
  );
}

function SwimDetail({ data }: { data: Record<string, any> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Swim Stats</Text>
      <StatRow label="Distance" value={data.distance_m ? `${data.distance_m} m` : '—'} />
      {data.laps ? <StatRow label="Laps" value={String(data.laps)} /> : null}
    </View>
  );
}

function StrengthDetail({ data }: { data: Record<string, any> }) {
  const exercises: any[] = data.exercises ?? [];
  if (exercises.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Exercises</Text>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.exerciseBlock}>
          <Text style={styles.exerciseName}>{ex.name || `Exercise ${i + 1}`}</Text>
          {(ex.sets ?? []).length > 0 && (
            <View style={styles.setsTable}>
              <View style={styles.setHeaderRow}>
                <Text style={[styles.setColLabel, { flex: 1 }]}>Set</Text>
                <Text style={[styles.setColLabel, { flex: 2 }]}>Reps</Text>
                <Text style={[styles.setColLabel, { flex: 2 }]}>Weight</Text>
              </View>
              {(ex.sets ?? []).map((s: any, si: number) => (
                <View key={si} style={styles.setRow}>
                  <Text style={[styles.setCell, { flex: 1 }]}>{si + 1}</Text>
                  <Text style={[styles.setCell, { flex: 2 }]}>{s.reps ?? '—'}</Text>
                  <Text style={[styles.setCell, { flex: 2 }]}>{s.weight ? `${s.weight} kg` : '—'}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

function MobilityDetail({ data }: { data: Record<string, any> }) {
  const exercises: any[] = data.exercises ?? [];
  if (exercises.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Exercises</Text>
      {exercises.map((ex: any, i: number) => {
        const durSec = ex.duration_seconds ?? 0;
        const durLabel = durSec > 0 ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : '—';
        return (
          <View key={i} style={styles.mobilityRow}>
            <Ionicons
              name={ex.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={ex.completed ? Colors.primary : Colors.textSecondary}
            />
            <View style={styles.mobilityInfo}>
              <Text style={styles.exerciseName}>{ex.name || `Exercise ${i + 1}`}</Text>
              <Text style={styles.mobilityDuration}>{durLabel}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function TypeSpecificDetail({ workout }: { workout: WorkoutResponse }) {
  const data = workout.recorded_data ?? {};
  const normalized = normalizeActivityType(workout.activity_type);

  if (normalized === 'run') return <RunDetail data={data} />;
  if (normalized === 'cycling') return <CyclingDetail data={data} />;
  if (normalized === 'swim') return <SwimDetail data={data} />;
  if (normalized === 'strength') return <StrengthDetail data={data} />;
  if (normalized === 'mobility') return <MobilityDetail data={data} />;
  return null;
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<any, 'WorkoutDetail'>;

export default function WorkoutDetailScreen({ route }: Props) {
  const { workoutId } = route.params as { workoutId: string };
  const [workout, setWorkout] = useState<WorkoutResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getWorkout(workoutId)
      .then(setWorkout)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [workoutId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load workout.</Text>
      </View>
    );
  }

  const icon = getActivityIcon(workout.activity_type);
  const label = activityTypeLabel(workout.activity_type);
  const duration = formatDuration(workout.started_at, workout.finished_at);
  const date = formatDate(workout.started_at);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.iconCircle}>
          <Ionicons name={icon} size={32} color={Colors.primary} />
        </View>
        <View>
          <Text style={styles.activityLabel}>{label}</Text>
          <Text style={styles.dateLabel}>{date}</Text>
        </View>
      </View>

      {/* Summary row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
          <Text style={styles.summaryValue}>{duration}</Text>
          <Text style={styles.summaryCaption}>Duration</Text>
        </View>
      </View>

      {/* Type-specific data */}
      <TypeSpecificDetail workout={workout} />

      {/* Notes */}
      {workout.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{workout.notes}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dateLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryCaption: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  statLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  exerciseBlock: {
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  setsTable: {
    gap: 4,
  },
  setHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  setColLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  setRow: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: 6,
    padding: 8,
    paddingHorizontal: 4,
  },
  setCell: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  mobilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.background,
  },
  mobilityInfo: {
    flex: 1,
  },
  mobilityDuration: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  notesText: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});
