import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getRecentWorkoutsCached } from '../services/cachedReads';
import { getActivityIcon, formatActivityType } from '../constants/activityIcons';

interface QuickStartSectionProps {
  onRepeatLast: (activityType: string) => void;
  onStartWorkout: () => void;
  onLogActivity: () => void;
  onImportFile: () => void;
}

export function QuickStartSection({
  onRepeatLast,
  onStartWorkout,
  onLogActivity,
  onImportFile,
}: QuickStartSectionProps) {
  const { colors } = useTheme();
  const [lastType, setLastType] = useState<string | null>(null);

  useFetchOnFocus(
    useCallback(async () => {
      const workouts = await getRecentWorkoutsCached();
      setLastType(workouts.length > 0 ? workouts[0].activity_type : null);
    }, []),
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Ionicons name="rocket-outline" size={16} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Quick Start</Text>
      </View>

      <View style={styles.grid}>
        {/* Repeat Last */}
        {lastType ? (
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
            onPress={() => onRepeatLast(lastType)}
            activeOpacity={0.7}
          >
            <Ionicons name={getActivityIcon(lastType)} size={22} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]} numberOfLines={1}>
              {formatActivityType(lastType)}
            </Text>
            <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Repeat last</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
            onPress={onStartWorkout}
            activeOpacity={0.7}
          >
            <Ionicons name="fitness-outline" size={22} color={colors.primary} />
            <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>New Workout</Text>
            <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Get started</Text>
          </TouchableOpacity>
        )}

        {/* Start Workout */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          onPress={onStartWorkout}
          activeOpacity={0.7}
        >
          <Ionicons name="play-circle-outline" size={22} color={colors.secondary} />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Start</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Track live</Text>
        </TouchableOpacity>

        {/* Log Activity */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          onPress={onLogActivity}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={22} color={colors.tertiary} />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Log</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>Past workout</Text>
        </TouchableOpacity>

        {/* Import */}
        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
          onPress={onImportFile}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={22} color={colors.info} />
          <Text style={[styles.actionLabel, { color: colors.textPrimary }]}>Import</Text>
          <Text style={[styles.actionSub, { color: colors.textSecondary }]}>GPX, FIT, TCX</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionCard: {
    width: '47%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  actionLabel: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
    marginTop: 4,
  },
  actionSub: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },
});
