import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteMapPreview } from '../components/RouteMapPreview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { getActivityIcon, formatActivityType } from '../constants/activityIcons';
import { formatDuration, formatFullDate, formatRelativeDay } from '../utils/dates';
import { getWorkout, getLinkableActivities, linkWorkoutToActivity, getWorkoutAnalytics, deleteWorkout } from '../services/api';
import type { WorkoutResponse } from '../services/api';
import type { WorkoutAnalytics, GPSPoint, HRReading } from '../types/gps';
import { formatPaceSecPerKm, formatSpeedKph, isRunSport, computeEffortScore, computeKmSplits, computeMaxPaceAndSpeed, estimateCalories } from '../services/gpsUtils';
import { formatTime } from '../constants/workoutUtils';
import { useAuth } from '../contexts/AuthContext';
import { isPremium } from '../utils/premium';
import { HROverTimeChart, CadenceChart } from '../components/WorkoutCharts';
import { PremiumStatsCard } from '../components/PremiumStatsCard';
import { EffortScoreCard } from '../components/EffortScoreCard';
import { SplitsCard } from '../components/SplitsCard';
import { ProgramAlignmentCard } from '../components/ProgramAlignmentCard';
import { PRBadge } from '../components/PRBadge';
import { CardiacEfficiencyCard } from '../components/CardiacEfficiencyCard';
import { WeeklyTrendCard } from '../components/WeeklyTrendCard';

// ── Helpers ────────────────────────────────────────────────────────────────────

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


const SOURCE_BADGES: Record<string, { icon: string; color: string; label: string }> = {
  apple_health: { icon: 'heart', color: '#FF2D55', label: 'Apple Health' },
  garmin: { icon: 'watch-outline', color: '#007DC3', label: 'Garmin' },
  gpx: { icon: 'map-outline', color: '#2196F3', label: 'GPX Import' },
};

// ── Stat Components ────────────────────────────────────────────────────────────

interface StatItem {
  label: string;
  value: string;
  unit?: string;
}

