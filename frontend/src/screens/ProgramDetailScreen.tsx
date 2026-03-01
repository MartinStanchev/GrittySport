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
import { Colors } from '../constants/colors';
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
          <Ionicons name="trash-outline" size={20} color={Colors.primary} />
        </Pressable>
      ),
    });
  }, [navigation, handleDelete]);

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
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Program not found</Text>
      </View>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    >
      <View style={styles.headerSection}>
        <Text style={styles.programName}>{program.name}</Text>
        {program.sport && <Text style={styles.sport}>{program.sport}</Text>}
        {program.goal_description && (
          <Text style={styles.goal}>{program.goal_description}</Text>
        )}
        <Text style={styles.dates}>
          {formatDate(program.start_date)}
          {program.end_date ? ` — ${formatDate(program.end_date)}` : ''}
        </Text>
      </View>

      {program.criteria.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Program Settings</Text>
            <Pressable
              style={styles.editSettingsBtn}
              onPress={() => setCriteriaModalVisible(true)}
            >
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editSettingsBtnText}>Edit</Text>
            </Pressable>
          </View>
          <View style={styles.criteriaGrid}>
            {program.criteria.map((c) => (
              <View key={c.id} style={styles.criterionCard}>
                <Text style={styles.criterionLabel}>{c.label}</Text>
                <Text style={styles.criterionValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training Plan</Text>

        {flatWeeks.length === 0 ? (
          <Text style={styles.emptyText}>No activities scheduled yet.</Text>
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
                      isSelected && styles.weekPillSelected,
                      isCurrentWeek && !isSelected && styles.weekPillCurrent,
                      isPast && !isSelected && styles.weekPillPast,
                    ]}
                    onPress={() => setSelectedWeekId(week.id)}
                  >
                    <Text
                      style={[
                        styles.weekPillNumber,
                        isSelected && styles.weekPillTextSelected,
                        isPast && !isSelected && styles.weekPillTextPast,
                      ]}
                    >
                      W{week.weekNumber}
                    </Text>
                    <Text
                      style={[
                        styles.weekPillRange,
                        isSelected && styles.weekPillTextSelected,
                        isPast && !isSelected && styles.weekPillTextPast,
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
    <View style={styles.weekView}>
      <View style={styles.weekViewHeader}>
        <Text style={styles.weekViewTitle}>
          Week {week.weekNumber} · {week.phaseName}
        </Text>
        <Text style={styles.weekViewRange}>{formatWeekRange(weekMonday)}</Text>
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
  const dateNum = dayDate.getDate();
  const hasActivities = activities.length > 0;

  return (
    <View style={[styles.dayRow, isToday && styles.dayRowToday]}>
      <View style={styles.dayLabel}>
        <Text style={[styles.dayName, isToday && styles.dayNameToday, isPast && styles.dayNamePast]}>
          {dayName}
        </Text>
        <Text style={[styles.dayDate, isToday && styles.dayDateToday, isPast && styles.dayDatePast]}>
          {dateNum}
        </Text>
      </View>

      <View style={styles.dayActivitiesColumn}>
        {hasActivities ? (
          activities.map((activity) => (
            <Pressable
              key={activity.id}
              style={({ pressed }) => [styles.activityRow, pressed && styles.dayRowPressed]}
              onPress={() => onPress(activity.id)}
            >
              <View
                style={[
                  styles.activityIconCircle,
                  isToday && styles.activityIconCircleToday,
                  isPast && styles.activityIconCirclePast,
                ]}
              >
                <Ionicons
                  name={getActivityIcon(activity.activity_type)}
                  size={16}
                  color={isToday ? '#FFF' : isPast ? Colors.textSecondary : Colors.primary}
                />
              </View>
              <View style={styles.activityInfo}>
                <Text
                  style={[styles.activityType, isPast && !isToday && styles.activityTypePast]}
                  numberOfLines={1}
                >
                  {activity.activity_type}
                </Text>
                <Text
                  style={[styles.activitySummary, isPast && !isToday && styles.activitySummaryPast]}
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
                  <Ionicons name="play-circle-outline" size={20} color={Colors.primary} />
                </Pressable>
              )}
              <Ionicons
                name="chevron-forward"
                size={14}
                color={isPast && !isToday ? '#CCC' : Colors.textSecondary}
              />
            </Pressable>
          ))
        ) : (
          <View style={styles.restRow}>
            <View style={styles.restDot} />
            <Text style={styles.restText}>Rest</Text>
          </View>
        )}

        <Pressable style={styles.addButton} onPress={onAdd} hitSlop={8}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingVertical: 12,
  },

  // Header
  headerSection: {
    backgroundColor: Colors.surface,
    padding: 20,
    marginBottom: 12,
  },
  programName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sport: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  goal: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  dates: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Section
  section: {
    backgroundColor: Colors.surface,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  editSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editSettingsBtnText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Criteria
  criteriaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  criterionCard: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 10,
    minWidth: '45%',
    flex: 1,
  },
  criterionLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  criterionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
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
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
    minWidth: 60,
  },
  weekPillSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  weekPillCurrent: {
    borderColor: Colors.primary,
  },
  weekPillPast: {
    opacity: 0.6,
  },
  weekPillNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  weekPillRange: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  weekPillTextSelected: {
    color: '#FFF',
  },
  weekPillTextPast: {
    color: Colors.textSecondary,
  },

  // Week View
  weekView: {
    marginTop: 16,
  },
  weekViewHeader: {
    marginBottom: 12,
  },
  weekViewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  weekViewRange: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
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
  dayRowToday: {
    backgroundColor: '#FEF0F0',
  },
  dayRowPressed: {
    backgroundColor: '#F0F0F0',
  },
  dayLabel: {
    width: 36,
    alignItems: 'center',
    paddingTop: 4,
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dayNameToday: {
    color: Colors.primary,
  },
  dayNamePast: {
    color: '#CCC',
  },
  dayDate: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  dayDateToday: {
    color: Colors.primary,
  },
  dayDatePast: {
    color: '#CCC',
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
    backgroundColor: '#FEE2E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityIconCircleToday: {
    backgroundColor: Colors.primary,
  },
  activityIconCirclePast: {
    backgroundColor: '#F0F0F0',
  },
  activityInfo: {
    flex: 1,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  activityTypePast: {
    color: Colors.textSecondary,
  },
  activitySummary: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  activitySummaryPast: {
    color: '#CCC',
  },
  restDot: {
    width: 32,
    height: 32,
  },
  restText: {
    flex: 1,
    fontSize: 14,
    color: '#CCC',
    fontStyle: 'italic',
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
