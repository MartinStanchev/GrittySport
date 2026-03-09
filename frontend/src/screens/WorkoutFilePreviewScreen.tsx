import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { formatTime } from '../constants/workoutUtils';
import { GPS_ACTIVITY_TYPES, getActivityIcon } from '../constants/activityIcons';
import { RouteMapPreview } from '../components/RouteMapPreview';
import { HROverTimeChart } from '../components/WorkoutCharts';
import { useAuth } from '../contexts/AuthContext';
import {
  parseWorkoutFile,
  detectActivityType,
  buildFileSavePayload,
  type WorkoutFileParseResult,
  type ParseResult,
} from '../services/workoutFileParser';
import type { ZipParseResult } from '../services/parsers/zipHandler';
import {
  formatPaceSecPerKm,
  formatSpeedKph,
  formatDistanceKm,
  isRunSport,
  avgPaceSecPerKm,
  avgSpeedKph,
} from '../services/gpsUtils';
import {
  saveWorkout,
  linkWorkoutToActivity,
  getUpcomingActivities,
} from '../services/api';
import { useProgram } from '../contexts/ProgramContext';

interface RouteParams {
  fileUri: string;
  fileName: string;
  scheduledActivityId?: string;
  preselectedType?: string;
}

export default function WorkoutFilePreviewScreen({ route, navigation }: any) {
  const { fileUri, fileName, scheduledActivityId, preselectedType } = route.params as RouteParams;
  const insets = useSafeAreaInsets();
  const { notifyProgramDataChanged } = useProgram();

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For ZIP: which file the user selected to preview
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutFileParseResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await parseWorkoutFile(fileUri, fileName);

        if (result.kind === 'single') {
          if (result.workout.points.length === 0 && result.workout.hrReadings.length === 0) {
            setError('No workout data found in this file.');
            return;
          }
          setParseResult(result);
        } else {
          // ZIP
          if (result.data.workouts.length === 0) {
            const errorMsg = result.data.errors.length > 0
              ? `Failed to parse files:\n${result.data.errors.map((e) => `${e.filename}: ${e.error}`).join('\n')}`
              : 'No supported workout files found in this ZIP.';
            setError(errorMsg);
            return;
          }
          setParseResult(result);
          if (result.data.workouts.length === 1) {
            setSelectedWorkout(result.data.workouts[0]);
          }
        }
      } catch (e: any) {
        setError(e.message || 'Failed to read workout file.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fileUri, fileName]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Parsing workout file...</Text>
      </View>
    );
  }

  if (error || !parseResult) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.errorText}>{error || 'Unable to parse file'}</Text>
        <Pressable style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ZIP with multiple files — show file list
  if (parseResult.kind === 'zip' && !selectedWorkout) {
    return (
      <ZipFileList
        data={parseResult.data}
        onSelect={setSelectedWorkout}
        onGoBack={() => navigation.goBack()}
        insets={insets}
      />
    );
  }

  const workout = parseResult.kind === 'single' ? parseResult.workout : selectedWorkout!;

  return (
    <WorkoutPreview
      workout={workout}
      preselectedType={preselectedType}
      scheduledActivityId={scheduledActivityId}
      navigation={navigation}
      notifyProgramDataChanged={notifyProgramDataChanged}
      insets={insets}
      onBackToList={parseResult.kind === 'zip' ? () => setSelectedWorkout(null) : undefined}
    />
  );
}

// ── ZIP file list ──────────────────────────────────────────────────────

