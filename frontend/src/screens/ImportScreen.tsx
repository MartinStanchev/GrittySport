import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { getActivityIcon } from '../constants/activityIcons';
import { getUpcomingActivities, saveWorkout } from '../services/api';
import type { UpcomingActivity } from '../services/api';
import * as healthKit from '../services/healthKitService';
import type { HealthKitWorkoutSummary } from '../services/healthKitService';
import { getImportedUUIDs, markImported } from '../services/importedWorkoutsStore';

type Props = NativeStackScreenProps<any, 'Import'>;

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// ── Workout Row ──────────────────────────────────────────────────────────────

function WorkoutRow({
  workout,
  imported,
  onPress,
}: {
  workout: HealthKitWorkoutSummary;
  imported: boolean;
  onPress: () => void;
}) {
  const icon = getActivityIcon(workout.mappedActivityType);
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={imported}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={imported ? Colors.textSecondary : Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={[styles.rowType, imported && styles.rowDimmed]}>
            {workout.mappedActivityType.replace(/_/g, ' ')}
          </Text>
          {imported && (
            <View style={styles.importedBadge}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.textSecondary} />
              <Text style={styles.importedBadgeText}>Imported</Text>
            </View>
          )}
        </View>
        <Text style={[styles.rowMeta, imported && styles.rowDimmed]}>
          {formatDate(workout.startDate)} at {formatTime(workout.startDate)}
        </Text>
        <View style={styles.rowStats}>
          <Text style={[styles.rowStat, imported && styles.rowDimmed]}>
            {formatDuration(workout.durationSeconds)}
          </Text>
          {workout.distanceKm != null && workout.distanceKm > 0 && (
            <Text style={[styles.rowStat, imported && styles.rowDimmed]}>
              {workout.distanceKm.toFixed(2)} km
            </Text>
          )}
          {workout.totalEnergyBurnedKcal != null && (
            <Text style={[styles.rowStat, imported && styles.rowDimmed]}>
              {Math.round(workout.totalEnergyBurnedKcal)} kcal
            </Text>
          )}
        </View>
        {workout.sourceDevice && (
          <Text style={styles.sourceDevice}>{workout.sourceDevice}</Text>
        )}
      </View>
    </Pressable>
  );
}

// ── Import Detail Sheet ──────────────────────────────────────────────────────

