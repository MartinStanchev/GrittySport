import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../constants/colors';
import { getWorkouts } from '../services/api';
import type { WorkoutResponse } from '../services/api';
import { getActivityIcon } from '../constants/activityIcons';
import { formatDuration, formatShortDate } from '../utils/dates';
import { pickWorkoutFile } from '../services/workoutFileParser';

const PAGE_SIZE = 20;

// ── Filter chip definitions ─────────────────────────────────────────────────

const ACTIVITY_FILTERS = [
  { key: '', label: 'All' },
  { key: 'run', label: 'Run' },
  { key: 'strength', label: 'Strength' },
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
  if (source === 'garmin') return { icon: 'watch-outline', color: '#007DC3' };
  if (source === 'gpx') return { icon: 'map-outline', color: '#2196F3' };
  return null;
}

function completionIcon(status?: string): { name: string; color: string } | null {
  if (status === 'met_targets' || status === 'completed') {
    return { name: 'checkmark-circle', color: '#34C759' };
  }
  if (status === 'below_targets') {
    return { name: 'alert-circle', color: '#FF9500' };
  }
  return null;
}

// ── WorkoutRow ──────────────────────────────────────────────────────────────

function WorkoutRow({ workout }: { workout: WorkoutResponse }) {
  const icon = getActivityIcon(workout.activity_type);
  const stat = keyStat(workout);
  const badge = sourceBadge(workout.source);
  const statusIcon = completionIcon(workout.completion_status);

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <View style={styles.rowTypeRow}>
          <Text style={styles.rowType}>{workout.activity_type}</Text>
          {badge && (
            <Ionicons name={badge.icon as any} size={14} color={badge.color} style={{ marginLeft: 6 }} />
          )}
          {statusIcon && (
            <Ionicons name={statusIcon.name as any} size={16} color={statusIcon.color} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={styles.rowDate}>{formatShortDate(workout.started_at)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowDuration}>{formatDuration(workout.started_at, workout.finished_at)}</Text>
        {stat ? <Text style={styles.rowStat}>{stat}</Text> : null}
      </View>
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────────────

type Props = NativeStackScreenProps<any, 'HistoryMain'>;

export default function HistoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
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

  const dateLabel = DATE_PRESETS.find((p) => p.key === datePreset)?.label ?? 'All Time';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTORY</Text>
        <Pressable onPress={() => navigation.navigate('Import')} style={styles.addBtn}>
          <Ionicons name="download-outline" size={22} color={Colors.primary} />
        </Pressable>
        <Pressable
          onPress={async () => {
            const file = await pickWorkoutFile();
            if (file) navigation.navigate('WorkoutFilePreview', { fileUri: file.uri, fileName: file.fileName });
          }}
          style={styles.addBtn}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
        </Pressable>
        <Pressable onPress={() => navigation.navigate('LogActivity')} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </Pressable>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {ACTIVITY_FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, activeFilter === f.key && styles.chipActive]}
              onPress={() => handleFilterChange(f.key)}
            >
              <Text style={[styles.chipText, activeFilter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable style={styles.dateBtn} onPress={() => setDateModalVisible(true)}>
          <Ionicons name="calendar-outline" size={16} color={datePreset === 'all' ? Colors.textSecondary : Colors.primary} />
          <Text style={[styles.dateBtnText, datePreset !== 'all' && { color: Colors.primary }]}>{dateLabel}</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('WorkoutDetail', { workoutId: item.id })}>
              <WorkoutRow workout={item} />
            </Pressable>
          )}
          contentContainerStyle={workouts.length === 0 ? styles.emptyContainer : styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="fitness-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>Tap the + button to log your first workout</Text>
            </View>
          }
        />
      )}

      {/* Date range modal */}
      <Modal visible={dateModalVisible} transparent animationType="fade" onRequestClose={() => setDateModalVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDateModalVisible(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Date Range</Text>
            {DATE_PRESETS.map((p) => (
              <Pressable
                key={p.key}
                style={[styles.modalOption, datePreset === p.key && styles.modalOptionActive]}
                onPress={() => handleDatePresetChange(p.key)}
              >
                <Text style={[styles.modalOptionText, datePreset === p.key && styles.modalOptionTextActive]}>
                  {p.label}
                </Text>
                {datePreset === p.key && (
                  <Ionicons name="checkmark" size={18} color={Colors.primary} />
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  addBtn: {
    padding: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  chipScroll: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipTextActive: {
    color: '#FFF',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E5',
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
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
  },
  rowDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  rowStat: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSheet: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
  modalOptionActive: {
    backgroundColor: Colors.primary + '12',
  },
  modalOptionText: {
    fontSize: 15,
    color: Colors.textPrimary,
  },
  modalOptionTextActive: {
    fontWeight: '600',
    color: Colors.primary,
  },
});
