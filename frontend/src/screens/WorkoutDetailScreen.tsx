import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Polyline, UrlTile } from '../components/NativeMap';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { getActivityIcon } from '../constants/activityIcons';
import { getWorkout, getUpcomingActivities, linkWorkoutToActivity } from '../services/api';
import type { WorkoutResponse } from '../services/api';
import { formatPaceSecPerKm, formatSpeedKph, isRunSport } from '../services/gpsUtils';
import { formatTime } from '../constants/workoutUtils';
import { useAuth } from '../contexts/AuthContext';
import { HROverTimeChart, PaceOverTimeChart, SpeedOverTimeChart, CadenceChart } from '../components/WorkoutCharts';

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
  const s = Math.floor(paceSecPerKm % 60);
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

type LinkOption = { id: string; activityType: string; dateLabel: string };

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

function GPSDetail({ workout }: { workout: WorkoutResponse }) {
  const route = workout.gps_route ?? {};
  const summary = workout.recorded_data ?? {};
  const hrData = workout.heart_rate_data;
  const isRun = isRunSport(workout.activity_type);
  const laps: any[] = route.laps ?? [];
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;

  const points: { latitude: number; longitude: number }[] = (route.points ?? []).map((p: any) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const mapRegion =
    points.length > 1
      ? {
          latitude: (points[0].latitude + points[points.length - 1].latitude) / 2,
          longitude: (points[0].longitude + points[points.length - 1].longitude) / 2,
          latitudeDelta: Math.abs(points[0].latitude - points[points.length - 1].latitude) * 2 + 0.01,
          longitudeDelta: Math.abs(points[0].longitude - points[points.length - 1].longitude) * 2 + 0.01,
        }
      : { latitude: 51.5074, longitude: -0.1278, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <>
      {points.length > 1 && (
        <MapView
          style={styles.gpsMap}
          region={mapRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
        >
          {Platform.OS === 'android' && (
            <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
          )}
          <Polyline coordinates={points} strokeColor={Colors.primary} strokeWidth={4} />
        </MapView>
      )}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>GPS Stats</Text>
        <StatRow label="Distance" value={summary.distance_km ? `${Number(summary.distance_km).toFixed(2)} km` : '—'} />
        {isRun && <StatRow label="Avg Pace" value={formatPaceSecPerKm(summary.avg_pace_sec_per_km ?? 0)} />}
        {!isRun && <StatRow label="Avg Speed" value={summary.avg_speed_kph ? `${formatSpeedKph(summary.avg_speed_kph)} km/h` : '—'} />}
        <StatRow label="Elevation Gain" value={summary.elevation_gain_m ? `+${summary.elevation_gain_m} m` : '—'} />
        {summary.avg_hr && <StatRow label="Avg Heart Rate" value={`${summary.avg_hr} bpm`} />}
        {summary.max_hr && <StatRow label="Max Heart Rate" value={`${summary.max_hr} bpm`} />}
        {summary.avg_cadence && <StatRow label="Avg Cadence" value={`${summary.avg_cadence} spm`} />}
      </View>

      {/* Charts */}
      {hrData?.readings && hrData.readings.length > 5 && (
        <HROverTimeChart readings={hrData.readings} maxHR={maxHR} />
      )}

      {route.points && route.points.length > 10 && isRun && (
        <PaceOverTimeChart points={route.points} />
      )}

      {route.points && route.points.length > 10 && !isRun && (
        <SpeedOverTimeChart points={route.points} />
      )}

      {hrData?.cadence_readings && hrData.cadence_readings.length > 5 && (
        <CadenceChart readings={hrData.cadence_readings} />
      )}

      {laps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lap Splits</Text>
          <View style={styles.lapHeader}>
            <Text style={[styles.lapCell, styles.lapCellLabel]}>Lap</Text>
            <Text style={[styles.lapCell, styles.lapCellLabel]}>Dist</Text>
            <Text style={[styles.lapCell, styles.lapCellLabel]}>Time</Text>
            <Text style={[styles.lapCell, styles.lapCellLabel]}>{isRun ? 'Pace' : 'Speed'}</Text>
          </View>
          {laps.map((lap: any) => (
            <View key={lap.lap_number} style={styles.lapRow}>
              <Text style={styles.lapCell}>{lap.lap_number}</Text>
              <Text style={styles.lapCell}>{(lap.distance_m / 1000).toFixed(2)} km</Text>
              <Text style={styles.lapCell}>{formatTime(Math.round(lap.duration_sec))}</Text>
              <Text style={styles.lapCell}>
                {isRun
                  ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
                  : `${formatSpeedKph(lap.avg_speed_kph)} km/h`}
              </Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function TypeSpecificDetail({ workout }: { workout: WorkoutResponse }) {
  const data = workout.recorded_data ?? {};
  const normalized = normalizeActivityType(workout.activity_type);

  if (workout.source === 'gps') return <GPSDetail workout={workout} />;
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
  const [linkSheetVisible, setLinkSheetVisible] = useState(false);
  const [linkOptions, setLinkOptions] = useState<LinkOption[]>([]);
  const slideAnim = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const loadWorkout = useCallback(() => {
    getWorkout(workoutId)
      .then(setWorkout)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [workoutId]);

  useEffect(() => { loadWorkout(); }, [loadWorkout]);

  const openLinkSheet = useCallback((options: LinkOption[]) => {
    setLinkOptions(options);
    setLinkSheetVisible(true);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 320 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  const closeLinkSheet = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 200, duration: 180, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setLinkSheetVisible(false));
  }, [slideAnim, opacityAnim]);

  const handleLink = useCallback(async (activityId: string) => {
    if (!workout) return;
    closeLinkSheet();
    try {
      await linkWorkoutToActivity(workout.id, activityId);
      loadWorkout();
    } catch {
      Alert.alert('Error', 'Could not link workout.');
    }
  }, [workout, closeLinkSheet, loadWorkout]);

  const handleLinkToProgram = useCallback(async () => {
    if (!workout) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const activities = await getUpcomingActivities();
      if (activities.length === 0) {
        Alert.alert('No Activities', 'No upcoming program activities found.');
        return;
      }
      const options = activities.slice(0, 5).map((a) => ({
        id: a.id,
        activityType: a.activity_type,
        dateLabel: a.date === today
          ? 'Today'
          : new Date(a.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      }));
      openLinkSheet(options);
    } catch {
      Alert.alert('Error', 'Could not load program activities.');
    }
  }, [workout, openLinkSheet]);

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
    <>
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

      {/* Link to Program */}
      {!workout.scheduled_activity_id && (
        <Pressable style={styles.linkBtn} onPress={handleLinkToProgram}>
          <Ionicons name="link-outline" size={16} color={Colors.primary} />
          <Text style={styles.linkBtnText}>Link to Program Activity</Text>
        </Pressable>
      )}
    </ScrollView>

    <Modal visible={linkSheetVisible} transparent animationType="none" onRequestClose={closeLinkSheet}>
      <Animated.View style={[styles.sheetBackdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeLinkSheet} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Link to Program Activity</Text>
            <Text style={styles.sheetSubtitle}>Select the scheduled activity for this workout</Text>
          </View>
          <View style={styles.sheetSeparator} />
          {linkOptions.map((opt, i) => (
            <View key={opt.id}>
              {i > 0 && <View style={styles.sheetSeparator} />}
              <Pressable style={styles.sheetRow} onPress={() => handleLink(opt.id)}>
                <View style={[styles.sheetRowIcon, { backgroundColor: Colors.primary + '18' }]}>
                  <Ionicons name={getActivityIcon(opt.activityType)} size={22} color={Colors.primary} />
                </View>
                <View style={styles.sheetRowText}>
                  <Text style={styles.sheetRowTitle}>{activityTypeLabel(opt.activityType)}</Text>
                  <Text style={styles.sheetRowSubtitle}>{opt.dateLabel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ))}
          <View style={styles.sheetSeparator} />
          <Pressable style={[styles.sheetRow, styles.sheetCancelRow]} onPress={closeLinkSheet}>
            <Text style={styles.sheetCancelText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
    </>
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
  gpsMap: {
    height: 200,
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  lapHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    marginBottom: 4,
  },
  lapRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  lapCell: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  lapCellLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 14,
    marginTop: 4,
  },
  linkBtnText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
  },
  sheetHeader: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#EBEBEB',
    marginHorizontal: 18,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  sheetRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowText: { flex: 1 },
  sheetRowTitle: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
  sheetRowSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  sheetCancelRow: { justifyContent: 'center' },
  sheetCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
});
