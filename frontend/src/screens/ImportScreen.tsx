import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { getActivityIcon } from '../constants/activityIcons';
import * as healthKit from '../services/healthKitService';
import type { HealthKitWorkoutSummary } from '../services/healthKitService';
import { getImportedUUIDs } from '../services/importedWorkoutsStore';
import { KineticHeader, KineticPanel } from '../components/Kinetic';

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
  colors,
}: {
  workout: HealthKitWorkoutSummary;
  imported: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const icon = getActivityIcon(workout.mappedActivityType);
  return (
    <Pressable
      style={styles.rowWrap}
      onPress={onPress}
      disabled={imported}
    >
      <KineticPanel style={[styles.row, imported && styles.importedRow]} tone={imported ? 'alt' : 'surface'}>
        <View style={[styles.rowIcon, { backgroundColor: colors.background }]}>
          <Ionicons name={icon} size={20} color={imported ? colors.textSecondary : colors.primary} />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <Text style={[styles.rowType, { color: colors.textPrimary }, imported && { color: colors.textSecondary }]}>
              {workout.mappedActivityType.replace(/_/g, ' ')}
            </Text>
            {imported && (
              <View style={styles.importedBadge}>
                <Ionicons name="checkmark-circle" size={14} color={colors.textSecondary} />
                <Text style={[styles.importedBadgeText, { color: colors.textSecondary }]}>Imported</Text>
              </View>
            )}
          </View>
          <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>
            {formatDate(workout.startDate)} at {formatTime(workout.startDate)}
          </Text>
          <View style={styles.rowStats}>
            <Text style={[styles.rowStat, { color: colors.textPrimary }, imported && { color: colors.textSecondary }]}>
              {formatDuration(workout.durationSeconds)}
            </Text>
            {workout.distanceKm != null && workout.distanceKm > 0 && (
              <Text style={[styles.rowStat, { color: colors.textPrimary }, imported && { color: colors.textSecondary }]}>
                {workout.distanceKm.toFixed(2)} km
              </Text>
            )}
            {workout.totalEnergyBurnedKcal != null && (
              <Text style={[styles.rowStat, { color: colors.textPrimary }, imported && { color: colors.textSecondary }]}>
                {Math.round(workout.totalEnergyBurnedKcal)} kcal
              </Text>
            )}
          </View>
          {workout.sourceDevice && (
            <Text style={[styles.sourceDevice, { color: colors.textSecondary }]}>{workout.sourceDevice}</Text>
          )}
        </View>
      </KineticPanel>
    </Pressable>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ImportScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<HealthKitWorkoutSummary[]>([]);
  const [importedUUIDs, setImportedUUIDs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appleHealthEnabled, setAppleHealthEnabled] = useState(false);

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

  // Refresh on focus so newly-imported UUIDs grey out when returning from preview.
  // Wrapper is needed because useFocusEffect expects a sync callback (void return),
  // not the Promise returned by `loadData`.
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  if (Platform.OS !== 'ios') {
    return (
      <View style={[styles.emptyContainer, { paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
        <Ionicons name="phone-portrait-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Not Available</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Apple Health import is only available on iOS devices.
        </Text>
      </View>
    );
  }

  if (!appleHealthEnabled && !loading) {
    return (
      <View style={[styles.emptyContainer, { paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
        <Ionicons name="heart-outline" size={48} color="#FF2D55" />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Apple Health Not Connected</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          Enable Apple Health in Settings to import your workouts.
        </Text>
        <TouchableOpacity
          style={[styles.goToSettingsButton, { backgroundColor: colors.primary }]}
          onPress={() => navigation.getParent()?.navigate('Settings')}
        >
          <Text style={[styles.goToSettingsText, { color: colors.surface }]}>Go to Settings</Text>
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
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <KineticHeader
        eyebrow="Import"
        title="External workouts"
        subtitle="Bring sessions in from Apple Health and link them back to your plan."
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingMainText, { color: colors.textSecondary }]}>Loading Apple Health workouts...</Text>
        </View>
      ) : workouts.length === 0 ? (
        <View style={[styles.emptyContainer, { paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
          <Ionicons name="fitness-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No Recent Workouts</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            No workouts found in Apple Health from the last 14 days.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sortedWorkouts}
          keyExtractor={(w) => w.uuid}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <WorkoutRow
              workout={item}
              imported={importedUUIDs.has(item.uuid)}
              onPress={() => navigation.navigate('ImportPreview', {
                healthKitUuid: item.uuid,
                preselectedType: item.mappedActivityType,
              })}
              colors={colors}
            />
          )}
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingMainText: { fontSize: 15 },

  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  goToSettingsButton: {
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  goToSettingsText: { fontSize: 15, fontWeight: '600' },

  // Workout list rows
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  rowWrap: {
    marginBottom: 12,
  },
  importedRow: {
    opacity: 0.76,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: { flex: 1 },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowType: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
    textTransform: 'capitalize',
  },
  rowMeta: { fontSize: 13, fontFamily: Fonts.body, marginTop: 2 },
  rowStats: { flexDirection: 'row', gap: 12, marginTop: 6 },
  rowStat: { fontSize: 13, fontFamily: Fonts.bodySemiBold },
  importedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  importedBadgeText: { fontSize: 12, fontFamily: Fonts.bodyMedium },
  sourceDevice: { fontSize: 12, fontFamily: Fonts.body, marginTop: 4 },
});