function ZipFileList({
  data,
  onSelect,
  onGoBack,
  insets,
}: {
  data: ZipParseResult;
  onSelect: (w: WorkoutFileParseResult) => void;
  onGoBack: () => void;
  insets: { bottom: number };
}) {
  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.zipHeader}>
        <Text style={styles.zipTitle}>
          {data.workouts.length} workout{data.workouts.length !== 1 ? 's' : ''} found
        </Text>
        {data.errors.length > 0 && (
          <Text style={styles.zipErrors}>
            {data.errors.length} file{data.errors.length !== 1 ? 's' : ''} failed to parse
          </Text>
        )}
      </View>

      <FlatList
        data={data.workouts}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable style={styles.zipRow} onPress={() => onSelect(item)}>
            <View style={styles.zipRowIcon}>
              <Ionicons name="document-outline" size={22} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.zipRowName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.zipRowMeta}>
                {item.sourceFormat.toUpperCase()}
                {item.totalDistanceM > 0 ? ` · ${formatDistanceKm(item.totalDistanceM)} km` : ''}
                {item.durationSec > 0 ? ` · ${formatTime(Math.round(item.durationSec))}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textSecondary} />
          </Pressable>
        )}
      />

      <Pressable style={styles.discardBtn} onPress={onGoBack}>
        <Text style={styles.discardBtnText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Single workout preview ─────────────────────────────────────────────

function WorkoutPreview({
  workout,
  preselectedType,
  scheduledActivityId,
  navigation,
  notifyProgramDataChanged,
  insets,
  onBackToList,
}: {
  workout: WorkoutFileParseResult;
  preselectedType?: string;
  scheduledActivityId?: string;
  navigation: any;
  notifyProgramDataChanged: () => void;
  insets: { bottom: number };
  onBackToList?: () => void;
}) {
  const { user } = useAuth();
  const maxHR = user?.max_heart_rate ?? 185;
  const [activityType, setActivityType] = useState(
    preselectedType ?? detectActivityType(workout),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const isRun = isRunSport(activityType);

  const stats = useMemo(() => {
    const pace = avgPaceSecPerKm(workout.totalDistanceM, workout.durationSec);
    const speed = avgSpeedKph(workout.totalDistanceM, workout.durationSec);

    let hrSum = 0, hrMax = 0;
    for (const r of workout.hrReadings) {
      hrSum += r.bpm;
      if (r.bpm > hrMax) hrMax = r.bpm;
    }

    let cadSum = 0;
    for (const r of workout.cadenceReadings) cadSum += r.spm;

    let powerSum = 0, powerMax = 0;
    for (const r of workout.powerReadings) {
      powerSum += r.watts;
      if (r.watts > powerMax) powerMax = r.watts;
    }

    const hrLen = workout.hrReadings.length;
    const cadLen = workout.cadenceReadings.length;
    const pwrLen = workout.powerReadings.length;

    return {
      pace,
      speed,
      avgHR: hrLen > 0 ? Math.round(hrSum / hrLen) : null,
      maxHR: hrLen > 0 ? hrMax : null,
      avgCad: cadLen > 0 ? Math.round(cadSum / cadLen) : null,
      avgPower: pwrLen > 0 ? Math.round(powerSum / pwrLen) : null,
      maxPower: pwrLen > 0 ? powerMax : null,
    };
  }, [workout]);

  const routeData = useMemo(() => {
    if (workout.points.length < 2) return null;
    return { points: workout.points };
  }, [workout]);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = buildFileSavePayload(workout, activityType, notes, scheduledActivityId);
      const saved = await saveWorkout(payload);
      notifyProgramDataChanged();
      navigation.goBack();

      if (!scheduledActivityId) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const activities = await getUpcomingActivities();
          const todayActivity = activities.find((a) => a.date === today);
          if (todayActivity) {
            const label = todayActivity.activity_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
            Alert.alert(
              'Link to Program?',
              `Link this workout to your "${label}" activity?`,
              [
                { text: 'Skip', style: 'cancel' },
                { text: 'Link', onPress: () => linkWorkoutToActivity(saved.id, todayActivity.id) },
              ],
            );
          }
        } catch { /* linking is best-effort */ }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      {/* Source format badge */}
      <View style={styles.formatBadgeRow}>
        <View style={styles.formatBadge}>
          <Text style={styles.formatBadgeText}>{workout.sourceFormat.toUpperCase()}</Text>
        </View>
      </View>

      {/* Route map */}
      {routeData ? (
        <RouteMapPreview gpsRoute={routeData} style={styles.routeMap} />
      ) : (
        <View style={styles.noMapPlaceholder}>
          <Ionicons name="map-outline" size={40} color={Colors.textSecondary} />
          <Text style={styles.noMapText}>No route to display</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.activityTitle}>{workout.name}</Text>
        {workout.startTime && (
          <Text style={styles.dateText}>
            {workout.startTime.toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </Text>
        )}

        {/* Activity type selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Activity Type</Text>
          <View style={styles.typePicker}>
            {GPS_ACTIVITY_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[styles.typeChip, activityType === type && styles.typeChipActive]}
                onPress={() => setActivityType(type)}
              >
                <Ionicons
                  name={getActivityIcon(type)}
                  size={14}
                  color={activityType === type ? '#FFF' : Colors.textSecondary}
                />
                <Text style={[styles.typeChipText, activityType === type && styles.typeChipTextActive]}>
                  {type.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {workout.totalDistanceM > 0 && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{formatDistanceKm(workout.totalDistanceM)} <Text style={styles.statUnit}>km</Text></Text>
              <Text style={styles.statLabel}>Distance</Text>
            </View>
          )}
          {workout.durationSec > 0 && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{formatTime(Math.round(workout.durationSec))}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          )}
          {isRun && stats.pace > 0 && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{formatPaceSecPerKm(stats.pace)} <Text style={styles.statUnit}>/km</Text></Text>
              <Text style={styles.statLabel}>Avg Pace</Text>
            </View>
          )}
          {!isRun && stats.speed > 0 && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{formatSpeedKph(stats.speed)} <Text style={styles.statUnit}>km/h</Text></Text>
              <Text style={styles.statLabel}>Avg Speed</Text>
            </View>
          )}
          {workout.elevationGainM > 0 && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>+{workout.elevationGainM} <Text style={styles.statUnit}>m</Text></Text>
              <Text style={styles.statLabel}>Elevation</Text>
            </View>
          )}
          {stats.avgHR != null && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{stats.avgHR} <Text style={styles.statUnit}>bpm</Text></Text>
              <Text style={styles.statLabel}>Avg HR</Text>
            </View>
          )}
          {stats.maxHR != null && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{stats.maxHR} <Text style={styles.statUnit}>bpm</Text></Text>
              <Text style={styles.statLabel}>Max HR</Text>
            </View>
          )}
          {stats.avgCad != null && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{stats.avgCad} <Text style={styles.statUnit}>spm</Text></Text>
              <Text style={styles.statLabel}>Cadence</Text>
            </View>
          )}
          {stats.avgPower != null && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{stats.avgPower} <Text style={styles.statUnit}>W</Text></Text>
              <Text style={styles.statLabel}>Avg Power</Text>
            </View>
          )}
          {stats.maxPower != null && (
            <View style={styles.statTile}>
              <Text style={styles.statValue}>{stats.maxPower} <Text style={styles.statUnit}>W</Text></Text>
              <Text style={styles.statLabel}>Max Power</Text>
            </View>
          )}
        </View>

        {/* HR Chart */}
        {workout.hrReadings.length > 5 && (
          <HROverTimeChart readings={workout.hrReadings} maxHR={maxHR} />
        )}

        {/* Laps table */}
        {workout.laps.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Laps</Text>
            <View style={styles.lapHeader}>
              <Text style={[styles.lapCell, styles.lapCellSmall]}>#</Text>
              <Text style={styles.lapCell}>Distance</Text>
              <Text style={styles.lapCell}>Duration</Text>
              <Text style={styles.lapCell}>{isRun ? 'Pace' : 'Speed'}</Text>
              <Text style={styles.lapCell}>HR</Text>
            </View>
            {workout.laps.map((lap) => (
              <View key={lap.lap_number} style={styles.lapRow}>
                <Text style={[styles.lapCell, styles.lapCellSmall]}>{lap.lap_number}</Text>
                <Text style={styles.lapCell}>{formatDistanceKm(lap.distance_m)}</Text>
                <Text style={styles.lapCell}>{formatTime(Math.round(lap.duration_sec))}</Text>
                <Text style={styles.lapCell}>
                  {isRun
                    ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
                    : `${formatSpeedKph(lap.avg_speed_kph)}`
                  }
                </Text>
                <Text style={styles.lapCell}>{lap.avg_hr ?? '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Add notes about this workout..."
            placeholderTextColor="#BBB"
            textAlignVertical="top"
          />
        </View>

        {/* Save / Back actions */}
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Workout'}</Text>
        </Pressable>

        {onBackToList ? (
          <Pressable style={styles.discardBtn} onPress={onBackToList}>
            <Text style={styles.discardBtnText}>Back to File List</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.discardBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.discardBtnText}>Cancel</Text>
          </Pressable>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  formatBadgeRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
  },
  formatBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  routeMap: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  noMapPlaceholder: {
    height: 180,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noMapText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  typePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  statTile: {
    width: '50%',
    paddingVertical: 12,
    paddingRight: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
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
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  lapCell: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  lapCellSmall: {
    flex: 0.4,
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  discardBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  discardBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  // ZIP list styles
  zipHeader: {
    padding: 16,
    gap: 4,
  },
  zipTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  zipErrors: {
    fontSize: 13,
    color: '#E57373',
  },
  zipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  zipRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zipRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  zipRowMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