function ImportDetailSheet({
  workout,
  visible,
  onClose,
  onImported,
}: {
  workout: HealthKitWorkoutSummary | null;
  visible: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const slideAnim = useState(() => new Animated.Value(400))[0];
  const opacityAnim = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (visible && workout) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 320 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();

      getUpcomingActivities()
        .then((activities) => {
          const compatible = activities.filter((a) => {
            const aType = a.activity_type.toLowerCase().replace(/\s+/g, '_');
            const wType = workout.mappedActivityType.toLowerCase();
            return aType.includes(wType) || wType.includes(aType);
          });
          setUpcomingActivities(compatible);
        })
        .catch(() => {});
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
      setSelectedActivityId(null);
      setUpcomingActivities([]);
    }
  }, [visible, workout, slideAnim, opacityAnim]);

  async function handleImport() {
    if (!workout) return;
    setImporting(true);
    setLoadingDetails(true);
    try {
      const [hrReadings, gpsPoints] = await Promise.all([
        healthKit.getWorkoutHeartRate(workout.startDate, workout.endDate),
        workout.isIndoor ? Promise.resolve([]) : healthKit.getWorkoutRoute(workout.uuid),
      ]);
      setLoadingDetails(false);

      const input = healthKit.buildSaveWorkoutInput(
        workout,
        hrReadings,
        gpsPoints,
        selectedActivityId ?? undefined,
      );

      const result = await saveWorkout(input);
      await markImported(workout.uuid, result.id);
      onImported();
      onClose();
    } catch (e: any) {
      Alert.alert('Import Failed', e?.message ?? 'Could not import workout.');
    } finally {
      setImporting(false);
      setLoadingDetails(false);
    }
  }

  if (!visible || !workout) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.sheetOverlay, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.sheetHandle} />
        <ScrollView style={styles.sheetScroll} bounces={false}>
          <Text style={styles.sheetTitle}>Import Workout</Text>

          <View style={styles.sheetSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>
                {workout.mappedActivityType.replace(/_/g, ' ')}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Date</Text>
              <Text style={styles.summaryValue}>
                {formatDate(workout.startDate)} at {formatTime(workout.startDate)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{formatDuration(workout.durationSeconds)}</Text>
            </View>
            {workout.distanceKm != null && workout.distanceKm > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Distance</Text>
                <Text style={styles.summaryValue}>{workout.distanceKm.toFixed(2)} km</Text>
              </View>
            )}
            {workout.totalEnergyBurnedKcal != null && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Calories</Text>
                <Text style={styles.summaryValue}>
                  {Math.round(workout.totalEnergyBurnedKcal)} kcal
                </Text>
              </View>
            )}
            {workout.sourceDevice && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Device</Text>
                <Text style={styles.summaryValue}>{workout.sourceDevice}</Text>
              </View>
            )}
          </View>

          {upcomingActivities.length > 0 && (
            <View style={styles.linkSection}>
              <Text style={styles.linkTitle}>Link to Scheduled Activity</Text>
              <Text style={styles.linkSubtitle}>
                Connect this import to a planned activity in your program
              </Text>
              {upcomingActivities.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  style={[
                    styles.linkOption,
                    selectedActivityId === a.id && styles.linkOptionSelected,
                  ]}
                  onPress={() =>
                    setSelectedActivityId(selectedActivityId === a.id ? null : a.id)
                  }
                >
                  <Ionicons
                    name={selectedActivityId === a.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={selectedActivityId === a.id ? Colors.primary : Colors.textSecondary}
                  />
                  <View style={styles.linkOptionContent}>
                    <Text style={styles.linkOptionType}>{a.activity_type}</Text>
                    <Text style={styles.linkOptionMeta}>
                      {a.date} - {a.phase_name}, Week {a.week_number}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.sheetActions}>
          {loadingDetails && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>Fetching heart rate & route data...</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.importButton, importing && styles.importButtonDisabled]}
            onPress={handleImport}
            disabled={importing}
          >
            {importing && !loadingDetails ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.importButtonText}>
                {selectedActivityId ? 'Import & Link' : 'Import as Unscheduled'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={importing}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ImportScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<HealthKitWorkoutSummary[]>([]);
  const [importedUUIDs, setImportedUUIDs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<HealthKitWorkoutSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      if (Platform.OS !== 'ios') {
        setAppleHealthEnabled(false);
        return;
      }
      const SecureStore = await import('expo-secure-store');
      const enabled = (await SecureStore.getItemAsync('apple_health_enabled')) === 'true';
      setAppleHealthEnabled(enabled);
      if (!enabled) return;

      const since = new Date();
      since.setDate(since.getDate() - 14);

      const [hkWorkouts, imported] = await Promise.all([
        healthKit.getRecentWorkouts(since),
        getImportedUUIDs(),
      ]);
      setWorkouts(hkWorkouts);
      setImportedUUIDs(imported);
    } catch (e) {
      console.warn('[Import] Failed to load:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (Platform.OS !== 'ios') {
    return (
      <View style={[styles.emptyContainer, { paddingBottom: insets.bottom }]}>
        <Ionicons name="phone-portrait-outline" size={48} color={Colors.textSecondary} />
        <Text style={styles.emptyTitle}>Not Available</Text>
        <Text style={styles.emptySubtitle}>
          Apple Health import is only available on iOS devices.
        </Text>
      </View>
    );
  }

  if (!appleHealthEnabled && !loading) {
    return (
      <View style={[styles.emptyContainer, { paddingBottom: insets.bottom }]}>
        <Ionicons name="heart-outline" size={48} color="#FF2D55" />
        <Text style={styles.emptyTitle}>Apple Health Not Connected</Text>
        <Text style={styles.emptySubtitle}>
          Enable Apple Health in Settings to import your workouts.
        </Text>
        <TouchableOpacity
          style={styles.goToSettingsButton}
          onPress={() => navigation.getParent()?.navigate('Settings')}
        >
          <Text style={styles.goToSettingsText}>Go to Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const sortedWorkouts = [...workouts].sort((a, b) => {
    const aImported = importedUUIDs.has(a.uuid);
    const bImported = importedUUIDs.has(b.uuid);
    if (aImported !== bImported) return aImported ? 1 : -1;
    return b.startDate.getTime() - a.startDate.getTime();
  });

  return (
    <View style={styles.flex}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingMainText}>Loading Apple Health workouts...</Text>
        </View>
      ) : workouts.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingBottom: insets.bottom }]}>
          <Ionicons name="fitness-outline" size={48} color={Colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Recent Workouts</Text>
          <Text style={styles.emptySubtitle}>
            No workouts found in Apple Health from the last 14 days.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedWorkouts}
          keyExtractor={(w) => w.uuid}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
          renderItem={({ item }) => (
            <WorkoutRow
              workout={item}
              imported={importedUUIDs.has(item.uuid)}
              onPress={() => {
                if (!importedUUIDs.has(item.uuid)) setSelectedWorkout(item);
              }}
            />
          )}
        />
      )}

      <ImportDetailSheet
        workout={selectedWorkout}
        visible={selectedWorkout != null}
        onClose={() => setSelectedWorkout(null)}
        onImported={loadData}
      />
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingMainText: { fontSize: 15, color: Colors.textSecondary },

  // Empty states
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  goToSettingsButton: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goToSettingsText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Workout list rows
  row: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowType: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    textTransform: 'capitalize',
  },
  rowDimmed: { color: Colors.textSecondary },
  rowMeta: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  rowStats: { flexDirection: 'row', gap: 12, marginTop: 6 },
  rowStat: { fontSize: 13, fontWeight: '500', color: Colors.textPrimary },
  importedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  importedBadgeText: { fontSize: 12, color: Colors.textSecondary },
  sourceDevice: { fontSize: 12, color: Colors.textSecondary, marginTop: 4 },

  // Bottom sheet
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.tabBarBorder,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  sheetScroll: { paddingHorizontal: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary, marginBottom: 16 },

  // Summary
  sheetSummary: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 14, color: Colors.textSecondary },
  summaryValue: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },

  // Link section
  linkSection: { marginBottom: 16 },
  linkTitle: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary, marginBottom: 4 },
  linkSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 10 },
  linkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.tabBarBorder,
    marginBottom: 6,
  },
  linkOptionSelected: { borderColor: Colors.primary, backgroundColor: '#FFF0F1' },
  linkOptionContent: { flex: 1 },
  linkOptionType: { fontSize: 14, fontWeight: '500', color: Colors.textPrimary },
  linkOptionMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },

  // Actions
  sheetActions: { padding: 20, gap: 10, borderTopWidth: 1, borderTopColor: Colors.tabBarBorder },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  loadingText: { fontSize: 13, color: Colors.textSecondary },
  importButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  importButtonDisabled: { opacity: 0.6 },
  importButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: Colors.textSecondary, fontSize: 15, fontWeight: '500' },
});
