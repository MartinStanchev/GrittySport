import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
  formatPrescriptionSummary,
  isManualActivity,
  dayAbbrev,
} from '../constants/activityIcons';
import { getProgram, deleteProgram, clearChatMemory } from '../services/api';
import type { ProgramDetail, ScheduledActivityResponse } from '../services/api';
import { CriteriaEditorModal } from '../components/CriteriaEditorModal';
import { useProgram } from '../contexts/ProgramContext';

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
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [criteriaModalVisible, setCriteriaModalVisible] = useState(false);

  const weekSelectorRef = useRef<FlatList>(null);
  const initialVersionRef = useRef(programDataVersion);

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

  const offerMemoryClear = useCallback(() => {
    Alert.alert(
      "Clear Grit's Memory?",
      "Grit may still remember details from this program. Clear his coaching memory so he starts fresh?",
      [
        { text: 'Keep Memory', style: 'cancel' },
        {
          text: 'Clear Memory',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearChatMemory();
            } catch {
              // non-critical
            }
          },
        },
      ],
    );
  }, []);

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
              offerMemoryClear();
            } catch {
              Alert.alert('Error', 'Failed to delete program');
            }
          },
        },
      ],
    );
  }, [programId, navigation, notifyProgramDataChanged, offerMemoryClear]);

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

  // Set delete button in header once program name is loaded
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

    let found = flatWeeks.find((w) => {
      const start = new Date(w.weekMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return today >= start && today < end;
    });

    if (!found) {
      found = flatWeeks.find((w) => {
        const start = new Date(w.weekMonday);
        start.setHours(0, 0, 0, 0);
        return start > today;
      });
    }
    if (!found) {
      found = flatWeeks[flatWeeks.length - 1];
    }

    setSelectedWeekId(found.id);
  }, [flatWeeks]);

  useEffect(() => {
    if (!selectedWeekId) return;
    const idx = flatWeeks.findIndex((w) => w.id === selectedWeekId);
    if (idx >= 0) {
      setTimeout(() => {
        weekSelectorRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      }, 300);
    }
  }, [selectedWeekId, flatWeeks]);

  const selectedWeek = useMemo(
    () => flatWeeks.find((w) => w.id === selectedWeekId) ?? null,
    [flatWeeks, selectedWeekId],
  );

  const handleCriteriaSaved = useCallback(() => {
    notifyProgramDataChanged();
  }, [notifyProgramDataChanged]);

  if (loading) {
    return (
      <View style={[styles.centered, { flex: 1, backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={[styles.centered, { flex: 1, backgroundColor: colors.background }]}>
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
      <View style={{
        padding: 20,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
      }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 }}>
          {program.name}
        </Text>
        {program.sport && (
          <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '600', marginBottom: 4 }}>
            {program.sport}
          </Text>
        )}
        {program.goal_description && (
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 4, lineHeight: 20 }}>
            {program.goal_description}
          </Text>
        )}
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {formatDate(program.start_date)}
          {program.end_date ? ` — ${formatDate(program.end_date)}` : ''}
        </Text>
      </View>

      {program.criteria.length > 0 && (
        <View style={{
          padding: 16,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}>
          <View style={styles.sectionHeader}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
              Program Settings
            </Text>
            <Pressable
              style={styles.editSettingsBtn}
              onPress={() => setCriteriaModalVisible(true)}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '600' }}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.criteriaGrid}>
            {program.criteria.map((c) => (
              <View key={c.id} style={[styles.criterionCard, { backgroundColor: colors.surfaceAlt }]}>
                <Text style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
                  {c.label}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textPrimary }}>
                  {c.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>
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
              renderItem={({ item: week }) => {
                const isSelected = week.id === selectedWeekId;
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
                      isPast && !isSelected && { opacity: 0.6 },
                    ]}
                    onPress={() => setSelectedWeekId(week.id)}
                  >
                    <Text
                      style={[
                        { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
                        isSelected && { color: '#FFF' },
                        isPast && !isSelected && { color: colors.textSecondary },
                      ]}
                    >
                      W{week.weekNumber}
                    </Text>
                    <Text
                      style={[
                        { fontSize: 10, color: colors.textSecondary, marginTop: 1 },
                        isSelected && { color: '#FFF' },
                        isPast && !isSelected && { color: colors.textSecondary },
                      ]}
                    >
                      {week.weekMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                  </Pressable>
                );
              }}
            />

            {selectedWeek && (
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
            )}
          </>
        )}
      </View>

      <CriteriaEditorModal
        visible={criteriaModalVisible}
        programId={programId}
        criteria={program.criteria}
        onClose={() => setCriteriaModalVisible(false)}
        onSaved={handleCriteriaSaved}
      />
    </ScrollView>
  );
}

