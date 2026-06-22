import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getWorkouts, type WorkoutResponse } from '../services/api';
import { getActivityIcon, formatActivityType } from '../constants/activityIcons';
import { formatDuration, formatRelativeDate } from '../utils/dates';

interface LastWorkoutCardProps {
  onPress: (workoutId: string) => void;
}

export function LastWorkoutCard({ onPress }: LastWorkoutCardProps) {
  const [workout, setWorkout] = useState<WorkoutResponse | null>(null);

  useFetchOnFocus(
    useCallback(async () => {
      const workouts = await getWorkouts({ limit: 1 });
      setWorkout(workouts.length > 0 ? workouts[0] : null);
    }, []),
  );

  if (!workout) return null;

  return <LastWorkoutCardView workout={workout} onPress={onPress} />;
}

interface LastWorkoutCardViewProps {
  workout: WorkoutResponse;
  onPress: (workoutId: string) => void;
}

// Presentational body — no data fetching, safe to render headless.
export function LastWorkoutCardView({ workout, onPress }: LastWorkoutCardViewProps) {
  const { colors } = useTheme();

  const duration = formatDuration(workout.started_at, workout.finished_at);
  const icon = getActivityIcon(workout.activity_type);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => onPress(workout.id)}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>LAST WORKOUT</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {formatActivityType(workout.activity_type)}
        </Text>
      </View>
      <View style={styles.meta}>
        {duration ? (
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>{duration}</Text>
        ) : null}
        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
          {formatRelativeDate(workout.started_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  metaText: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
});
