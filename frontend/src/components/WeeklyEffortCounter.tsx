import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getWeeklyEffort } from '../services/api';

function getBarColor(progress: number, colors: { textSecondary: string; warning: string; success: string }): string {
  if (progress < 0.33) return colors.textSecondary;
  if (progress < 0.66) return colors.warning;
  return colors.success;
}

export function WeeklyEffortCounter() {
  const { colors } = useTheme();
  const [total, setTotal] = useState(0);
  const [goal, setGoal] = useState(300);
  const [workoutCount, setWorkoutCount] = useState(0);

  useFetchOnFocus(
    useCallback(async () => {
      const data = await getWeeklyEffort();
      setTotal(data.total_effort);
      setGoal(data.goal);
      setWorkoutCount(data.workout_count);
    }, []),
  );

  const progress = goal > 0 ? Math.min(total / goal, 1) : 0;
  const barColor = getBarColor(progress, colors);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="flame-outline" size={20} color={barColor} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Weekly Effort</Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {workoutCount} workout{workoutCount !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: barColor }]}>{total}</Text>
        <Text style={[styles.goal, { color: colors.textSecondary }]}> / {goal}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },
  count: {
    fontSize: 12,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  value: {
    fontSize: 28,
    fontWeight: '800',
  },
  goal: {
    fontSize: 16,
    fontWeight: '500',
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
});
