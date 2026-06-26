import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import {
  getActivityIcon,
  getActivityColor,
  getIntensityLevel,
  intensityLabel,
  prescriptionPrimaryStats,
  dominantActivity,
  formatActivityType,
  isManualActivity,
  dayAbbrev,
  WEEK_DAYS_MON_SUN,
} from '../constants/activityIcons';
import { deleteProgram } from '../services/api';
import { getProgramCached } from '../services/cachedReads';
import type { ProgramDetail, ScheduledActivityResponse } from '../services/api';
import type { ThemeColors } from '../constants/colors';
import { CriteriaEditorModal } from '../components/CriteriaEditorModal';
import { AdherenceBar } from '../components/AdherenceBar';
import { EventCountdownCard } from '../components/EventCountdownCard';
import { computeAdherence } from '../utils/adherence';
import { addDays, sameDay, startOfDay } from '../utils/dates';
import { useProgram } from '../contexts/ProgramContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 50;
const HEAT_OPACITIES = [0, 0.1, 0.22, 0.36, 0.56, 0.78];

type FlatWeek = {
  id: string;
  weekNumber: number;
  phaseName: string;
  weekMonday: Date;
  activities: ScheduledActivityResponse[];
};

type ActivityStatus = 'completed' | 'today' | 'upcoming' | 'missed';

const alpha = (hex: string, opacity: number): string => {
  const a = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, '0');
  return `${hex}${a}`;
};

function activityStatus(activity: ScheduledActivityResponse, today: Date): ActivityStatus {
  if (activity.linked_workout_id) return 'completed';
  const date = startOfDay(new Date(activity.date + 'T00:00:00'));
  if (sameDay(date, today)) return 'today';
  return date < today ? 'missed' : 'upcoming';
}