function StatGrid({ stats }: { stats: StatItem[] }) {
  const { colors } = useTheme();
  const filtered = stats.filter((s) => s.value && s.value !== '—');
  if (filtered.length === 0) return null;
  return (
    <View style={styles.statGrid}>
      {filtered.map((stat) => (
        <View key={stat.label} style={styles.statTile}>
          <View style={styles.statTileValueRow}>
            <Text style={[styles.statTileValue, { color: colors.textPrimary }]}>{stat.value}</Text>
            {stat.unit && <Text style={[styles.statTileUnit, { color: colors.textSecondary }]}>{stat.unit}</Text>}
          </View>
          <Text style={[styles.statTileLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ── Detail Section Renderers ────────────────────────────────────────────────────

function RunDetail({ data }: { data: Record<string, any> }) {
  const stats: StatItem[] = [
    { label: 'Distance', value: data.distance_km ? `${data.distance_km}` : '', unit: 'km' },
    { label: 'Avg Pace', value: data.avg_pace_sec_per_km ? formatPaceSecPerKm(data.avg_pace_sec_per_km) : '', unit: '/km' },
  ];
  return <StatGrid stats={stats} />;
}

function CyclingDetail({ data }: { data: Record<string, any> }) {
  const stats: StatItem[] = [
    { label: 'Distance', value: data.distance_km ? `${data.distance_km}` : '', unit: 'km' },
    { label: 'Avg Speed', value: data.avg_speed_kph ? `${data.avg_speed_kph}` : '', unit: 'km/h' },
  ];
  return <StatGrid stats={stats} />;
}

function SwimDetail({ data }: { data: Record<string, any> }) {
  const stats: StatItem[] = [
    { label: 'Distance', value: data.distance_m ? `${data.distance_m}` : '', unit: 'm' },
    ...(data.laps ? [{ label: 'Laps', value: String(data.laps) }] : []),
  ];
  return <StatGrid stats={stats} />;
}

function StrengthDetail({ data }: { data: Record<string, any> }) {
  const { colors } = useTheme();
  const exercises: any[] = data.exercises ?? [];
  if (exercises.length === 0) return null;
  return (
    <View style={styles.detailSection}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Exercises</Text>
      {exercises.map((ex: any, i: number) => (
        <View key={i} style={styles.exerciseBlock}>
          <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name || `Exercise ${i + 1}`}</Text>
          {(ex.sets ?? []).length > 0 && (
            <View style={styles.setsTable}>
              <View style={styles.setHeaderRow}>
                <Text style={[styles.setColLabel, { flex: 1, color: colors.textSecondary }]}>Set</Text>
                <Text style={[styles.setColLabel, { flex: 2, color: colors.textSecondary }]}>Reps</Text>
                <Text style={[styles.setColLabel, { flex: 2, color: colors.textSecondary }]}>Weight</Text>
                <Text style={[styles.setColLabel, { flex: 1, color: colors.textSecondary }]}>RPE</Text>
              </View>
              {(ex.sets ?? []).map((s: any, si: number) => (
                <View key={si} style={[styles.setRow, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.setCell, { flex: 1, color: colors.textPrimary }]}>{si + 1}</Text>
                  <Text style={[styles.setCell, { flex: 2, color: colors.textPrimary }]}>{s.reps ?? '—'}</Text>
                  <Text style={[styles.setCell, { flex: 2, color: colors.textPrimary }]}>{s.weight ? `${s.weight} kg` : '—'}</Text>
                  <Text style={[styles.setCell, { flex: 1, color: colors.textPrimary }]}>{s.rpe ?? '—'}</Text>
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
  const { colors } = useTheme();
  const exercises: any[] = data.exercises ?? [];
  if (exercises.length === 0) return null;
  return (
    <View style={styles.detailSection}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Exercises</Text>
      {exercises.map((ex: any, i: number) => {
        const durSec = ex.duration_seconds ?? 0;
        const durLabel = durSec > 0 ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : '—';
        return (
          <View key={i} style={[styles.mobilityRow, { borderBottomColor: colors.border }]}>
            <Ionicons
              name={ex.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={ex.completed ? colors.primary : colors.textSecondary}
            />
            <View style={styles.mobilityInfo}>
              <Text style={[styles.exerciseName, { color: colors.textPrimary }]}>{ex.name || `Exercise ${i + 1}`}</Text>
              <Text style={[styles.mobilityDuration, { color: colors.textSecondary }]}>{durLabel}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function GPSDetail({ workout }: { workout: WorkoutResponse }) {
  const { colors } = useTheme();
  const route = workout.gps_route ?? {};
  const summary = workout.recorded_data ?? {};
  const hrData = workout.heart_rate_data;
  const isRun = isRunSport(workout.activity_type);
  const laps: any[] = route.laps ?? [];
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;

  const points: GPSPoint[] = useMemo(() => (route.points ?? []) as GPSPoint[], [route.points]);
  const hrReadings = useMemo(() => hrData?.readings ?? [], [hrData?.readings]);

  const { maxPaceSecPerKm, maxSpeedKph } = useMemo(
    () => computeMaxPaceAndSpeed(points),
    [points],
  );

  const durationSec = route.duration_sec ?? (
    workout.finished_at && workout.started_at
      ? (new Date(workout.finished_at).getTime() - new Date(workout.started_at).getTime()) / 1000
      : 0
  );
  const calories = useMemo(
    () => estimateCalories(workout.activity_type, durationSec, user?.weight_kg ?? 70),
    [workout.activity_type, durationSec, user?.weight_kg],
  );

  const effortData = useMemo(
    () => hrReadings.length >= 2 ? computeEffortScore(hrReadings, maxHR, durationSec) : null,
    [hrReadings, maxHR, durationSec],
  );

  const splitsData = useMemo(() => {
    if (points.length < 20) return null;
    const data = computeKmSplits(points, hrReadings);
    return data.splits.length > 0 ? data : null;
  }, [points, hrReadings]);

  const stats: StatItem[] = [
    { label: 'Distance', value: summary.distance_km ? Number(summary.distance_km).toFixed(2) : '', unit: 'km' },
    isRun
      ? { label: 'Avg Pace', value: formatPaceSecPerKm(summary.avg_pace_sec_per_km ?? 0), unit: '/km' }
      : { label: 'Avg Speed', value: summary.avg_speed_kph ? formatSpeedKph(summary.avg_speed_kph) : '', unit: 'km/h' },
    isRun && maxPaceSecPerKm > 0
      ? { label: 'Best Pace', value: formatPaceSecPerKm(maxPaceSecPerKm), unit: '/km' }
      : !isRun && maxSpeedKph > 0
        ? { label: 'Top Speed', value: formatSpeedKph(maxSpeedKph), unit: 'km/h' }
        : { label: '', value: '' },
    { label: 'Elevation', value: summary.elevation_gain_m ? `+${Math.round(summary.elevation_gain_m)}` : '', unit: 'm' },
    calories > 0 ? { label: 'Calories', value: `${calories}`, unit: 'kcal' } : { label: '', value: '' },
    summary.avg_hr ? { label: 'Avg HR', value: `${summary.avg_hr}`, unit: 'bpm' } : { label: '', value: '' },
    summary.max_hr ? { label: 'Max HR', value: `${summary.max_hr}`, unit: 'bpm' } : { label: '', value: '' },
    effortData && effortData.score > 0
      ? { label: 'Effort', value: `${effortData.score}/100`, unit: effortData.label }
      : { label: '', value: '' },
    summary.avg_cadence ? { label: 'Cadence', value: `${summary.avg_cadence}`, unit: 'spm' } : { label: '', value: '' },
  ];

  return (
    <>
      <RouteMapPreview gpsRoute={route} style={styles.gpsMap} />
      <StatGrid stats={stats} />

      {hrReadings.length > 5 && (
        <HROverTimeChart readings={hrReadings} maxHR={maxHR} />
      )}

      {hrData?.cadence_readings && hrData.cadence_readings.length > 5 && (
        <CadenceChart readings={hrData.cadence_readings} />
      )}

      {laps.length > 0 && (
        <View style={styles.detailSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Lap Splits</Text>
          <View style={[styles.lapHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>Lap</Text>
            <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>Dist</Text>
            <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>Time</Text>
            <Text style={[styles.lapCell, styles.lapCellLabel, { color: colors.textSecondary }]}>{isRun ? 'Pace' : 'Speed'}</Text>
          </View>
          {laps.map((lap: any) => (
            <View key={lap.lap_number} style={[styles.lapRow, { borderBottomColor: colors.surfaceAlt }]}>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{lap.lap_number}</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{(lap.distance_m / 1000).toFixed(2)} km</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{formatTime(Math.round(lap.duration_sec))}</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>
                {isRun
                  ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
                  : `${formatSpeedKph(lap.avg_speed_kph)} km/h`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {splitsData && <SplitsCard data={splitsData} />}
    </>
  );
}

function HROnlyDetail({ workout }: { workout: WorkoutResponse }) {
  const hrData = workout.heart_rate_data;
  const summary = workout.recorded_data ?? {};
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;
  const hrReadings: HRReading[] = useMemo(() => hrData?.readings ?? [], [hrData?.readings]);

  const durationSec = workout.gps_route?.duration_sec ?? (
    workout.finished_at && workout.started_at
      ? (new Date(workout.finished_at).getTime() - new Date(workout.started_at).getTime()) / 1000
      : 0
  );
  const effortData = useMemo(
    () => hrReadings.length >= 2 ? computeEffortScore(hrReadings, maxHR, durationSec) : null,
    [hrReadings, maxHR, durationSec],
  );

  const stats: StatItem[] = [
    summary.avg_hr ? { label: 'Avg HR', value: `${summary.avg_hr}`, unit: 'bpm' } : { label: '', value: '' },
    summary.max_hr ? { label: 'Max HR', value: `${summary.max_hr}`, unit: 'bpm' } : { label: '', value: '' },
    effortData && effortData.score > 0
      ? { label: 'Effort', value: `${effortData.score}/100`, unit: effortData.label }
      : { label: '', value: '' },
    summary.avg_cadence ? { label: 'Cadence', value: `${summary.avg_cadence}`, unit: 'spm' } : { label: '', value: '' },
  ];

  return (
    <>
      <StatGrid stats={stats} />

      {hrReadings.length > 5 && (
        <HROverTimeChart readings={hrReadings} maxHR={maxHR} />
      )}

      {hrData?.cadence_readings && hrData.cadence_readings.length > 5 && (
        <CadenceChart readings={hrData.cadence_readings} />
      )}
    </>
  );
}

function TypeSpecificDetail({ workout }: { workout: WorkoutResponse }) {
  const data = workout.recorded_data ?? {};
  const normalized = normalizeActivityType(workout.activity_type);
  const hasGPSRoute = workout.gps_route && (workout.gps_route as any).points?.length > 0;
  const hasHRData = (workout.heart_rate_data?.readings?.length ?? 0) > 0;

  if (hasGPSRoute) {
    return <GPSDetail workout={workout} />;
  }

  let typeDetail = null as ReturnType<typeof RunDetail> | null;
  switch (normalized) {
    case 'run':
      typeDetail = <RunDetail data={data} />;
      break;
    case 'cycling':
      typeDetail = <CyclingDetail data={data} />;
      break;
    case 'swim':
      typeDetail = <SwimDetail data={data} />;
      break;
    case 'strength':
      typeDetail = <StrengthDetail data={data} />;
      break;
    case 'mobility':
      typeDetail = <MobilityDetail data={data} />;
      break;
  }

  return (
    <>
      {typeDetail}
      {hasHRData && <HROnlyDetail workout={workout} />}
    </>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<any, 'WorkoutDetail'>;

export default function WorkoutDetailScreen({ route, navigation }: Props) {
  const { workoutId } = route.params as { workoutId: string };
  const { user } = useAuth();
  const { colors } = useTheme();
  const userIsPremium = isPremium(user);
  const [workout, setWorkout] = useState<WorkoutResponse | null>(null);
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [linkSheetVisible, setLinkSheetVisible] = useState(false);
  const [linkOptions, setLinkOptions] = useState<LinkOption[]>([]);
  const slideAnim = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const loadWorkout = useCallback(() => {
    const promises: [Promise<WorkoutResponse>, Promise<WorkoutAnalytics | null>] = [
      getWorkout(workoutId),
      userIsPremium ? getWorkoutAnalytics(workoutId).catch(() => null) : Promise.resolve(null),
    ];
    Promise.all(promises)
      .then(([w, a]) => {
        setWorkout(w);
        if (a) setAnalytics(a);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [workoutId, userIsPremium]);

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
      const referenceDate = new Date(workout.started_at).toISOString().split('T')[0];
      const activities = await getLinkableActivities(workout.activity_type, { referenceDate });
      if (activities.length === 0) {
        Alert.alert('No Activities', 'No matching program activities within the last week.');
        return;
      }
      const workoutDate = new Date(workout.started_at);
      const options = activities.slice(0, 5).map((a) => ({
        id: a.id,
        activityType: a.activity_type,
        dateLabel: formatRelativeDay(a.date, workoutDate),
      }));
      openLinkSheet(options);
    } catch {
      Alert.alert('Error', 'Could not load program activities.');
    }
  }, [workout, openLinkSheet]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Workout', 'This workout will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(workoutId);
            navigation.goBack();
          } catch {
            Alert.alert('Error', 'Could not delete workout.');
          }
        },
      },
    ]);
  }, [workoutId, navigation]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !workout) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>Failed to load workout.</Text>
      </View>
    );
  }

  const icon = getActivityIcon(workout.activity_type);
  const label = formatActivityType(workout.activity_type);
  const duration = formatDuration(workout.started_at, workout.finished_at);
  const date = formatFullDate(workout.started_at);
  const badge = SOURCE_BADGES[workout.source] ?? null;

  const hasGPSOrHR = !!(workout.gps_route && (workout.gps_route as any).points?.length > 0)
    || !!workout.heart_rate_data?.readings?.length;
  const hasAnalyticsContent = analytics && (
    analytics.effort_score > 0 ||
    analytics.program_alignment ||
    (analytics.personal_records && analytics.personal_records.length > 0) ||
    analytics.trend ||
    analytics.cardiac_efficiency ||
    analytics.weekly_trend
  );
  const showPremiumAnalytics = userIsPremium ? !!hasAnalyticsContent : hasGPSOrHR;

  return (
    <>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerSection}>
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '12' }]}>
            <Ionicons name={icon} size={28} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTopRow}>
              <Text style={[styles.activityLabel, { color: colors.textPrimary }]}>{label}</Text>
              {badge && (
                <View style={[styles.sourceBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                  <Text style={[styles.sourceBadgeText, { color: colors.textSecondary }]}>{badge.label}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.dateLabel, { color: colors.textSecondary }]}>{date}</Text>
          </View>
        </View>
        <Text style={[styles.durationLabel, { color: colors.textPrimary }]}>{duration}</Text>
      </View>

      <View style={[styles.separator, { backgroundColor: colors.border }]} />

      {/* Type-specific data */}
      <TypeSpecificDetail workout={workout} />

      {/* Premium Analytics */}
      {showPremiumAnalytics && (
        <PremiumStatsCard isPremium={userIsPremium} title="Analytics">
          {analytics && (
            <>
              {analytics.effort_score > 0 && (
                <EffortScoreCard data={{ score: analytics.effort_score, label: analytics.effort_label }} />
              )}

              {analytics.cardiac_efficiency && (
                <CardiacEfficiencyCard data={analytics.cardiac_efficiency} />
              )}

              {analytics.program_alignment && (
                <ProgramAlignmentCard data={analytics.program_alignment} />
              )}

              {analytics.personal_records && analytics.personal_records.length > 0 && (
                <View style={styles.prSection}>
                  <Text style={[styles.prSectionTitle, { color: colors.textPrimary }]}>Personal Records</Text>
                  {analytics.personal_records.map((pr) => (
                    <View key={pr.category} style={styles.prRow}>
                      <PRBadge />
                      <View style={styles.prInfo}>
                        <Text style={[styles.prCategory, { color: colors.textPrimary }]}>{pr.category}</Text>
                        {pr.formatted_value ? (
                          <Text style={[styles.prValue, { color: colors.textSecondary }]}>
                            {pr.formatted_value}
                            {pr.improvement_pct != null && pr.improvement_pct > 0
                              ? ` (+${pr.improvement_pct.toFixed(1)}%)`
                              : ''}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {analytics.weekly_trend && (
                <WeeklyTrendCard data={analytics.weekly_trend} />
              )}

              {!analytics.weekly_trend && analytics.trend && (
                <Text style={[styles.trendText, { color: colors.textSecondary }]}>
                  {analytics.trend.comparison_text}
                </Text>
              )}
            </>
          )}
        </PremiumStatsCard>
      )}

      {/* Notes */}
      {workout.notes ? (
        <View style={styles.detailSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Notes</Text>
          <Text style={[styles.notesText, { color: colors.textPrimary }]}>{workout.notes}</Text>
        </View>
      ) : null}

      {/* Link to Program */}
      {!workout.scheduled_activity_id && (
        <Pressable style={[styles.linkBtn, { borderColor: colors.primary }]} onPress={handleLinkToProgram}>
          <Ionicons name="link-outline" size={16} color={colors.primary} />
          <Text style={[styles.linkBtnText, { color: colors.primary }]}>Link to Program Activity</Text>
        </Pressable>
      )}

      {/* Delete */}
      <Pressable style={[styles.deleteBtn, { borderColor: colors.error }]} onPress={handleDelete}>
        <Ionicons name="trash-outline" size={16} color={colors.error} />
        <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Workout</Text>
      </Pressable>
    </ScrollView>

    <Modal visible={linkSheetVisible} transparent animationType="none" onRequestClose={closeLinkSheet}>
      <Animated.View style={[styles.sheetBackdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeLinkSheet} />
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Link to Program Activity</Text>
            <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>Select the scheduled activity for this workout</Text>
          </View>
          <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />
          {linkOptions.map((opt, i) => (
            <View key={opt.id}>
              {i > 0 && <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />}
              <Pressable style={styles.sheetRow} onPress={() => handleLink(opt.id)}>
                <View style={[styles.sheetRowIcon, { backgroundColor: colors.primary + '18' }]}>
                  <Ionicons name={getActivityIcon(opt.activityType)} size={22} color={colors.primary} />
                </View>
                <View style={styles.sheetRowText}>
                  <Text style={[styles.sheetRowTitle, { color: colors.textPrimary }]}>{formatActivityType(opt.activityType)}</Text>
                  <Text style={[styles.sheetRowSubtitle, { color: colors.textSecondary }]}>{opt.dateLabel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
          <View style={[styles.sheetSeparator, { backgroundColor: colors.border }]} />
          <Pressable style={[styles.sheetRow, styles.sheetCancelRow]} onPress={closeLinkSheet}>
            <Text style={[styles.sheetCancelText, { color: colors.textSecondary }]}>Cancel</Text>
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
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 15,
  },

  // Header
  headerSection: {
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: {
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  dateLabel: {
    fontSize: 14,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  durationLabel: {
    fontSize: 32,
    fontFamily: Fonts.heading,
    marginTop: 16,
    letterSpacing: -0.5,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sourceBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodyMedium,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 20,
  },

  // Stats grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  statTile: {
    width: '50%',
    paddingVertical: 12,
    paddingRight: 8,
  },
  statTileValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statTileValue: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    letterSpacing: -0.3,
  },
  statTileUnit: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  statTileLabel: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 2,
  },

  // Detail sections (laps, exercises, notes)
  detailSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Exercise styles
  exerciseBlock: {
    marginBottom: 16,
  },
  exerciseName: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
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
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  setRow: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 8,
    paddingHorizontal: 4,
  },
  setCell: {
    fontSize: 14,
  },
  mobilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  mobilityInfo: {
    flex: 1,
  },
  mobilityDuration: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  notesText: {
    fontSize: 15,
    fontFamily: Fonts.body,
    lineHeight: 22,
  },
  gpsMap: {
    height: 200,
    borderRadius: 14,
    marginBottom: 20,
    overflow: 'hidden',
  },

  // Lap table
  lapHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  lapRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapCell: {
    flex: 1,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  lapCellLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
  },

  // PR section
  prSection: {
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  prSectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prInfo: {
    flex: 1,
  },
  prCategory: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  prValue: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontVariant: ['tabular-nums'] as any,
    marginTop: 1,
  },
  trendText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 8,
  },

  // Link button
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 4,
  },
  linkBtnText: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 12,
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sheet: {
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
    fontFamily: Fonts.headingMedium,
  },
  sheetSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 3,
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
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
  sheetRowTitle: { fontSize: 16, fontFamily: Fonts.headingMedium },
  sheetRowSubtitle: { fontSize: 13, fontFamily: Fonts.body, marginTop: 1 },
  sheetCancelRow: { justifyContent: 'center' },
  sheetCancelText: {
    fontSize: 16,
    fontFamily: Fonts.bodyMedium,
    textAlign: 'center',
    flex: 1,
  },
});
