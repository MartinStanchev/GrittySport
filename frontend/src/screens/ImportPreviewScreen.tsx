import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { formatTime } from '../constants/workoutUtils';
import { IMPORT_ACTIVITY_TYPES, getActivityIcon } from '../constants/activityIcons';
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
import { saveWorkout } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';
import { PostWorkoutReview } from '../components/PostWorkoutReview';
import { Fonts } from '../constants/fonts';
import {
  loadWorkoutParseResult,
  markWorkoutImported,
  getSourceLabel,
  type ExternalSource,
} from '../services/externalImportService';

interface RouteParams {
  // File flow
  fileUri?: string;
  fileName?: string;
  // Apple Health / Health Connect flow
  externalId?: string;
  externalSource?: ExternalSource;
  // Common
  scheduledActivityId?: string;
  preselectedType?: string;
}

export default function ImportPreviewScreen({ route, navigation }: any) {
  const { fileUri, fileName, externalId, externalSource, scheduledActivityId, preselectedType } =
    route.params as RouteParams;
  const insets = useSafeAreaInsets();
  const { notifyProgramDataChanged, requestOpenChat } = useProgram();
  const { colors } = useTheme();

  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For ZIP: which file the user selected to preview
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutFileParseResult | null>(null);

  useEffect(() => {
    (async () => {
      try {
        if (externalId) {
          const workout = await loadWorkoutParseResult(externalId);
          setParseResult({ kind: 'single', workout });
        } else if (fileUri && fileName) {
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
        } else {
          setError('No workout source provided.');
        }
      } catch (e: any) {
        setError(e.message || 'Failed to read workout.');
      } finally {
        setLoading(false);
      }
    })();
  }, [fileUri, fileName, externalId]);

  if (loading) {
    const loadingLabel = externalId
      ? `Loading ${getSourceLabel(externalSource ?? null) || 'workout'}...`
      : 'Parsing workout file...';
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loadingLabel}</Text>
      </View>
    );
  }

  if (error || !parseResult) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error || 'Unable to load workout'}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
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
      externalId={externalId}
      navigation={navigation}
      notifyProgramDataChanged={notifyProgramDataChanged}
      requestOpenChat={requestOpenChat}
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
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.zipHeader}>
        <Text style={[styles.zipTitle, { color: colors.textPrimary }]}>
          {data.workouts.length} workout{data.workouts.length !== 1 ? 's' : ''} found
        </Text>
        {data.errors.length > 0 && (
          <Text style={[styles.zipErrors, { color: colors.error }]}>
            {data.errors.length} file{data.errors.length !== 1 ? 's' : ''} failed to parse
          </Text>
        )}
      </View>

      <FlatList
        data={data.workouts}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        renderItem={({ item }) => (
          <Pressable style={[styles.zipRow, { backgroundColor: colors.surface }]} onPress={() => onSelect(item)}>
            <View style={[styles.zipRowIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="document-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.zipRowName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.zipRowMeta, { color: colors.textSecondary }]}>
                {item.sourceFormat.toUpperCase()}
                {item.totalDistanceM > 0 ? ` · ${formatDistanceKm(item.totalDistanceM)} km` : ''}
                {item.durationSec > 0 ? ` · ${formatTime(Math.round(item.durationSec))}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      />

      <Pressable style={styles.discardBtn} onPress={onGoBack}>
        <Text style={[styles.discardBtnText, { color: colors.textSecondary }]}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// ── Single workout preview ─────────────────────────────────────────────

function WorkoutPreview({
  workout,
  preselectedType,
  scheduledActivityId,
  externalId,
  navigation,
  notifyProgramDataChanged,
  requestOpenChat,
  insets,
  onBackToList,
}: {
  workout: WorkoutFileParseResult;
  preselectedType?: string;
  scheduledActivityId?: string;
  externalId?: string;
  navigation: any;
  notifyProgramDataChanged: () => void;
  requestOpenChat: () => void;
  insets: { bottom: number };
  onBackToList?: () => void;
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const maxHR = user?.max_heart_rate ?? 185;
  const [activityType, setActivityType] = useState(
    preselectedType ?? detectActivityType(workout),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    if (!savedWorkoutId) return;
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => navigation.getParent()?.navigate('Home', { screen: 'HomeMain' })} hitSlop={8}>
          <Text style={{ color: colors.primary, fontSize: 16, fontFamily: Fonts.bodySemiBold }}>Done</Text>
        </Pressable>
      ),
    });
  }, [savedWorkoutId, navigation, colors]);

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
      if (externalId) {
        await markWorkoutImported(externalId, saved.id);
      }
      notifyProgramDataChanged();
      setSavedWorkoutId(saved.id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      {/* Source format badge */}
      <View style={styles.formatBadgeRow}>
        <View style={[styles.formatBadge, { backgroundColor: colors.primary + '20' }]}>
          <Text style={[styles.formatBadgeText, { color: colors.primary }]}>
            {workout.sourceFormat.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Route map */}
      {routeData ? (
        <RouteMapPreview gpsRoute={routeData} style={styles.routeMap} />
      ) : (
        <View style={[styles.noMapPlaceholder, { backgroundColor: colors.surface }]}>
          <Ionicons name="map-outline" size={40} color={colors.textSecondary} />
          <Text style={[styles.noMapText, { color: colors.textSecondary }]}>No route to display</Text>
        </View>
      )}

      <View style={styles.body}>
        <Text style={[styles.activityTitle, { color: colors.textPrimary }]}>{workout.name}</Text>
        {workout.startTime && (
          <Text style={[styles.dateText, { color: colors.textSecondary }]}>
            {workout.startTime.toLocaleDateString(undefined, {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </Text>
        )}

        {/* Activity type selector */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Activity Type</Text>
          <View style={styles.typePicker}>
            {IMPORT_ACTIVITY_TYPES.map(({ type, label }) => (
              <Pressable
                key={type}
                style={[styles.typeChip, { backgroundColor: colors.surfaceAlt }, activityType === type && [styles.typeChipActive, { backgroundColor: colors.primary }]]}
                onPress={() => setActivityType(type)}
              >
                <Ionicons
                  name={getActivityIcon(type)}
                  size={14}
                  color={activityType === type ? '#FFF' : colors.textSecondary}
                />
                <Text style={[styles.typeChipText, { color: colors.textSecondary }, activityType === type && styles.typeChipTextActive]}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          {workout.totalDistanceM > 0 && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatDistanceKm(workout.totalDistanceM)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>km</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Distance</Text>
            </View>
          )}
          {workout.durationSec > 0 && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatTime(Math.round(workout.durationSec))}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Duration</Text>
            </View>
          )}
          {isRun && stats.pace > 0 && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatPaceSecPerKm(stats.pace)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>/km</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Pace</Text>
            </View>
          )}
          {!isRun && stats.speed > 0 && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatSpeedKph(stats.speed)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>km/h</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Speed</Text>
            </View>
          )}
          {workout.elevationGainM > 0 && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>+{workout.elevationGainM} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>m</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Elevation</Text>
            </View>
          )}
          {stats.avgHR != null && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.avgHR} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>bpm</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg HR</Text>
            </View>
          )}
          {stats.maxHR != null && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.maxHR} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>bpm</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Max HR</Text>
            </View>
          )}
          {stats.avgCad != null && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.avgCad} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>spm</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Cadence</Text>
            </View>
          )}
          {stats.avgPower != null && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.avgPower} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>W</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Power</Text>
            </View>
          )}
          {stats.maxPower != null && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stats.maxPower} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>W</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Max Power</Text>
            </View>
          )}
          {workout.caloriesKcal != null && (
            <View style={styles.statTile}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{Math.round(workout.caloriesKcal)} <Text style={[styles.statUnit, { color: colors.textSecondary }]}>kcal</Text></Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Calories</Text>
            </View>
          )}
        </View>

        {workout.sourceDevice && (
          <Text style={[styles.deviceText, { color: colors.textSecondary }]}>Recorded on {workout.sourceDevice}</Text>
        )}

        {/* HR Chart */}
        {workout.hrReadings.length > 5 && (
          <HROverTimeChart readings={workout.hrReadings} maxHR={maxHR} />
        )}

        {/* Laps table */}
        {workout.laps.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Laps</Text>
            <View style={[styles.lapHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.lapCell, styles.lapCellSmall, { color: colors.textPrimary }]}>#</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>Distance</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>Duration</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{isRun ? 'Pace' : 'Speed'}</Text>
              <Text style={[styles.lapCell, { color: colors.textPrimary }]}>HR</Text>
            </View>
            {workout.laps.map((lap) => (
              <View key={lap.lap_number} style={[styles.lapRow, { borderBottomColor: colors.surfaceAlt }]}>
                <Text style={[styles.lapCell, styles.lapCellSmall, { color: colors.textPrimary }]}>{lap.lap_number}</Text>
                <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{formatDistanceKm(lap.distance_m)}</Text>
                <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{formatTime(Math.round(lap.duration_sec))}</Text>
                <Text style={[styles.lapCell, { color: colors.textPrimary }]}>
                  {isRun
                    ? formatPaceSecPerKm(lap.avg_pace_sec_per_km)
                    : `${formatSpeedKph(lap.avg_speed_kph)}`
                  }
                </Text>
                <Text style={[styles.lapCell, { color: colors.textPrimary }]}>{lap.avg_hr ?? '-'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Notes</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.textPrimary }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Add notes about this workout..."
            placeholderTextColor={colors.textSecondary}
            textAlignVertical="top"
          />
        </View>

        {/* Actions / Review */}
        {savedWorkoutId ? (
          <PostWorkoutReview
            workoutId={savedWorkoutId}
            activityType={activityType}
            scheduledActivityId={scheduledActivityId}
            onContinueInChat={() => {
              requestOpenChat();
              navigation.getParent()?.navigate('Home', { screen: 'HomeMain' });
            }}
          />
        ) : (
          <>
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Workout'}</Text>
            </Pressable>
            {onBackToList ? (
              <Pressable style={styles.discardBtn} onPress={onBackToList}>
                <Text style={[styles.discardBtnText, { color: colors.textSecondary }]}>Back to File List</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.discardBtn} onPress={() => navigation.goBack()}>
                <Text style={[styles.discardBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
            )}
          </>
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 8,
  },
  errorText: {
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  formatBadgeText: {
    fontSize: 12,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  noMapText: {
    fontSize: 14,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  },
  typeChipActive: {},
  typeChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  statTile: {
    width: '50%',
    paddingVertical: 12,
    paddingRight: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
  deviceText: {
    fontSize: 12,
    marginBottom: 12,
  },
  lapHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  lapRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapCell: {
    flex: 1,
    fontSize: 13,
    textAlign: 'center',
  },
  lapCellSmall: {
    flex: 0.4,
  },
  notesInput: {
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  saveBtn: {
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
  },
  // ZIP list styles
  zipHeader: {
    padding: 16,
    gap: 4,
  },
  zipTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  zipErrors: {
    fontSize: 13,
  },
  zipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
  },
  zipRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zipRowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  zipRowMeta: {
    fontSize: 12,
    marginTop: 2,
  },
});