// ─── WeekView ────────────────────────────────────────────────────────────────

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
      const existing = map.get(a.day_of_week) ?? [];
      map.set(a.day_of_week, [...existing, a]);
    }
    return map;
  }, [week.activities]);

  const weekMonday = new Date(week.weekMonday);
  weekMonday.setHours(0, 0, 0, 0);

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
          Week {week.weekNumber} · {week.phaseName}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
          {formatWeekRange(weekMonday)}
        </Text>
      </View>

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
          <DayRow
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

// ─── DayRow ──────────────────────────────────────────────────────────────────

type DayRowProps = {
  dayName: string;
  dayDate: Date;
  activities: ScheduledActivityResponse[];
  isToday: boolean;
  isPast: boolean;
  onPress: (activityId: string) => void;
  onRecord: (activityId: string, activityType: string) => void;
  onAdd: () => void;
};

function DayRow({ dayName, dayDate, activities, isToday, isPast, onPress, onRecord, onAdd }: DayRowProps) {
  const { colors } = useTheme();
  const dateNum = dayDate.getDate();
  const hasActivities = activities.length > 0;

  return (
    <View style={[
      styles.dayRow,
      isToday && { backgroundColor: colors.primaryLight },
    ]}>
      <View style={styles.dayLabel}>
        <Text style={[
          { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
          isToday && { color: colors.primary },
          isPast && { color: colors.border },
        ]}>
          {dayName}
        </Text>
        <Text style={[
          { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginTop: 1 },
          isToday && { color: colors.primary },
          isPast && { color: colors.border },
        ]}>
          {dateNum}
        </Text>
      </View>

      <View style={styles.dayActivitiesColumn}>
        {hasActivities ? (
          activities.map((activity) => (
            <Pressable
              key={activity.id}
              style={({ pressed }) => [
                styles.activityRow,
                pressed && { backgroundColor: colors.surfaceAlt },
              ]}
              onPress={() => onPress(activity.id)}
            >
              <View
                style={[
                  styles.activityIconCircle,
                  { backgroundColor: colors.primaryLight },
                  isToday && { backgroundColor: colors.primary },
                  isPast && { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <Ionicons
                  name={getActivityIcon(activity.activity_type)}
                  size={16}
                  color={isToday ? '#FFF' : isPast ? colors.textSecondary : colors.primary}
                />
              </View>
              <View style={styles.activityInfo}>
                <Text
                  style={[
                    { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
                    isPast && !isToday && { color: colors.textSecondary },
                  ]}
                  numberOfLines={1}
                >
                  {activity.activity_type}
                </Text>
                <Text
                  style={[
                    { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
                    isPast && !isToday && { color: colors.border },
                  ]}
                  numberOfLines={1}
                >
                  {formatPrescriptionSummary(activity.prescription)}
                </Text>
              </View>
              {isManualActivity(activity.activity_type) && (
                <Pressable
                  onPress={() => onRecord(activity.id, activity.activity_type)}
                  hitSlop={10}
                  style={styles.recordIconBtn}
                >
                  <Ionicons name="play-circle-outline" size={20} color={colors.primary} />
                </Pressable>
              )}
              <Ionicons
                name="chevron-forward"
                size={14}
                color={isPast && !isToday ? colors.border : colors.textSecondary}
              />
            </Pressable>
          ))
        ) : (
          <View style={styles.restRow}>
            <View style={styles.restDot} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.border, fontStyle: 'italic' }}>
              Rest
            </Text>
          </View>
        )}

        <Pressable style={styles.addButton} onPress={onAdd} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  // Criteria
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

  // Week Selector
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

  // Day Row
  dayRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 2,
    gap: 10,
  },
  dayLabel: {
    width: 36,
    alignItems: 'center',
    paddingTop: 4,
  },
  dayActivitiesColumn: {
    flex: 1,
    gap: 2,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 8,
    gap: 10,
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 10,
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  restDot: {
    width: 32,
    height: 32,
  },
  addButton: {
    padding: 2,
    alignSelf: 'flex-end',
    marginBottom: 2,
  },
  recordIconBtn: {
    padding: 4,
    marginRight: 4,
  },
});
