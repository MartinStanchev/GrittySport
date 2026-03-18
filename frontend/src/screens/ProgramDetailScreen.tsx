import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
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
import {
  getActivityIcon,
  formatActivityType,
  formatPrescriptionSummary,
  isManualActivity,
  dayAbbrev,
} from '../constants/activityIcons';
import { getProgram, deleteProgram } from '../services/api';
import type { ProgramDetail, ScheduledActivityResponse } from '../services/api';
import { CriteriaEditorModal } from '../components/CriteriaEditorModal';
import { useProgram } from '../contexts/ProgramContext';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 50;

type FlatWeek = {
  id: string;
  weekNumber: number;
  phaseName: string;
  weekMonday: Date;
  activities: ScheduledActivityResponse[];
};

function formatWeekRange(monday: Date): string {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(monday)} – ${fmt(end)}`;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ProgramDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { programId } = route.params;
  const { notifyProgramDataChanged, programDataVersion } = useProgram();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(0);
  const [criteriaModalVisible, setCriteriaModalVisible] = useState(false);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  const weekSelectorRef = useRef<FlatList>(null);
  const initialVersionRef = useRef(programDataVersion);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const navigateWeekRef = useRef<(direction: 1 | -1) => void>(() => {});

  const fetchProgram = useCallback(async () => {
    try {
      const data = await getProgram(programId);
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
        <Pressable onPress={handleDelete} hitSlop={8} style={{ marginRight: 4, alignItems: 'center', justifyContent: 'center' }}>
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

  useEffect(() => {
    if (flatWeeks.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let idx = flatWeeks.findIndex((w) => {
      const start = new Date(w.weekMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return today >= start && today < end;
    });

    if (idx < 0) {
      idx = flatWeeks.findIndex((w) => {
        const start = new Date(w.weekMonday);
        start.setHours(0, 0, 0, 0);
        return start > today;
      });
    }
    if (idx < 0) {
      idx = flatWeeks.length - 1;
    }

    setSelectedWeekIdx(idx);
  }, [flatWeeks]);

  useEffect(() => {
    if (selectedWeekIdx < 0 || flatWeeks.length === 0) return;
    setTimeout(() => {
      weekSelectorRef.current?.scrollToIndex({ index: selectedWeekIdx, animated: true, viewPosition: 0.3 });
    }, 300);
  }, [selectedWeekIdx, flatWeeks]);

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
      return next;
    });
  }, [flatWeeks.length, animateSlide]);

  navigateWeekRef.current = navigateWeek;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 15 && Math.abs(gestureState.dy) < 30;
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD) {
          navigateWeekRef.current(1);
        } else if (gestureState.dx > SWIPE_THRESHOLD) {
          navigateWeekRef.current(-1);
        }
      },
    }),
  ).current;

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.programName, { color: colors.textPrimary }]}>
              {program.name}
            </Text>
            <View style={styles.headerMeta}>
              {program.sport && (
                <View style={[styles.sportBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.sportBadgeText, { color: colors.primary }]}>
                    {program.sport}
                  </Text>
                </View>
              )}
              <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                {formatDate(program.start_date)}
                {program.end_date ? ` – ${formatDate(program.end_date)}` : ''}
              </Text>
            </View>
          </View>
        </View>
        {program.goal_description && (
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 8, lineHeight: 18 }}>
            {program.goal_description}
          </Text>
        )}
      </View>

      {program.criteria.length > 0 && (
        <View style={[styles.settingsSection, { borderBottomColor: colors.border }]}>
          <Pressable
            style={styles.settingsToggle}
            onPress={() => setSettingsExpanded((prev) => !prev)}
          >
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
              {!settingsExpanded && (
                <Pressable
                  style={styles.editSettingsBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    setCriteriaModalVisible(true);
                  }}
                >
                  <Ionicons name="create-outline" size={14} color={colors.primary} />
                </Pressable>
              )}
              <Ionicons
                name={settingsExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </View>
          </Pressable>

          {settingsExpanded && (
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
                style={[styles.editBtnFull, { borderColor: colors.primary + '30' }]}
                onPress={() => setCriteriaModalVisible(true)}
              >
                <Ionicons name="create-outline" size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>
                  Edit Settings
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <View style={styles.trainingPlanSection}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Training Plan
        </Text>

        {flatWeeks.length === 0 ? (
          <Text style={{ fontSize: 14, color: colors.textSecondary, paddingVertical: 12 }}>
            No activities scheduled yet.
          </Text>
        ) : (
          <>
            <FlatList
              ref={weekSelectorRef}
              data={flatWeeks}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(w) => w.id}
              contentContainerStyle={styles.weekSelectorContent}
              onScrollToIndexFailed={() => {}}
              renderItem={({ item: week, index }) => {
                const isSelected = index === selectedWeekIdx;
                const weekStart = new Date(week.weekMonday);
                weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const isCurrentWeek = today >= weekStart && today < weekEnd;
                const isPast = weekEnd <= today;

                return (
                  <Pressable
                    style={[
                      styles.weekPill,
                      { backgroundColor: colors.surfaceAlt },
                      isSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
                      isCurrentWeek && !isSelected && { borderColor: colors.primary },
                      isPast && !isSelected && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      animateSlide(index > selectedWeekIdx ? 1 : -1);
                      setSelectedWeekIdx(index);
                    }}
                  >
                    <Text
                      style={[
                        styles.weekPillNumber,
                        { color: colors.textPrimary },
                        isSelected && { color: '#FFF' },
                        isPast && !isSelected && { color: colors.textSecondary },
                      ]}
                    >
                      W{week.weekNumber}
                    </Text>
                    <Text
                      style={[
                        styles.weekPillDate,
                        { color: colors.textSecondary },
                        isSelected && { color: 'rgba(255,255,255,0.8)' },
                      ]}
                    >
                      {week.weekMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                );
              }}
            />

            <View style={styles.weekNavHint}>
              <Pressable
                onPress={() => navigateWeek(-1)}
                disabled={selectedWeekIdx === 0}
                style={{ opacity: selectedWeekIdx === 0 ? 0.3 : 1 }}
                hitSlop={12}
              >
                <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
              </Pressable>
              <Text style={[styles.weekNavLabel, { color: colors.textPrimary }]}>
                Week {selectedWeek?.weekNumber} · {selectedWeek?.phaseName}
              </Text>
              <Pressable
                onPress={() => navigateWeek(1)}
                disabled={selectedWeekIdx === flatWeeks.length - 1}
                style={{ opacity: selectedWeekIdx === flatWeeks.length - 1 ? 0.3 : 1 }}
                hitSlop={12}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            {selectedWeek && (
              <Animated.View
                {...panResponder.panHandlers}
                style={{ transform: [{ translateX: slideAnim }] }}
              >
                <WeekView
                  week={selectedWeek}
                  today={today}
                  onActivityPress={(activityId: string) =>
                    navigation.navigate('ActivityDetail', { activityId })
                  }
                  onRecordActivity={(activityId: string, activityType: string) =>
                    navigation.navigate('RecordManual', { scheduledActivityId: activityId, activityType })
                  }
                  onAddActivity={(weekId: string, dayOfWeek: number) =>
                    navigation.navigate('ActivityDetail', {
                      weekId,
                      dayOfWeek,
                      programId,
                    })
                  }
                />
              </Animated.View>
            )}

            <Text style={[styles.swipeHint, { color: colors.textSecondary }]}>
              Swipe left or right to change weeks
            </Text>
          </>
        )}
      </View>

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

type WeekViewProps = {
  week: FlatWeek;
  today: Date;
  onActivityPress: (activityId: string) => void;
  onRecordActivity: (activityId: string, activityType: string) => void;
  onAddActivity: (weekId: string, dayOfWeek: number) => void;
};

function WeekView({ week, today, onActivityPress, onRecordActivity, onAddActivity }: WeekViewProps) {
  const { colors } = useTheme();

  const byDay = useMemo<Map<number, ScheduledActivityResponse[]>>(() => {
    const map = new Map<number, ScheduledActivityResponse[]>();
    for (const a of week.activities) {
      const bucket = map.get(a.day_of_week);
      if (bucket) {
        bucket.push(a);
      } else {
        map.set(a.day_of_week, [a]);
      }
    }
    return map;
  }, [week.activities]);

  const weekMonday = new Date(week.weekMonday);
  weekMonday.setHours(0, 0, 0, 0);

  return (
    <View style={styles.weekContent}>
      <Text style={[styles.weekDateRange, { color: colors.textSecondary }]}>
        {formatWeekRange(weekMonday)}
      </Text>

      {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
        const activities = byDay.get(dayIndex) ?? [];
        const offset = dayIndex === 0 ? 6 : dayIndex - 1;
        const dayDate = new Date(weekMonday);
        dayDate.setDate(dayDate.getDate() + offset);

        const isToday =
          dayDate.getFullYear() === today.getFullYear() &&
          dayDate.getMonth() === today.getMonth() &&
          dayDate.getDate() === today.getDate();
        const isPast = dayDate < today && !isToday;

        return (
          <DayCard
            key={dayIndex}
            dayName={dayAbbrev(dayIndex)}
            dayDate={dayDate}
            activities={activities}
            isToday={isToday}
            isPast={isPast}
            onPress={onActivityPress}
            onRecord={onRecordActivity}
            onAdd={() => onAddActivity(week.id, dayIndex)}
          />
        );
      })}
    </View>
  );
}

type DayCardProps = {
  dayName: string;
  dayDate: Date;
  activities: ScheduledActivityResponse[];
  isToday: boolean;
  isPast: boolean;
  onPress: (activityId: string) => void;
  onRecord: (activityId: string, activityType: string) => void;
  onAdd: () => void;
};

function DayCard({ dayName, dayDate, activities, isToday, isPast, onPress, onRecord, onAdd }: DayCardProps) {
  const hasActivities = activities.length > 0;
  const { colors } = useTheme();
  const dateNum = dayDate.getDate();
  const monthShort = dayDate.toLocaleDateString('en-US', { month: 'short' });

  return (
    <View style={[
      styles.dayCard,
      {
        backgroundColor: colors.surface,
        borderColor: isToday ? colors.primary : hasActivities ? colors.border : 'transparent',
        borderWidth: isToday ? 1.5 : hasActivities ? StyleSheet.hairlineWidth : 0,
      },
      !hasActivities && !isToday && { backgroundColor: colors.surfaceAlt, opacity: isPast ? 0.5 : 0.7 },
      isPast && hasActivities && { opacity: 0.6 },
    ]}>
      <View style={[
        styles.dayCardHeader,
        {
          backgroundColor: isToday
            ? colors.primary
            : hasActivities
              ? colors.surfaceAlt
              : 'transparent',
        },
      ]}>
        <View style={styles.dayCardHeaderLeft}>
          <Text style={[
            styles.dayCardName,
            { color: isToday ? '#FFF' : colors.textPrimary },
          ]}>
            {dayName}
          </Text>
          <Text style={[
            styles.dayCardDate,
            { color: isToday ? 'rgba(255,255,255,0.8)' : colors.textSecondary },
          ]}>
            {monthShort} {dateNum}
          </Text>
        </View>
        {isToday && (
          <View style={styles.todayBadge}>
            <Text style={styles.todayBadgeText}>Today</Text>
          </View>
        )}
        {!hasActivities && !isToday && (
          <Text style={[styles.restLabel, { color: colors.textSecondary }]}>
            Rest Day
          </Text>
        )}
      </View>

      {hasActivities && (
        <View style={styles.dayCardActivities}>
          {activities.map((activity, idx) => (
            <Pressable
              key={activity.id}
              style={({ pressed }) => [
                styles.activityItem,
                { borderBottomColor: colors.border },
                idx < activities.length - 1 && styles.activityItemBorder,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
              onPress={() => onPress(activity.id)}
            >
              <View style={[
                styles.activityIconCircle,
                { backgroundColor: isToday ? colors.primary + '15' : colors.primaryLight },
              ]}>
                <Ionicons
                  name={getActivityIcon(activity.activity_type)}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={styles.activityInfo}>
                <Text
                  style={[styles.activityType, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {formatActivityType(activity.activity_type)}
                </Text>
                <Text
                  style={[styles.activityPrescription, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {formatPrescriptionSummary(activity.prescription)}
                </Text>
              </View>
              {isManualActivity(activity.activity_type) && (
                <Pressable
                  onPress={() => onRecord(activity.id, activity.activity_type)}
                  hitSlop={10}
                  style={[styles.recordBtn, { backgroundColor: colors.primary + '12' }]}
                >
                  <Ionicons name="play" size={14} color={colors.primary} />
                </Pressable>
              )}
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </Pressable>
          ))}

          <Pressable
            style={[styles.addActivityBtn, { borderColor: colors.border }]}
            onPress={onAdd}
            hitSlop={8}
          >
            <Ionicons name="add" size={16} color={colors.textSecondary} />
            <Text style={[styles.addActivityText, { color: colors.textSecondary }]}>
              Add Activity
            </Text>
          </Pressable>
        </View>
      )}

      {!hasActivities && (
        <Pressable
          style={[styles.addActivityBtnRest, { borderTopColor: colors.border }]}
          onPress={onAdd}
          hitSlop={8}
        >
          <Ionicons name="add" size={16} color={colors.textSecondary} />
          <Text style={[styles.addActivityText, { color: colors.textSecondary }]}>
            Add Activity
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  header: {
    padding: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  programName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  sportBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  sportBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  settingsSection: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    paddingHorizontal: 16,
  },
  settingsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsCount: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  settingsContent: {
    paddingHorizontal: 16,
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
    borderRadius: 8,
    padding: 10,
    minWidth: '45%',
    flex: 1,
  },
  criterionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  criterionValue: {
    fontSize: 14,
    fontWeight: '600',
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

  trainingPlanSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },

  weekSelectorContent: {
    paddingVertical: 8,
    gap: 8,
  },
  weekPill: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 60,
  },
  weekPillNumber: {
    fontSize: 13,
    fontWeight: '700',
  },
  weekPillDate: {
    fontSize: 10,
    marginTop: 1,
  },

  weekNavHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  weekNavLabel: {
    fontSize: 15,
    fontWeight: '700',
  },

  weekContent: {
    gap: 10,
  },
  weekDateRange: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: 'center',
  },

  dayCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dayCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  dayCardName: {
    fontSize: 15,
    fontWeight: '700',
  },
  dayCardDate: {
    fontSize: 12,
  },
  todayBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  todayBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFF',
  },
  restLabel: {
    fontSize: 12,
    fontStyle: 'italic',
  },

  dayCardActivities: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  activityItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activityIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityPrescription: {
    fontSize: 12,
    marginTop: 1,
  },
  recordBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addActivityBtnRest: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  addActivityText: {
    fontSize: 12,
    fontWeight: '500',
  },

  swipeHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
