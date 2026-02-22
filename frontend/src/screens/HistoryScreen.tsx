import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors } from '../constants/colors';
import { getWorkouts } from '../services/api';
import type { WorkoutResponse } from '../services/api';
import { getActivityIcon } from '../constants/activityIcons';

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
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function keyStat(workout: WorkoutResponse): string {
  const data = workout.recorded_data ?? {};
  const type = workout.activity_type.toLowerCase();
  // GPS workouts — show distance
  if (workout.source === 'gps' && data.distance_km) {
    return `${Number(data.distance_km).toFixed(2)} km`;
  }
  if (type.includes('strength') || type.includes('weight')) {
    const exercises: any[] = data.exercises ?? [];
    const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length ?? 0), 0);
    return totalSets > 0 ? `${totalSets} sets` : '';
  }
  if (type.includes('mobility') || type.includes('yoga') || type.includes('recovery')) {
    const exercises: any[] = data.exercises ?? [];
    const done = exercises.filter((e) => e.completed).length;
    return exercises.length > 0 ? `${done}/${exercises.length} done` : 'Completed';
  }
  // Non-GPS run/cycling with distance
  if (data.distance_km) return `${Number(data.distance_km).toFixed(2)} km`;
  return 'Completed';
}

function WorkoutRow({ workout }: { workout: WorkoutResponse }) {
  const icon = getActivityIcon(workout.activity_type);
  const stat = keyStat(workout);

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowType}>{workout.activity_type}</Text>
        <Text style={styles.rowDate}>{formatDate(workout.started_at)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowDuration}>{formatDuration(workout.started_at, workout.finished_at)}</Text>
        {stat ? <Text style={styles.rowStat}>{stat}</Text> : null}
      </View>
    </View>
  );
}

type Props = NativeStackScreenProps<any, 'HistoryMain'>;

export default function HistoryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [workouts, setWorkouts] = useState<WorkoutResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getWorkouts({ limit: 50 });
      setWorkouts(data);
    } catch {
      // silently fail; empty state shown
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load on mount and refresh when returning from LogActivity or WorkoutDetail
  useEffect(() => {
    return navigation.addListener('focus', () => load());
  }, [navigation, load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTORY</Text>
        <Pressable onPress={() => navigation.navigate('LogActivity')} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
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
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="fitness-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>Tap the + button to log your first workout</Text>
            </View>
          }
        />
      )}
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
    paddingBottom: 12,
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
});