function formatWeekRange(monday: Date): string {
  const end = addDays(monday, 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(end)}`;
}

function formatHeaderDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ProgramDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { programId } = route.params;
  const { notifyProgramDataChanged, programDataVersion } = useProgram();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'week' | 'month'>('week');
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [highlightDayIdx, setHighlightDayIdx] = useState<number>(0);
  const [criteriaModalVisible, setCriteriaModalVisible] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => startOfDay(new Date()));

  const initialVersionRef = useRef(programDataVersion);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const navigateWeekRef = useRef<(direction: 1 | -1) => void>(() => {});
  const hasAutoSelectedWeek = useRef(false);

  const fetchProgram = useCallback(async () => {
    try {
      const data = await getProgramCached(programId);
      setProgram(data);
      navigation.setOptions({ title: data.name });
    } catch (e) {
      if (__DEV__) console.error('[ProgramDetail] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [programId, navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Program',
      'This will permanently delete the program and all its data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProgram(programId);
              navigation.goBack();
              notifyProgramDataChanged();
            } catch {
              Alert.alert('Error', 'Failed to delete program');
            }
          },
        },
      ],
    );
  }, [programId, navigation, notifyProgramDataChanged]);

  useFocusEffect(
    useCallback(() => {
      fetchProgram();
    }, [fetchProgram]),
  );

  useEffect(() => {
    if (programDataVersion !== initialVersionRef.current) {
      fetchProgram();
    }
  }, [programDataVersion, fetchProgram]);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={handleDelete} hitSlop={8} style={{ marginRight: 4 }}>
          <Ionicons name="trash-outline" size={20} color={colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, handleDelete, colors]);

  const flatWeeks = useMemo<FlatWeek[]>(() => {
    if (!program) return [];
    const result: FlatWeek[] = [];
    for (const phase of program.phases) {
      for (const week of phase.weeks) {
        result.push({
          id: week.id,
          weekNumber: week.week_number,
          phaseName: phase.name,
          weekMonday: new Date(week.start_date + 'T00:00:00'),
          activities: week.activities,
        });
      }
    }
    return result;
  }, [program]);

  const today = useMemo(() => startOfDay(new Date()), []);

  const currentWeekByDateIdx = useMemo(() => {
    return flatWeeks.findIndex((w) => {
      const start = startOfDay(w.weekMonday);
      return today >= start && today < addDays(start, 7);
    });
  }, [flatWeeks, today]);

  const activitiesByDate = useMemo(() => {
    const map = new Map<string, ScheduledActivityResponse[]>();
    for (const week of flatWeeks) {
      for (const a of week.activities) {
        const list = map.get(a.date);
        if (list) list.push(a);
        else map.set(a.date, [a]);
      }
    }
    return map;
  }, [flatWeeks]);

  const adherence = useMemo(
    () => computeAdherence(flatWeeks.flatMap((w) => w.activities), today),
    [flatWeeks, today],
  );

  useEffect(() => {
    if (flatWeeks.length === 0 || hasAutoSelectedWeek.current) return;

    let idx = currentWeekByDateIdx;

    if (idx < 0) {
      idx = flatWeeks.findIndex((w) => startOfDay(w.weekMonday) > today);
    }
    if (idx < 0) {
      idx = flatWeeks.length - 1;
    }

    hasAutoSelectedWeek.current = true;
    setSelectedWeekIdx(idx);
    setMonthAnchor(startOfDay(flatWeeks[idx].weekMonday));
    if (idx === currentWeekByDateIdx) {
      const dow = today.getDay();
      setHighlightDayIdx(dow === 0 ? 6 : dow - 1);
    }
  }, [flatWeeks, today, currentWeekByDateIdx]);

  const selectedWeek = flatWeeks[selectedWeekIdx] ?? null;

  const animateSlide = useCallback((direction: 1 | -1) => {
    slideAnim.setValue(-direction * SCREEN_WIDTH * 0.3);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [slideAnim]);

  const navigateWeek = useCallback((direction: 1 | -1) => {
    setSelectedWeekIdx((prev) => {
      const next = prev + direction;
      if (next < 0 || next >= flatWeeks.length) return prev;
      animateSlide(direction);
      setHighlightDayIdx(0);
      const w = flatWeeks[next];
      if (w) setMonthAnchor(startOfDay(w.weekMonday));
      return next;
    });
  }, [flatWeeks, animateSlide]);

  navigateWeekRef.current = navigateWeek;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dy) < 30,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) navigateWeekRef.current(1);
        else if (g.dx > SWIPE_THRESHOLD) navigateWeekRef.current(-1);
      },
    }),
  ).current;

  const jumpToDate = useCallback((target: Date) => {
    const targetIdx = flatWeeks.findIndex((w) => {
      const start = startOfDay(w.weekMonday);
      return target >= start && target < addDays(start, 7);
    });
    if (targetIdx < 0) return;
    setSelectedWeekIdx(targetIdx);
    const dow = target.getDay();
    setHighlightDayIdx(dow === 0 ? 6 : dow - 1);
    setView('week');
  }, [flatWeeks]);

  const handleMonthCellPress = useCallback(
    (date: Date, activities: ScheduledActivityResponse[]) => {
      if (activities.length === 1) {
        navigation.navigate('ActivityDetail', { activityId: activities[0].id });
        return;
      }
      jumpToDate(date);
    },
    [navigation, jumpToDate],
  );

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 16, color: colors.textSecondary }}>Program not found</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
    >
      <ProgramHeaderCard
        program={program}
        totalWeeks={flatWeeks.length}
        currentWeekIdx={currentWeekByDateIdx}
        today={today}
        colors={colors}
      />

      <EventCountdownCard programId={program.id} />

      <AdherenceBar counts={adherence} title="Plan adherence" />

      {program.criteria.length > 0 && (
        <SettingsSection
          program={program}
          expanded={settingsExpanded}
          onToggle={() => setSettingsExpanded((p) => !p)}
          onEdit={() => setCriteriaModalVisible(true)}
          colors={colors}
        />
      )}

      <View style={[styles.tabsRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {(['week', 'month'] as const).map((v) => {
          const active = view === v;
          return (
            <Pressable
              key={v}
              onPress={() => setView(v)}
              style={[
                styles.tabBtn,
                { borderBottomColor: active ? colors.primary : 'transparent' },
              ]}
            >
              <Text style={[styles.tabBtnLabel, { color: active ? colors.primary : colors.textSecondary }]}>
                {v === 'week' ? 'Week' : 'Month'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {flatWeeks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 14, color: colors.textSecondary }}>
            No activities scheduled yet.
          </Text>
        </View>
      ) : view === 'week' ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={{ transform: [{ translateX: slideAnim }] }}
        >
          {selectedWeek && (
            <>
              <WeekNav
                week={selectedWeek}
                canPrev={selectedWeekIdx > 0}
                canNext={selectedWeekIdx < flatWeeks.length - 1}
                onPrev={() => navigateWeek(-1)}
                onNext={() => navigateWeek(1)}
                colors={colors}
              />
              <ApexBarChart
                week={selectedWeek}
                today={today}
                highlightDayIdx={highlightDayIdx}
                colors={colors}
              />
              <DayTimeline
                week={selectedWeek}
                today={today}
                highlightDayIdx={highlightDayIdx}
                onActivityPress={(a) => navigation.navigate('ActivityDetail', { activityId: a.id })}
                onRecordActivity={(a) =>
                  navigation.navigate('RecordManual', {
                    scheduledActivityId: a.id,
                    activityType: a.activity_type,
                  })
                }
                onAddActivity={(dayOfWeek) =>
                  navigation.navigate('ActivityDetail', {
                    weekId: selectedWeek.id,
                    dayOfWeek,
                    programId,
                  })
                }
                colors={colors}
              />
            </>
          )}
          <Text style={[styles.swipeHint, { color: colors.textSecondary }]}>
            Swipe left or right to change weeks
          </Text>
        </Animated.View>
      ) : (
        <MonthView
          monthAnchor={monthAnchor}
          setMonthAnchor={setMonthAnchor}
          activitiesByDate={activitiesByDate}
          flatWeeks={flatWeeks}
          today={today}
          onCellPress={handleMonthCellPress}
          colors={colors}
        />
      )}

      <CriteriaEditorModal
        visible={criteriaModalVisible}
        programId={programId}
        criteria={program.criteria}
        onClose={() => setCriteriaModalVisible(false)}
        onSaved={notifyProgramDataChanged}
      />
    </ScrollView>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

type HeaderProps = {
  program: ProgramDetail;
  totalWeeks: number;
  currentWeekIdx: number;
  today: Date;
  colors: ThemeColors;
};

function ProgramHeaderCard({ program, totalWeeks, currentWeekIdx, today, colors }: HeaderProps) {
  const sport = (program.sport || '').trim();
  const sportColor = sport ? getActivityColor(sport) : colors.primary;
  const start = startOfDay(new Date(program.start_date + 'T00:00:00'));
  const end = program.end_date ? startOfDay(new Date(program.end_date + 'T00:00:00')) : null;

  let pct = 0;
  if (end) {
    const totalMs = end.getTime() - start.getTime();
    if (totalMs > 0) {
      pct = Math.max(0, Math.min(100, Math.round(((today.getTime() - start.getTime()) / totalMs) * 100)));
    } else {
      pct = today >= start ? 100 : 0;
    }
  } else if (totalWeeks > 0) {
    const elapsed = currentWeekIdx >= 0 ? currentWeekIdx : (today >= start ? totalWeeks : 0);
    pct = Math.round((elapsed / totalWeeks) * 100);
  }

  let weekDisplay: number;
  if (currentWeekIdx >= 0) {
    weekDisplay = currentWeekIdx + 1;
  } else if (today < start) {
    weekDisplay = 1;
  } else {
    weekDisplay = totalWeeks;
  }

  return (
    <View style={[styles.headerCard, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.headerEyebrowRow}>
        {sport.length > 0 && (
          <Text style={[styles.headerEyebrow, { color: sportColor }]}>
            {sport.toUpperCase()}
          </Text>
        )}
        {sport.length > 0 && totalWeeks > 0 && (
          <View style={[styles.headerEyebrowDot, { backgroundColor: colors.border }]} />
        )}
        {totalWeeks > 0 && (
          <Text style={[styles.headerEyebrow, { color: colors.textSecondary }]}>
            WEEK {weekDisplay} OF {totalWeeks}
          </Text>
        )}
      </View>

      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
        {program.name}
      </Text>

      <Text style={[styles.headerDates, { color: colors.textSecondary }]}>
        {formatHeaderDate(program.start_date)}
        {program.end_date ? ` – ${formatHeaderDate(program.end_date)}` : ''}
      </Text>

      {totalWeeks > 0 && (
        <View style={styles.progressRow}>
          <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.progressBarFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
          </View>
          <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
            {pct}% complete
          </Text>
        </View>
      )}

      {program.goal_description ? (
        <Text style={[styles.headerGoal, { color: colors.textSecondary }]} numberOfLines={3}>
          {program.goal_description}
        </Text>
      ) : null}
    </View>
  );
}

// ── Settings (collapsible) ────────────────────────────────────────────────────

type SettingsProps = {
  program: ProgramDetail;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  colors: ThemeColors;
};

function SettingsSection({ program, expanded, onToggle, onEdit, colors }: SettingsProps) {
  return (
    <View style={[styles.settingsSection, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable style={styles.settingsToggle} onPress={onToggle}>
        <View style={styles.settingsToggleLeft}>
          <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.settingsTitle, { color: colors.textPrimary }]}>
            Program Settings
          </Text>
          <Text style={[styles.settingsCount, { color: colors.textSecondary, backgroundColor: colors.surfaceAlt }]}>
            {program.criteria.length}
          </Text>
        </View>
        <View style={styles.settingsToggleRight}>
          {!expanded && (
            <Pressable
              style={styles.editSettingsBtn}
              onPress={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={14} color={colors.primary} />
            </Pressable>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.settingsContent}>
          <View style={styles.criteriaGrid}>
            {program.criteria.map((c) => (
              <View key={c.id} style={[styles.criterionCard, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={[styles.criterionLabel, { color: colors.textSecondary }]}>
                  {c.label}
                </Text>
                <Text style={[styles.criterionValue, { color: colors.textPrimary }]}>
                  {c.value}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            style={[styles.editBtnFull, { borderColor: alpha(colors.primary, 0.3) }]}
            onPress={onEdit}
          >
            <Ionicons name="create-outline" size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, color: colors.primary, fontFamily: Fonts.bodySemiBold }}>
              Edit Settings
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Week Navigation ───────────────────────────────────────────────────────────

type WeekNavProps = {
  week: FlatWeek;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  colors: ThemeColors;
};

function WeekNav({ week, canPrev, canNext, onPrev, onNext, colors }: WeekNavProps) {
  return (
    <View style={styles.weekNavWrap}>
      {week.phaseName ? (
        <Text style={[styles.phaseEyebrow, { color: colors.textSecondary }]}>
          {week.phaseName.toUpperCase()}
        </Text>
      ) : null}
      <View style={styles.weekNavRow}>
        <Pressable
          onPress={onPrev}
          disabled={!canPrev}
          hitSlop={10}
          style={[
            styles.weekNavBtn,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: canPrev ? 1 : 0.35 },
          ]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
        </Pressable>
        <View style={styles.weekNavCenter}>
          <Text style={[styles.weekNavLabel, { color: colors.textPrimary }]}>
            Week {week.weekNumber} · {formatWeekRange(week.weekMonday)}
          </Text>
        </View>
        <Pressable
          onPress={onNext}
          disabled={!canNext}
          hitSlop={10}
          style={[
            styles.weekNavBtn,
            { backgroundColor: colors.surface, borderColor: colors.border, opacity: canNext ? 1 : 0.35 },
          ]}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Apex bar chart ────────────────────────────────────────────────────────────

type ApexProps = {
  week: FlatWeek;
  today: Date;
  highlightDayIdx: number;
  colors: ThemeColors;
};

function ApexBarChart({ week, today, highlightDayIdx, colors }: ApexProps) {
  const dayBuckets = useMemo(() => {
    const result: ScheduledActivityResponse[][] = WEEK_DAYS_MON_SUN.map(() => []);
    for (const a of week.activities) {
      const slot = a.day_of_week === 0 ? 6 : a.day_of_week - 1;
      result[slot].push(a);
    }
    return result;
  }, [week.activities]);

  const intensities = dayBuckets.map((acts) =>
    acts.length === 0 ? 0 : Math.max(...acts.map((a) => getIntensityLevel(a.prescription, a.activity_type))),
  );
  const maxIntensity = Math.max(1, ...intensities);

  return (
    <View style={[styles.apexCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.apexEyebrow, { color: colors.textSecondary }]}>
        LOAD THIS WEEK
      </Text>
      <View style={styles.apexBarsRow}>
        {dayBuckets.map((acts, idx) => {
          const intensity = intensities[idx];
          const isRest = acts.length === 0;
          const dayDate = addDays(week.weekMonday, idx);
          const isToday = sameDay(dayDate, today);
          const isHighlight = idx === highlightDayIdx;
          const dominant = isRest ? null : dominantActivity(acts);
          const dominantColor = dominant ? getActivityColor(dominant.activity_type) : colors.surfaceAlt;
          const barH = isRest ? 5 : Math.max(10, (intensity / maxIntensity) * 42);
          const dayInitial = ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx];

          return (
            <View key={idx} style={styles.apexBarCol}>
              {acts.length > 1 ? (
                <View style={[styles.apexBarMulti, { height: barH }]}>
                  {acts.map((a, ai) => (
                    <View
                      key={a.id ?? ai}
                      style={{
                        flex: 1,
                        backgroundColor: isHighlight
                          ? getActivityColor(a.activity_type)
                          : alpha(getActivityColor(a.activity_type), 0.47),
                      }}
                    />
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.apexBar,
                    {
                      height: barH,
                      backgroundColor: isRest
                        ? colors.surfaceAlt
                        : isHighlight
                          ? dominantColor
                          : alpha(dominantColor, 0.33),
                    },
                  ]}
                />
              )}
              <Text
                style={[
                  styles.apexDayLabel,
                  {
                    color: isHighlight ? colors.textPrimary : colors.textSecondary,
                    fontFamily: isToday ? Fonts.bodyBold : Fonts.bodySemiBold,
                  },
                ]}
              >
                {dayInitial}
              </Text>
              {isToday && <View style={[styles.apexTodayDot, { backgroundColor: colors.primary }]} />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Day Timeline ──────────────────────────────────────────────────────────────

type DayTimelineProps = {
  week: FlatWeek;
  today: Date;
  highlightDayIdx: number;
  onActivityPress: (a: ScheduledActivityResponse) => void;
  onRecordActivity: (a: ScheduledActivityResponse) => void;
  onAddActivity: (dayOfWeek: number) => void;
  colors: ThemeColors;
};

function DayTimeline({ week, today, highlightDayIdx, onActivityPress, onRecordActivity, onAddActivity, colors }: DayTimelineProps) {
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

// ── Compact workout row ───────────────────────────────────────────────────────

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

// ── Month view ────────────────────────────────────────────────────────────────

type MonthViewProps = {
  monthAnchor: Date;
  setMonthAnchor: (d: Date) => void;
  activitiesByDate: Map<string, ScheduledActivityResponse[]>;
  flatWeeks: FlatWeek[];
  today: Date;
  onCellPress: (d: Date, activities: ScheduledActivityResponse[]) => void;
  colors: ThemeColors;
};

function MonthView({ monthAnchor, setMonthAnchor, activitiesByDate, flatWeeks, today, onCellPress, colors }: MonthViewProps) {
  const monthStart = useMemo(() => new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1), [monthAnchor]);
  const monthEnd = useMemo(() => new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0), [monthAnchor]);
  const programStart = startOfDay(new Date(flatWeeks[0].weekMonday));
  const programEnd = addDays(startOfDay(new Date(flatWeeks[flatWeeks.length - 1].weekMonday)), 6);

  const canPrevMonth = monthStart > programStart;
  const canNextMonth = monthEnd < programEnd;

  const gridOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const gridStart = addDays(monthStart, -gridOffset);

  // 6-row × 7-col grid covering the month, Mon-first.
  const rows: Date[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Date[] = [];
    for (let c = 0; c < 7; c++) {
      row.push(addDays(gridStart, r * 7 + c));
    }
    rows.push(row);
  }

  // Per-row average intensity → side load bar. 0 if rest week.
  const weekLoads = rows.map((row) => {
    let sum = 0;
    let count = 0;
    for (const d of row) {
      const acts = activitiesByDate.get(toDateKey(d));
      if (!acts) continue;
      for (const a of acts) {
        sum += getIntensityLevel(a.prescription, a.activity_type);
        count += 1;
      }
    }
    return count > 0 ? sum / count : 0;
  });

  const monthlyStats = useMemo(() => buildMonthlyStats(activitiesByDate, monthStart, monthEnd), [activitiesByDate, monthStart, monthEnd]);

  return (
    <View style={styles.monthWrap}>
      <View style={styles.monthNavRow}>
        <Pressable
          onPress={() => canPrevMonth && setMonthAnchor(addDays(monthStart, -1))}
          disabled={!canPrevMonth}
          hitSlop={10}
          style={{ opacity: canPrevMonth ? 1 : 0.35 }}
        >
          <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        </Pressable>
        <Text style={[styles.monthNavLabel, { color: colors.textPrimary }]}>
          {monthAnchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable
          onPress={() => canNextMonth && setMonthAnchor(addDays(monthEnd, 1))}
          disabled={!canNextMonth}
          hitSlop={10}
          style={{ opacity: canNextMonth ? 1 : 0.35 }}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.monthGridHeader}>
        <View style={{ width: 22 }} />
        <View style={styles.monthDayHeaderRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <Text key={i} style={[styles.monthDayHeader, { color: colors.textSecondary }]}>
              {d}
            </Text>
          ))}
        </View>
      </View>

      {rows.map((row, ri) => {
        const isCurrentRow = row.some((d) => sameDay(d, today));
        const loadH = (weekLoads[ri] / 5) * 100;
        return (
          <View
            key={ri}
            style={[
              styles.monthGridRow,
              isCurrentRow && {
                backgroundColor: colors.primaryLight,
                borderColor: alpha(colors.primary, 0.2),
                borderWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <View style={styles.monthLoadCol}>
              <View style={[styles.monthLoadTrack, { backgroundColor: colors.surfaceAlt }]}>
                <View
                  style={{
                    width: '100%',
                    height: `${Math.min(100, loadH)}%`,
                    backgroundColor: colors.primary,
                    position: 'absolute',
                    bottom: 0,
                  }}
                />
              </View>
            </View>
            <View style={styles.monthCellRow}>
              {row.map((date, ci) => {
                const acts = activitiesByDate.get(toDateKey(date)) ?? [];
                return (
                  <MonthCell
                    key={ci}
                    date={date}
                    activities={acts}
                    inMonth={date.getMonth() === monthStart.getMonth()}
                    isToday={sameDay(date, today)}
                    inProgram={date >= programStart && date <= programEnd}
                    onPress={() => onCellPress(date, acts)}
                    colors={colors}
                  />
                );
              })}
            </View>
          </View>
        );
      })}

      {monthlyStats.length > 0 && (
        <View style={[styles.monthlyStats, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.monthlyStatsTitle, { color: colors.textPrimary }]}>
            {monthAnchor.toLocaleDateString('en-US', { month: 'long' })} Load
          </Text>
          <View style={styles.monthlyStatsRow}>
            {monthlyStats.map((s, i) => (
              <View
                key={s.label}
                style={[
                  styles.monthlyStatCell,
                  i > 0 && { borderLeftColor: colors.border, borderLeftWidth: StyleSheet.hairlineWidth },
                ]}
              >
                <Text style={[styles.monthlyStatVal, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.monthlyStatLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

type MonthlyStat = { value: string; label: string; color: string };

function buildMonthlyStats(
  activitiesByDate: Map<string, ScheduledActivityResponse[]>,
  monthStart: Date,
  monthEnd: Date,
): MonthlyStat[] {
  const counts = new Map<string, number>();
  let totalKm = 0;

  for (const [dateStr, acts] of activitiesByDate.entries()) {
    const d = new Date(dateStr + 'T00:00:00');
    if (d < monthStart || d > monthEnd) continue;
    for (const a of acts) {
      counts.set(a.activity_type, (counts.get(a.activity_type) || 0) + 1);
      const dist = parseKmDistance(a.prescription);
      if (dist !== null) totalKm += dist;
    }
  }

  const top = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([type, n]) => ({
      value: String(n),
      label: pluralizeActivityLabel(type, n),
      color: getActivityColor(type),
    }));

  if (totalKm > 0) {
    top.push({ value: Math.round(totalKm).toString(), label: 'km total', color: '#1A1A2E' });
  }

  return top;
}

function pluralizeActivityLabel(type: string, n: number): string {
  const base = formatActivityType(type);
  if (n === 1) return base;
  if (base.endsWith('s')) return base;
  return `${base}s`;
}

function parseKmDistance(prescription: Record<string, any> | undefined): number | null {
  if (!prescription) return null;
  const raw = prescription.distance || prescription.total_distance;
  if (!raw) return null;
  const match = String(raw).match(/(\d+(?:\.\d+)?)\s*(km|mi|m)?/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const unit = (match[2] || 'km').toLowerCase();
  if (unit === 'mi') return num * 1.609;
  if (unit === 'm') return num / 1000;
  return num;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type MonthCellProps = {
  date: Date;
  activities: ScheduledActivityResponse[];
  inMonth: boolean;
  isToday: boolean;
  inProgram: boolean;
  onPress: () => void;
  colors: ThemeColors;
};

function MonthCell({ date, activities, inMonth, isToday, inProgram, onPress, colors }: MonthCellProps) {
  const dominant = activities.length > 0 ? dominantActivity(activities) : null;
  const intensity = dominant ? getIntensityLevel(dominant.prescription, dominant.activity_type) : 0;
  const sportColor = dominant ? getActivityColor(dominant.activity_type) : colors.surfaceAlt;
  const heatOpacity = HEAT_OPACITIES[intensity] ?? 0;
  const bg = dominant ? alpha(sportColor, heatOpacity) : 'transparent';
  const allCompleted = !!dominant && activities.every((a) => a.linked_workout_id);
  const anyCompleted = !!dominant && activities.some((a) => a.linked_workout_id);
  const dimmed = !inMonth || !inProgram;
  const textOnHeat = heatOpacity > 0.38;

  return (
    <Pressable
      onPress={inProgram ? onPress : undefined}
      style={[
        styles.monthCell,
        {
          backgroundColor: bg,
          borderColor: isToday ? colors.primary : 'transparent',
          opacity: dimmed ? 0.3 : 1,
        },
      ]}
      hitSlop={2}
    >
      <Text
        style={[
          styles.monthCellDate,
          {
            color: !dominant ? colors.textSecondary : textOnHeat ? '#FFFFFF' : sportColor,
            fontFamily: isToday ? Fonts.bodyBold : Fonts.bodySemiBold,
          },
        ]}
      >
        {date.getDate()}
      </Text>
      {dominant ? (
        <Ionicons
          name={getActivityIcon(dominant.activity_type)}
          size={9}
          color={textOnHeat ? 'rgba(255,255,255,0.85)' : sportColor}
        />
      ) : (
        inProgram && (
          <Ionicons name="moon-outline" size={9} color={colors.textSecondary} />
        )
      )}
      {anyCompleted && (
        <View
          style={[
            styles.monthCellDot,
            { backgroundColor: allCompleted ? colors.success : alpha(colors.success, 0.45) },
          ]}
        />
      )}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },

  headerCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  headerEyebrow: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.6,
  },
  headerEyebrowDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  headerDates: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginBottom: 12,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
  },
  headerGoal: {
    fontSize: 13,
    fontFamily: Fonts.body,
    lineHeight: 18,
    marginTop: 2,
  },

  settingsSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  settingsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsTitle: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  settingsCount: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  settingsContent: {
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  editSettingsBtn: {
    padding: 4,
  },
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criterionCard: {
    borderRadius: 10,
    padding: 10,
    minWidth: '45%',
    flex: 1,
  },
  criterionLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  criterionValue: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  editBtnFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },

  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabBtnLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },

  weekNavWrap: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  phaseEyebrow: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.6,
    textAlign: 'center',
    marginBottom: 6,
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weekNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavCenter: {
    flex: 1,
    alignItems: 'center',
  },
  weekNavLabel: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },

  apexCard: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  apexEyebrow: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  apexBarsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 60,
    gap: 4,
  },
  apexBarCol: {
    flex: 1,
    alignItems: 'center',
  },
  apexBar: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  apexBarMulti: {
    width: '80%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: 'hidden',
    flexDirection: 'column-reverse',
  },
  apexDayLabel: {
    fontSize: 10,
    marginTop: 5,
  },
  apexTodayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },

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

  swipeHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    fontFamily: Fonts.body,
    fontStyle: 'italic',
  },

  // Month view
  monthWrap: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  monthGridHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  monthDayHeaderRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  monthDayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.3,
  },
  monthGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: 12,
    marginBottom: 2,
  },
  monthLoadCol: {
    width: 22,
    alignItems: 'center',
  },
  monthLoadTrack: {
    width: 4,
    height: 32,
    borderRadius: 2,
    overflow: 'hidden',
  },
  monthCellRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  monthCell: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    paddingVertical: 2,
    gap: 2,
  },
  monthCellDate: {
    fontSize: 10,
  },
  monthCellDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  monthlyStats: {
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthlyStatsTitle: {
    fontSize: 13,
    fontFamily: Fonts.heading,
    marginBottom: 10,
  },
  monthlyStatsRow: {
    flexDirection: 'row',
  },
  monthlyStatCell: {
    flex: 1,
    alignItems: 'center',
  },
  monthlyStatVal: {
    fontSize: 20,
    fontFamily: Fonts.heading,
  },
  monthlyStatLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
