import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getWorkouts, type WorkoutResponse } from '../services/api';
import { getActivityIcon, formatActivityType, formatPrescriptionSummary, formatActivityDate } from '../constants/activityIcons';

interface UpcomingActivity {
  id: string;
  activity_type: string;
  prescription: Record<string, any>;
  date: string;
}

interface ActivityDashboardProps {
  upcomingActivities: UpcomingActivity[];
  onWorkoutPress: (workoutId: string) => void;
  onActivityPress: (activityId: string) => void;
}

function formatDuration(startedAt: string, finishedAt?: string): string {
  if (!finishedAt) return '';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ActivityDashboard({ upcomingActivities, onWorkoutPress, onActivityPress }: ActivityDashboardProps) {
  const { colors } = useTheme();
  const [lastWorkout, setLastWorkout] = useState<WorkoutResponse | null>(null);

  useFetchOnFocus(
    useCallback(async () => {
      const workouts = await getWorkouts({ limit: 1 });
      setLastWorkout(workouts.length > 0 ? workouts[0] : null);
    }, []),
  );

  const nextActivity = upcomingActivities.length > 0 ? upcomingActivities[0] : null;

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity</Text>
      <View style={styles.row}>
        {/* Last Workout */}
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={lastWorkout ? () => onWorkoutPress(lastWorkout.id) : undefined}
          disabled={!lastWorkout}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name={lastWorkout ? getActivityIcon(lastWorkout.activity_type) : 'fitness-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Last Workout</Text>
          </View>
          {lastWorkout ? (
            <>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {formatActivityType(lastWorkout.activity_type)}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                {formatDuration(lastWorkout.started_at, lastWorkout.finished_at)}
                {lastWorkout.finished_at ? ' \u00B7 ' : ''}
                {formatShortDate(lastWorkout.started_at)}
              </Text>
            </>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No workouts yet</Text>
          )}
        </Pressable>

        {/* Next Activity */}
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={nextActivity ? () => onActivityPress(nextActivity.id) : undefined}
          disabled={!nextActivity}
        >
          <View style={styles.cardHeader}>
            <Ionicons
              name={nextActivity ? getActivityIcon(nextActivity.activity_type) : 'calendar-outline'}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Next Up</Text>
          </View>
          {nextActivity ? (
            <>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {formatActivityType(nextActivity.activity_type)}
              </Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                {formatActivityDate(nextActivity.date)}
                {formatPrescriptionSummary(nextActivity.prescription)
                  ? ` \u00B7 ${formatPrescriptionSummary(nextActivity.prescription)}`
                  : ''}
              </Text>
            </>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No upcoming activities</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  cardMeta: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
});
