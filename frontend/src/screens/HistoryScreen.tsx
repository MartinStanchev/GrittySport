import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { getWorkouts, deleteWorkout } from '../services/api';
import type { WorkoutResponse } from '../services/api';
import { formatActivityType, getActivityIcon } from '../constants/activityIcons';
import { formatDuration, formatShortDate } from '../utils/dates';
import { pickWorkoutFile } from '../services/workoutFileParser';
import { KineticHeader, KineticPanel } from '../components/Kinetic';

const PAGE_SIZE = 20;

// ── Filter chip definitions ─────────────────────────────────────────────────

const ACTIVITY_FILTERS = [
  { key: '', label: 'All' },
  { key: 'run', label: 'Run' },
  { key: 'strength_training', label: 'Strength' },
  { key: 'swim', label: 'Swim' },
  { key: 'cycling', label: 'Cycling' },
  { key: 'drill', label: 'Drill' },
  { key: 'mobility', label: 'Mobility' },
] as const;

type DatePreset = 'all' | 'this_week' | 'this_month' | 'last_30' | 'last_90';

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All Time' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_30', label: 'Last 30 Days' },
  { key: 'last_90', label: 'Last 90 Days' },
];

function getDateRange(preset: DatePreset): { start_date?: string; end_date?: string } {
  if (preset === 'all') return {};

  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const end_date = fmt(now);

  let start: Date;
  switch (preset) {
    case 'this_week': {
      start = new Date(now);
      start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      break;
    }
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last_30':
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      break;
    case 'last_90':
      start = new Date(now);
      start.setDate(now.getDate() - 90);
      break;
  }

  return { start_date: fmt(start), end_date };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function keyStat(workout: WorkoutResponse): string {
  const data = workout.recorded_data ?? {};
  const type = workout.activity_type.toLowerCase();
  if ((workout.source === 'gps' || workout.source === 'apple_health' || workout.source === 'gpx') && data.distance_km) {
    return `${Number(data.distance_km).toFixed(2)} km`;
  }
  if (type.includes('strength') || type.includes('weight')) {
    const exercises: any[] = data.exercises ?? [];
    const totalSets = exercises.reduce((sum: number, ex: any) => sum + (ex.sets?.length ?? 0), 0);
    return totalSets > 0 ? `${totalSets} sets` : '';
  }
  if (type.includes('mobility') || type.includes('yoga') || type.includes('recovery')) {
    const exercises: any[] = data.exercises ?? [];
    const done = exercises.filter((e: any) => e.completed).length;
    return exercises.length > 0 ? `${done}/${exercises.length} done` : 'Completed';
  }
  if (data.distance_km) return `${Number(data.distance_km).toFixed(2)} km`;
  return 'Completed';
}

function sourceBadge(source: string): { icon: string; color: string } | null {
  if (source === 'apple_health') return { icon: 'heart', color: '#FF2D55' };
  if (source === 'health_connect') return { icon: 'fitness', color: '#34A853' };
  if (source === 'garmin') return { icon: 'watch-outline', color: '#007DC3' };
  if (source === 'gpx') return { icon: 'map-outline', color: '#2196F3' };
  return null;
}

// ── WorkoutRow ──────────────────────────────────────────────────────────────

function WorkoutRow({ workout, colors }: { workout: WorkoutResponse; colors: ThemeColors }) {
  const icon = getActivityIcon(workout.activity_type);
  const stat = keyStat(workout);
  const badge = sourceBadge(workout.source);

  return (
    <KineticPanel style={styles.row}>
      <View style={styles.rowInner}>
        <View style={[styles.rowIcon, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.rowContent}>
          <View style={styles.rowTypeRow}>
            <Text style={[styles.rowType, { color: colors.textPrimary }]}>
              {formatActivityType(workout.activity_type)}
            </Text>
            {badge ? (
              <Ionicons name={badge.icon as any} size={14} color={badge.color} style={{ marginLeft: 6 }} />
            ) : null}
          </View>
          <Text style={[styles.rowDate, { color: colors.textSecondary }]}>
            {formatShortDate(workout.started_at)}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <Text style={[styles.rowDuration, { color: colors.textPrimary }]}>
            {formatDuration(workout.started_at, workout.finished_at)}
          </Text>
          {stat ? <Text style={[styles.rowStat, { color: colors.textSecondary }]}>{stat}</Text> : null}
        </View>
      </View>
    </KineticPanel>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<any, 'HistoryMain'>;

export default function HistoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeFilter, setActiveFilter] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateModalVisible, setDateModalVisible] = useState(false);
  const offsetRef = useRef(0);

  const fetchWorkouts = useCallback(async (opts: {
    offset: number;
    activityType: string;
    datePreset: DatePreset;
    append?: boolean;
  }) => {
    const dateRange = getDateRange(opts.datePreset);
    const data = await getWorkouts({
      limit: PAGE_SIZE,
      offset: opts.offset,
      activity_type: opts.activityType || undefined,
      ...dateRange,
    });
    if (opts.append) {
      setWorkouts((prev) => [...prev, ...data]);
    } else {
      setWorkouts(data);
    }
    setHasMore(data.length === PAGE_SIZE);
    offsetRef.current = opts.offset + data.length;
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      await fetchWorkouts({ offset: 0, activityType: activeFilter, datePreset });
    } catch {
      // silently fail; empty state shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchWorkouts, activeFilter, datePreset]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      await fetchWorkouts({ offset: offsetRef.current, activityType: activeFilter, datePreset, append: true });
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false);
    }
  }, [fetchWorkouts, loadingMore, hasMore, activeFilter, datePreset]);

  // Load on mount and refresh when returning from LogActivity or WorkoutDetail
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const resetAndFetch = useCallback((activityType: string, preset: DatePreset) => {
    setWorkouts([]);
    setLoading(true);
    offsetRef.current = 0;
    fetchWorkouts({ offset: 0, activityType, datePreset: preset })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [fetchWorkouts]);

  const handleFilterChange = useCallback((filterKey: string) => {
    setActiveFilter(filterKey);
    resetAndFetch(filterKey, datePreset);
  }, [resetAndFetch, datePreset]);

  const handleDatePresetChange = useCallback((preset: DatePreset) => {
    setDatePreset(preset);
    setDateModalVisible(false);
    resetAndFetch(activeFilter, preset);
  }, [resetAndFetch, activeFilter]);

  const handleDeleteWorkout = useCallback((workout: WorkoutResponse) => {
    Alert.alert('Delete Workout', `Delete this ${formatActivityType(workout.activity_type)} workout?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(workout.id);
            setWorkouts((prev) => prev.filter((w) => w.id !== workout.id));
          } catch {
            Alert.alert('Error', 'Could not delete workout.');
          }
        },
      },
    ]);
  }, []);

  const dateLabel = DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? 'All Time';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <KineticHeader
        eyebrow="History"
        title="Activities Log"
        right={
          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('Import')} style={[styles.addBtn, { backgroundColor: colors.surface }]}>
              <Ionicons name="download-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable
              onPress={async () => {
                const file = await pickWorkoutFile();
                if (file) navigation.navigate('ImportPreview', { fileUri: file.uri, fileName: file.fileName });
              }}
              style={[styles.addBtn, { backgroundColor: colors.surface }]}
            >
              <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate('LogActivity')} style={[styles.addBtn, { backgroundColor: colors.primary }]}>
              <Ionicons name="add" size={18} color={colors.background} />
            </Pressable>
          </View>
        }
      />

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipScroll}>
        {ACTIVITY_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              activeFilter === f.key && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleFilterChange(f.key)}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, activeFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
        <Pressable
          style={[
            styles.chip,
            { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 },
            datePreset !== 'all' && { backgroundColor: colors.primary, borderColor: colors.primary },
          ]}
          onPress={() => setDateModalVisible(true)}
        >
          <Ionicons name="calendar-outline" size={14} color={datePreset === 'all' ? colors.textSecondary : '#FFF'} />
          <Text style={[styles.chipText, { color: colors.textSecondary }, datePreset !== 'all' && styles.chipTextActive]}>{dateLabel}</Text>
        </Pressable>
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}
              onLongPress={() => handleDeleteWorkout(item)}
            >
              <WorkoutRow workout={item} colors={colors} />
            </Pressable>
          )}
          contentContainerStyle={workouts.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <KineticPanel style={styles.emptyState}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="fitness-outline" size={28} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No workouts yet</Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Log a session, import a file, or sync Apple Health to start building your archive.
              </Text>
            </KineticPanel>
          }
        />
      )}

      {/* Date range modal */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDateModalVisible(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Date Range</Text>
            {DATE_PRESETS.map((p) => (
              <Pressable
                key={p.key}
                style={[styles.modalOption, datePreset === p.key && { backgroundColor: colors.primary + '12' }]}
                onPress={() => handleDatePresetChange(p.key)}
              >
                <Text style={[styles.modalOptionText, { color: colors.textPrimary }, datePreset === p.key && { fontWeight: '600', color: colors.primary }]}>
                  {p.label}
                </Text>
                {datePreset === p.key && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chipScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 12,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  chipTextActive: {
    color: '#FFF',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 28,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: Fonts.heading,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  row: {
    marginBottom: 12,
    padding: 16,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowType: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  rowDate: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowDuration: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  rowStat: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheet: {
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: Fonts.body,
  },
});
