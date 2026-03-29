import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { formatActivityType, getActivityIcon, formatPrescriptionSummary } from '../constants/activityIcons';
import type { UpcomingActivity, ProgramSummary } from '../services/api';

interface TodayWorkoutCardProps {
  activities: UpcomingActivity[];
  completedIds: Set<string>;
  program: ProgramSummary | null;
  onStartWorkout: (activity: UpcomingActivity) => void;
  onCreateProgram: () => void;
}

export function TodayWorkoutCard({
  activities,
  completedIds,
  program,
  onStartWorkout,
  onCreateProgram,
}: TodayWorkoutCardProps) {
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

  const uncompleted = activities.filter((a) => !completedIds.has(a.id));
  const completed = activities.filter((a) => completedIds.has(a.id));

  const hero = uncompleted[0] ?? null;
  const nextUp = uncompleted.slice(1);
  const isRestDay = activities.length === 0;
  const allDone = activities.length > 0 && uncompleted.length === 0;

  const phaseActivity = hero ?? completed[0] ?? null;

  return (
    <View style={styles.wrapper}>
      {/* Section header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>DAILY SCHEDULE</Text>
        {phaseActivity && (
          <Text style={[styles.phaseLabel, { color: colors.primary }]}>
            {phaseActivity.phase_name} {'\u00B7'} Week {phaseActivity.week_number}
          </Text>
        )}
      </View>

      {/* Hero card */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {isRestDay ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="moon-outline" size={28} color={colors.textSecondary} />
            </View>
            <Text style={[styles.activityName, { color: colors.textPrimary }]}>REST DAY</Text>
            <Text style={[styles.prescription, { color: colors.textSecondary }]}>
              Recovery is part of the plan
            </Text>
          </>
        ) : allDone ? (
          <>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="checkmark-done-outline" size={28} color={colors.success} />
            </View>
            <Text style={[styles.activityName, { color: colors.textPrimary }]}>ALL DONE</Text>
            <Text style={[styles.prescription, { color: colors.textSecondary }]}>
              Great work today! All sessions completed.
            </Text>
          </>
        ) : (
          <>
            {activities.length > 1 && (
              <View style={[styles.workoutBadge, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.workoutBadgeText, { color: colors.primary }]}>
                  WORKOUT {completed.length + 1}
                </Text>
              </View>
            )}
            <Text style={[styles.activityName, { color: colors.textPrimary }]}>
              {formatActivityType(hero!.activity_type).toUpperCase()}
            </Text>
            <Text style={[styles.prescription, { color: colors.textSecondary }]}>
              {formatPrescriptionSummary(hero!.prescription)}
            </Text>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: colors.secondary }]}
              onPress={() => onStartWorkout(hero!)}
              activeOpacity={0.8}
            >
              <Text style={[styles.startText, { color: colors.background }]}>START SESSION</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Next up rows (uncompleted after hero) */}
      {nextUp.map((a, i) => (
        <CompactActivityRow
          key={a.id}
          activity={a}
          label={`NEXT UP${nextUp.length > 1 ? ` (${i + 2})` : ''}`}
          done={false}
        />
      ))}

      {/* Completed rows */}
      {completed.map((a) => (
        <CompactActivityRow key={a.id} activity={a} label="COMPLETED" done />
      ))}
    </View>
  );
}

interface CompactActivityRowProps {
  activity: UpcomingActivity;
  label: string;
  done: boolean;
}

function CompactActivityRow({ activity, label, done }: CompactActivityRowProps) {
  const { colors } = useTheme();
  const icon = getActivityIcon(activity.activity_type);
  const summary = formatPrescriptionSummary(activity.prescription);

  return (
    <View style={[styles.compactRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.compactIcon, { backgroundColor: done ? 'transparent' : colors.primaryLight }]}>
        {done ? (
          <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        ) : (
          <Ionicons name={icon} size={20} color={colors.primary} />
        )}
      </View>
      <View style={styles.compactContent}>
        <Text style={[styles.compactLabel, { color: done ? colors.success : colors.primary }]}>
          {label}
        </Text>
        <Text
          style={[
            styles.compactName,
            { color: colors.textPrimary },
            done && styles.compactNameDone,
          ]}
          numberOfLines={1}
        >
          {formatActivityType(activity.activity_type).toUpperCase()}
        </Text>
        {summary ? (
          <Text style={[styles.compactSummary, { color: colors.textSecondary }]} numberOfLines={1}>
            {summary}
          </Text>
        ) : null}
      </View>
      {!done && (
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: Fonts.heading,
    letterSpacing: 1.5,
  },
  phaseLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.5,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  workoutBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 4,
  },
  workoutBadgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
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
    fontSize: 22,
    fontFamily: Fonts.heading,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  prescription: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: 'center',
    marginBottom: 4,
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
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
  // Compact row styles
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactContent: {
    flex: 1,
  },
  compactLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
    marginBottom: 1,
  },
  compactName: {
    fontSize: 15,
    fontFamily: Fonts.heading,
    letterSpacing: 0.3,
  },
  compactNameDone: {
    opacity: 0.6,
  },
  compactSummary: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 1,
  },
});
