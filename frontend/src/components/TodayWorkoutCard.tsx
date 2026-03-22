import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { formatActivityType, getActivityIcon, formatPrescriptionSummary } from '../constants/activityIcons';
import type { UpcomingActivity, ProgramSummary } from '../services/api';

interface TodayWorkoutCardProps {
  activity: UpcomingActivity | null;
  program: ProgramSummary | null;
  onStartWorkout: () => void;
  onCreateProgram: () => void;
}

export function TodayWorkoutCard({ activity, program, onStartWorkout, onCreateProgram }: TodayWorkoutCardProps) {
  const { colors } = useTheme();

  if (!program) {
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="barbell-outline" size={32} color={colors.primary} />
        <Text style={[styles.noProgTitle, { color: colors.textPrimary }]}>No active program</Text>
        <Text style={[styles.noProgSub, { color: colors.textSecondary }]}>
          Let Grit build your personalized training program
        </Text>
        <TouchableOpacity
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
          onPress={onCreateProgram}
          activeOpacity={0.8}
        >
          <Text style={[styles.ctaText, { color: colors.background }]}>Create Your Program</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isRestDay = !activity;
  const icon = activity ? getActivityIcon(activity.activity_type) : 'moon-outline';
  const prescription = activity ? formatPrescriptionSummary(activity.prescription) : '';

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Program context */}
      <Text style={[styles.programName, { color: colors.textSecondary }]}>
        {program.name.toUpperCase()}
      </Text>
      {activity && (
        <Text style={[styles.phaseInfo, { color: colors.textSecondary }]}>
          {activity.phase_name} · Week {activity.week_number}
        </Text>
      )}

      {/* Activity icon */}
      <View style={[styles.iconCircle, { backgroundColor: isRestDay ? colors.surfaceAlt : colors.primaryLight }]}>
        <Ionicons name={icon} size={28} color={isRestDay ? colors.textSecondary : colors.primary} />
      </View>

      {/* Activity name */}
      <Text style={[styles.activityName, { color: colors.textPrimary }]}>
        {isRestDay ? 'REST DAY' : formatActivityType(activity!.activity_type).toUpperCase()}
      </Text>

      {/* Prescription or rest message */}
      {isRestDay ? (
        <Text style={[styles.prescription, { color: colors.textSecondary }]}>
          Recovery is part of the plan
        </Text>
      ) : (
        prescription ? (
          <Text style={[styles.prescription, { color: colors.textSecondary }]}>{prescription}</Text>
        ) : null
      )}

      {/* Start button (only if not rest day) */}
      {!isRestDay && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.secondary }]}
          onPress={onStartWorkout}
          activeOpacity={0.8}
        >
          <Ionicons name="play" size={18} color={colors.background} />
          <Text style={[styles.startText, { color: colors.background }]}>START WORKOUT</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  programName: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.2,
  },
  phaseInfo: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginBottom: 8,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  activityName: {
    fontSize: 24,
    fontFamily: Fonts.heading,
    letterSpacing: 1,
  },
  prescription: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: 'center',
    marginBottom: 4,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 8,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  startText: {
    fontSize: 15,
    fontFamily: Fonts.heading,
    letterSpacing: 0.5,
  },
  noProgTitle: {
    fontSize: 18,
    fontFamily: Fonts.heading,
    marginTop: 8,
  },
  noProgSub: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: 'center',
    marginBottom: 8,
  },
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 15,
    fontFamily: Fonts.heading,
  },
});
