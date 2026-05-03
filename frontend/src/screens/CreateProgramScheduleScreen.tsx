import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { ACTIVITY_TYPES, formatActivityType, WEEK_DAYS_MON_SUN } from '../constants/activityIcons';
import { Fonts } from '../constants/fonts';
import { PHASE_COLORS } from '../constants/sports';
import { PrescriptionEditor } from '../components/PrescriptionEditor';
import StepIndicator from '../components/StepIndicator';
import { KineticHeader } from '../components/Kinetic';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface TemplateActivity {
  day_of_week: number;
  activity_type: string;
  prescription: Record<string, any>;
  notes?: string;
  order_index: number;
}

interface Phase {
  name: string;
  order_index: number;
  duration_weeks: number;
  template_week: { activities: TemplateActivity[] };
}

interface EditingActivity {
  phaseIndex: number;
  activityIndex: number | null; // null = new activity
  dayOfWeek: number;
  activity_type: string;
  prescription: Record<string, any>;
  notes: string;
}

interface Props {
  navigation: any;
  route: any;
}

export default function CreateProgramScheduleScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = route.params || {};
  const { name, sport, goalMode, event, eventDate, durationWeeks, goal, startDate } = params;

  const [phases, setPhases] = useState<Phase[]>(params.phases ?? []);
  const [selectedPhaseIdx, setSelectedPhaseIdx] = useState(0);
  const [editing, setEditing] = useState<EditingActivity | null>(null);

  const selectedPhase = phases[selectedPhaseIdx];
  const phaseColor = PHASE_COLORS[selectedPhaseIdx % PHASE_COLORS.length];

  const updatePhase = (index: number, updater: (p: Phase) => Phase) => {
    setPhases(prev => prev.map((p, i) => (i === index ? updater(p) : p)));
  };

  const getActivitiesForDay = (dayOfWeek: number): TemplateActivity[] =>
    selectedPhase
      ? selectedPhase.template_week.activities
          .filter(a => a.day_of_week === dayOfWeek)
          .sort((a, b) => a.order_index - b.order_index)
      : [];

  const openNewActivity = (dayOfWeek: number) => {
    setEditing({
      phaseIndex: selectedPhaseIdx,
      activityIndex: null,
      dayOfWeek,
      activity_type: '',
      prescription: {},
      notes: '',
    });
  };

  const openEditActivity = (actIndex: number, act: TemplateActivity) => {
    setEditing({
      phaseIndex: selectedPhaseIdx,
      activityIndex: actIndex,
      dayOfWeek: act.day_of_week,
      activity_type: act.activity_type,
      prescription: { ...act.prescription },
      notes: act.notes || '',
    });
  };

  const saveActivity = () => {
    if (!editing || !editing.activity_type) return;
    updatePhase(editing.phaseIndex, p => {
      const activities = [...p.template_week.activities];
      if (editing.activityIndex !== null) {
        activities[editing.activityIndex] = {
          day_of_week: editing.dayOfWeek,
          activity_type: editing.activity_type,
          prescription: editing.prescription,
          notes: editing.notes || undefined,
          order_index: activities[editing.activityIndex].order_index,
        };
      } else {
        activities.push({
          day_of_week: editing.dayOfWeek,
          activity_type: editing.activity_type,
          prescription: editing.prescription,
          notes: editing.notes || undefined,
          order_index: activities.filter(a => a.day_of_week === editing.dayOfWeek).length,
        });
      }
      return { ...p, template_week: { activities } };
    });
    setEditing(null);
  };

  const deleteActivity = () => {
    if (!editing || editing.activityIndex === null) return;
    updatePhase(editing.phaseIndex, p => ({
      ...p,
      template_week: {
        activities: p.template_week.activities.filter((_, i) => i !== editing.activityIndex),
      },
    }));
    setEditing(null);
  };

  const totalWeeks = phases.reduce((sum, p) => sum + p.duration_weeks, 0);
  const hasActivities = phases.some(p => p.template_week.activities.length > 0);

  // Stats for the currently selected phase — rough heuristic (55min/activity) for at-a-glance feedback.
  const activities = selectedPhase?.template_week.activities ?? [];
  const sessionCount = activities.length;
  const restDays = 7 - new Set(activities.map(a => a.day_of_week)).size;
  const estTotalMin = sessionCount * 55;

  const handleReview = () => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + totalWeeks * 7 - 1);
    const endDate = end.toISOString().split('T')[0];

    navigation.navigate('CreateProgramReview', {
      name,
      sport,
      goalMode,
      event,
      eventDate,
      durationWeeks,
      goal,
      startDate,
      endDate,
      phases,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
        <KineticHeader
          eyebrow="Program Builder"
          title="Weekly Template"
          subtitle="Shape the repeating template for each phase. Each week of the phase mirrors what you build here."
          style={styles.header}
        />
        <StepIndicator current={3} total={4} />

        {/* Phase tabs (color-coded) */}
        <View style={styles.phaseTabs}>
          {phases.map((p, i) => {
            const c = PHASE_COLORS[i % PHASE_COLORS.length];
            const active = i === selectedPhaseIdx;
            return (
              <Pressable
                key={i}
                style={[
                  styles.phaseTab,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  active && { backgroundColor: `${c}15`, borderColor: c },
                ]}
                onPress={() => setSelectedPhaseIdx(i)}
              >
                <Text style={[styles.phaseTabText, { color: colors.textSecondary }, active && { color: c }]}>
                  {p.name}
                </Text>
                <Text style={[styles.phaseTabWeeks, { color: colors.textSecondary }, active && { color: c }]}>
                  {p.duration_weeks}w
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedPhase && (
          <Text style={[styles.phaseHint, { color: colors.textSecondary }]}>
            <Ionicons name="repeat-outline" size={12} color={colors.textSecondary} /> Repeats for {selectedPhase.duration_weeks} weeks
          </Text>
        )}

        {/* Day list */}
        {DAY_LABELS.map((dayLabel, i) => {
          const dayValue = WEEK_DAYS_MON_SUN[i];
          const dayActivities = getActivitiesForDay(dayValue);
          const isRest = dayActivities.length === 0;
          return (
            <View
              key={dayLabel}
              style={[
                styles.dayRow,
                { backgroundColor: colors.surface, borderColor: isRest ? colors.border : `${phaseColor}44` },
              ]}
            >
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{dayLabel}</Text>
                {isRest ? (
                  <>
                    <View style={[styles.restIcon, { backgroundColor: colors.surfaceAlt }]}>
                      <Ionicons name="moon-outline" size={13} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.restText, { color: colors.textSecondary }]}>Rest day</Text>
                  </>
                ) : (
                  <Text style={[styles.dayCount, { color: phaseColor }]}>
                    {dayActivities.length} {dayActivities.length === 1 ? 'workout' : 'workouts'}
                  </Text>
                )}
                <Pressable onPress={() => openNewActivity(dayValue)} hitSlop={8}>
                  <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                </Pressable>
              </View>
              {!isRest && (
                <View style={styles.dayActivities}>
                  {dayActivities.map((act, actIdx) => {
                    const globalIdx = selectedPhase!.template_week.activities.indexOf(act);
                    const detail = [act.prescription?.distance, act.prescription?.duration, act.prescription?.intensity]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <Pressable
                        key={actIdx}
                        style={[styles.activityPill, { backgroundColor: `${phaseColor}0D`, borderColor: `${phaseColor}33` }]}
                        onPress={() => openEditActivity(globalIdx, act)}
                      >
                        <View style={styles.activityPillBody}>
                          <Text style={[styles.activityPillTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                            {formatActivityType(act.activity_type)}
                          </Text>
                          {detail ? (
                            <Text style={[styles.activityPillDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                              {detail}
                            </Text>
                          ) : null}
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.textSecondary} />
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Stats footer */}
        <View style={styles.statsRow}>
          {[
            { icon: 'flame-outline' as const, color: colors.tertiary, val: String(sessionCount), label: 'Sessions' },
            { icon: 'time-outline' as const, color: colors.secondary, val: `~${estTotalMin}m`, label: 'Est. Time' },
            { icon: 'moon-outline' as const, color: colors.primary, val: `${restDays}d`, label: 'Rest Days' },
          ].map((s, idx) => (
            <View
              key={idx}
              style={[styles.statTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{s.val}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <Text style={[styles.footerInfo, { color: colors.textSecondary }]}>{totalWeeks} weeks total</Text>
        <Pressable
          style={[styles.reviewButton, { backgroundColor: colors.primary }, !hasActivities && styles.reviewButtonDisabled]}
          onPress={handleReview}
          disabled={!hasActivities}
        >
          <Text style={styles.reviewButtonText}>Review &amp; Launch</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      </View>

      {/* Activity editor bottom sheet */}
      <Modal visible={editing !== null} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setEditing(null)}>
            <Pressable
              style={[styles.bottomSheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 20 }]}
              onPress={e => e.stopPropagation()}
            >
              <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                  {editing?.activityIndex !== null ? 'Edit Activity' : 'Add Activity'}
                </Text>
                <Text style={[styles.sheetDay, { color: colors.textSecondary }]}>
                  {editing ? DAY_LABELS[WEEK_DAYS_MON_SUN.indexOf(editing.dayOfWeek)] : ''}
                </Text>

                <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Activity Type</Text>
                <View style={styles.typeChipsWrap}>
                  {ACTIVITY_TYPES.map(item => (
                    <Pressable
                      key={item}
                      style={[styles.typeChip, { backgroundColor: colors.surfaceAlt }, editing?.activity_type === item && { backgroundColor: phaseColor }]}
                      onPress={() => setEditing(prev => (prev ? { ...prev, activity_type: item } : null))}
                    >
                      <Text style={[styles.typeChipText, { color: colors.textSecondary }, editing?.activity_type === item && styles.typeChipTextActive]}>
                        {formatActivityType(item)}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {editing?.activity_type ? (
                  <>
                    <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Prescription</Text>
                    <PrescriptionEditor
                      activityType={editing.activity_type}
                      prescription={editing.prescription}
                      onChange={p => setEditing(prev => (prev ? { ...prev, prescription: p } : null))}
                    />

                    <Text style={[styles.sheetLabel, { color: colors.textSecondary }]}>Notes (optional)</Text>
                    <TextInput
                      style={[styles.notesInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border }]}
                      placeholder="Any additional notes..."
                      placeholderTextColor={colors.textSecondary}
                      value={editing.notes}
                      onChangeText={t => setEditing(prev => (prev ? { ...prev, notes: t } : null))}
                      multiline
                    />
                  </>
                ) : null}

                <View style={styles.sheetActions}>
                  {editing?.activityIndex !== null && (
                    <Pressable style={[styles.deleteButton, { borderColor: phaseColor }]} onPress={deleteActivity}>
                      <Ionicons name="trash-outline" size={18} color={phaseColor} />
                      <Text style={[styles.deleteButtonText, { color: phaseColor }]}>Delete</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[
                      styles.saveButton,
                      { backgroundColor: phaseColor },
                      !editing?.activity_type && styles.saveButtonDisabled,
                    ]}
                    onPress={saveActivity}
                    disabled={!editing?.activity_type}
                  >
                    <Text style={styles.saveButtonText}>{editing?.activityIndex !== null ? 'Update' : 'Add'}</Text>
                  </Pressable>
                </View>
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },

  phaseTabs: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
  },
  phaseTab: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  phaseTabText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  phaseTabWeeks: {
    fontSize: 10,
    fontFamily: Fonts.body,
    marginTop: 2,
    opacity: 0.85,
  },
  phaseHint: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 8,
    marginBottom: 12,
  },

  dayRow: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 8,
    gap: 10,
  },
  dayLabel: {
    width: 28,
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  restIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  dayCount: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  dayActivities: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
  },
  activityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  activityPillBody: {
    flex: 1,
  },
  activityPillTitle: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  activityPillDetail: {
    fontSize: 11,
    fontFamily: Fonts.body,
    marginTop: 1,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  statLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodyMedium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerInfo: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  reviewButtonDisabled: {
    opacity: 0.4,
  },
  reviewButtonText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
    color: '#FFF',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: Fonts.heading,
    marginBottom: 4,
  },
  sheetDay: {
    fontSize: 14,
    marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 8,
    marginTop: 16,
  },
  typeChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  typeChipText: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  typeChipTextActive: {
    color: '#FFF',
  },
  notesInput: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: Fonts.body,
    borderWidth: 1,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 16,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
  },
  deleteButtonText: {
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 18,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
    color: '#FFF',
  },
});
