import { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Fonts } from '../constants/fonts';
import type { ThemeColors } from '../constants/colors';
import type { ScheduledActivityResponse } from '../services/api';
import {
  getActivityIcon,
  getActivityColor,
  getIntensityLevel,
  intensityLabel,
  prescriptionPrimaryStats,
  formatActivityType,
  isManualActivity,
  dayAbbrev,
  WEEK_DAYS_MON_SUN,
} from '../constants/activityIcons';
import {
  addDays,
  sameDay,
  alpha,
  activityStatus,
  type ActivityStatus,
} from '../utils/scheduleDisplay';

type ProgramWeekTimelineProps = {
  week: { weekMonday: Date; activities: ScheduledActivityResponse[] };
  today: Date;
  highlightDayIdx: number;
  onActivityPress: (a: ScheduledActivityResponse) => void;
  onRecordActivity: (a: ScheduledActivityResponse) => void;
  onAddActivity: (dayOfWeek: number) => void;
  colors: ThemeColors;
};

export function ProgramWeekTimeline({ week, today, highlightDayIdx, onActivityPress, onRecordActivity, onAddActivity, colors }: ProgramWeekTimelineProps) {
  const byDay = useMemo<Map<number, ScheduledActivityResponse[]>>(() => {
    const map = new Map<number, ScheduledActivityResponse[]>();
    for (const a of week.activities) {
      const list = map.get(a.day_of_week);
      if (list) list.push(a);
      else map.set(a.day_of_week, [a]);
    }
    return map;
  }, [week.activities]);

  return (
    <View style={styles.timelineWrap}>
      {WEEK_DAYS_MON_SUN.map((dayOfWeek, idx) => {
        const acts = byDay.get(dayOfWeek) ?? [];
        const dayDate = addDays(week.weekMonday, idx);
        const isToday = sameDay(dayDate, today);
        const isHighlight = idx === highlightDayIdx;

        return (
          <View key={dayOfWeek} style={styles.timelineDay}>
            <View style={styles.timelineDayHeader}>
              <Text
                style={[
                  styles.timelineDayName,
                  { color: isToday ? colors.primary : isHighlight ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                {dayAbbrev(dayOfWeek).toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.timelineDayDate,
                  { color: isToday ? colors.primary : colors.textSecondary },
                ]}
              >
                {dayDate.toLocaleDateString('en-US', { month: 'short' })} {dayDate.getDate()}
              </Text>
              {isToday && (
                <View style={[styles.todayPill, { backgroundColor: colors.primary }]}>
                  <Text style={styles.todayPillText}>TODAY</Text>
                </View>
              )}
            </View>

            {acts.length === 0 ? (
              <View style={[styles.restRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.restLabel, { color: colors.textSecondary }]}>Rest Day</Text>
                <Pressable
                  style={[styles.restAddBtn, { backgroundColor: colors.primaryLight }]}
                  onPress={() => onAddActivity(dayOfWeek)}
                >
                  <Ionicons name="add" size={13} color={colors.primary} />
                  <Text style={[styles.restAddBtnText, { color: colors.primary }]}>Add</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {acts.map((activity) => (
                  <CompactWorkoutRow
                    key={activity.id}
                    activity={activity}
                    today={today}
                    onPress={() => onActivityPress(activity)}
                    onRecord={() => onRecordActivity(activity)}
                    colors={colors}
                  />
                ))}
                <Pressable
                  style={[styles.addAnotherBtn, { borderColor: colors.border }]}
                  onPress={() => onAddActivity(dayOfWeek)}
                >
                  <Ionicons name="add-circle-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.addAnotherText, { color: colors.textSecondary }]}>
                    Add another workout
                  </Text>
                </Pressable>
              </>
            )}

            {idx < WEEK_DAYS_MON_SUN.length - 1 && (
              <View style={[styles.timelineSeparator, { backgroundColor: colors.border }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

type RowProps = {
  activity: ScheduledActivityResponse;
  today: Date;
  onPress: () => void;
  onRecord: () => void;
  colors: ThemeColors;
};

function CompactWorkoutRow({ activity, today, onPress, onRecord, colors }: RowProps) {
  const sportColor = getActivityColor(activity.activity_type);
  const status = activityStatus(activity, today);
  const stats = prescriptionPrimaryStats(activity.prescription);
  const intensity = activity.prescription?.intensity
    ? String(activity.prescription.intensity)
    : intensityLabel(getIntensityLevel(activity.prescription, activity.activity_type));
  const allMeta = [...stats, intensity].filter(Boolean);
  const note = activity.notes?.trim() || activity.prescription?.description?.trim() || '';
  const showRecord = isManualActivity(activity.activity_type) && status !== 'completed' && status !== 'missed';

  const rowBg = status === 'completed' ? alpha(sportColor, 0.06) : colors.surface;
  const rowBorder = status === 'today' ? alpha(sportColor, 0.31) : colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.workoutRow,
        {
          backgroundColor: rowBg,
          borderColor: rowBorder,
          borderLeftColor: sportColor,
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.workoutIcon, { backgroundColor: alpha(sportColor, 0.1) }]}>
        <Ionicons name={getActivityIcon(activity.activity_type)} size={16} color={sportColor} />
      </View>
      <View style={styles.workoutInfo}>
        <Text style={[styles.workoutTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {formatActivityType(activity.activity_type)}
        </Text>
        {allMeta.length > 0 && (
          <Text style={[styles.workoutMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {allMeta.join(' · ')}
          </Text>
        )}
        {note ? (
          <Text style={[styles.workoutNotes, { color: colors.textSecondary }]} numberOfLines={2}>
            {note}
          </Text>
        ) : null}
      </View>
      {showRecord && (
        <Pressable
          onPress={onRecord}
          hitSlop={10}
          style={[styles.recordBtn, { backgroundColor: alpha(sportColor, 0.12) }]}
        >
          <Ionicons name="play" size={12} color={sportColor} />
        </Pressable>
      )}
      <StatusIndicator status={status} sportColor={sportColor} colors={colors} />
    </Pressable>
  );
}

function StatusIndicator({ status, sportColor, colors }: { status: ActivityStatus; sportColor: string; colors: ThemeColors }) {
  if (status === 'completed') {
    return (
      <View style={[styles.statusCircle, { backgroundColor: alpha(colors.success, 0.18) }]}>
        <Ionicons name="checkmark" size={12} color={colors.success} />
      </View>
    );
  }
  if (status === 'missed') {
    return (
      <View style={[styles.statusCircle, { backgroundColor: alpha(colors.error, 0.18) }]}>
        <Ionicons name="close" size={12} color={colors.error} />
      </View>
    );
  }
  if (status === 'today') {
    return (
      <View style={[styles.livePill, { backgroundColor: sportColor }]}>
        <View style={styles.livePillDot} />
        <Text style={styles.livePillText}>TODAY</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusCircle, { backgroundColor: colors.primaryLight }]}>
      <Ionicons name="chevron-forward" size={12} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  timelineWrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  timelineDay: {
    marginBottom: 8,
  },
  timelineDayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  timelineDayName: {
    fontSize: 11,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 1.2,
  },
  timelineDayDate: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  todayPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 'auto',
  },
  todayPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 1,
  },
  timelineSeparator: {
    height: StyleSheet.hairlineWidth,
    marginTop: 10,
    opacity: 0.5,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 3,
    marginBottom: 6,
  },
  workoutIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutInfo: {
    flex: 1,
    minWidth: 0,
  },
  workoutTitle: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
    marginBottom: 2,
  },
  workoutMeta: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  workoutNotes: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 16,
  },
  recordBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  livePillDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  livePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: Fonts.bodyBold,
    letterSpacing: 0.8,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  restLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  restAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  restAddBtnText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addAnotherText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
});
