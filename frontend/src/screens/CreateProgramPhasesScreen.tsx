import { useMemo, useState } from 'react';
import {
  Alert,
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
import { Fonts } from '../constants/fonts';
import { PHASE_COLORS, PHASE_PRESETS } from '../constants/sports';
import StepIndicator from '../components/StepIndicator';
import { KineticHeader } from '../components/Kinetic';

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

interface Props {
  navigation: any;
  route: any;
}

function buildEmptyPhase(name: string, weeks: number, order: number): Phase {
  return {
    name,
    order_index: order,
    duration_weeks: weeks,
    template_week: { activities: [] },
  };
}

// Compute the program length in whole weeks from the user's Step 1 choices.
// Event mode: weeks from start_date (Mon) to event_date inclusive of both endpoints.
// Duration mode: the chosen durationWeeks. Falls back to 12 if neither is set.
function computeTargetWeeks(params: any): number {
  if (params.goalMode === 'event' && params.eventDate && params.startDate) {
    const start = new Date(params.startDate + 'T00:00:00');
    const end = new Date(params.eventDate + 'T00:00:00');
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const days = Math.round((end.getTime() - start.getTime()) / (24 * 3600 * 1000));
      return Math.max(1, Math.floor(days / 7) + 1);
    }
  }
  return Math.max(1, params.durationWeeks ?? 12);
}

// Scale a preset's weeks proportionally to hit `target` exactly. Each phase keeps
// at least 1 week; rounding remainder is absorbed into the largest phase.
function scalePresetToTarget(preset: { name: string; weeks: number }[], target: number): { name: string; weeks: number }[] {
  const total = preset.reduce((s, p) => s + p.weeks, 0);
  if (total <= 0 || preset.length === 0) return preset.map(p => ({ ...p }));
  const scaled = preset.map(p => ({ ...p, weeks: Math.max(1, Math.round((p.weeks / total) * target)) }));
  let diff = target - scaled.reduce((s, p) => s + p.weeks, 0);
  while (diff !== 0) {
    if (diff > 0) {
      const idx = scaled.reduce((m, p, i) => (p.weeks > scaled[m].weeks ? i : m), 0);
      scaled[idx].weeks += 1;
      diff -= 1;
    } else {
      const idx = scaled.reduce(
        (m, p, i) => (p.weeks > 1 && (m < 0 || p.weeks > scaled[m].weeks) ? i : m),
        -1,
      );
      if (idx < 0) break;
      scaled[idx].weeks -= 1;
      diff += 1;
    }
  }
  return scaled;
}

function defaultPhasesForTarget(target: number, goalMode: string): Phase[] {
  // Event mode with enough room: scaled Base/Build/Peak. Otherwise a single block
  // sized to the target so the user starts in a valid state.
  if (goalMode === 'event' && target >= 4) {
    return scalePresetToTarget(
      [
        { name: 'Base', weeks: 5 },
        { name: 'Build', weeks: 4 },
        { name: 'Peak', weeks: 3 },
      ],
      target,
    ).map((p, i) => buildEmptyPhase(p.name, p.weeks, i));
  }
  return [buildEmptyPhase('Training', target, 0)];
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function fmt(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CreateProgramPhasesScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const params = route.params || {};
  const { name, sport, goalMode, event, eventDate, durationWeeks, goal, startDate } = params;

  const targetWeeks = useMemo(() => computeTargetWeeks(params), [params]);

  const [phases, setPhases] = useState<Phase[]>(() => {
    if (params.phases && params.phases.length > 0) return params.phases;
    return defaultPhasesForTarget(targetWeeks, goalMode ?? 'duration');
  });

  const totalWeeks = useMemo(() => phases.reduce((s, p) => s + p.duration_weeks, 0), [phases]);
  const remainingWeeks = targetWeeks - totalWeeks;
  const exactMatch = remainingWeeks === 0;
  const overTarget = remainingWeeks < 0;

  const phaseDates = useMemo(() => {
    if (!startDate) return [];
    let cursor = new Date(startDate + 'T00:00:00');
    return phases.map(p => {
      const start = new Date(cursor);
      const end = addDays(cursor, p.duration_weeks * 7 - 1);
      cursor = addDays(end, 1);
      return { start, end };
    });
  }, [phases, startDate]);

  const programEnd = phaseDates.length > 0 ? phaseDates[phaseDates.length - 1].end : null;

  const applyPreset = (presetId: string) => {
    const preset = PHASE_PRESETS.find(p => p.id === presetId);
    if (!preset || !preset.phases) return;
    const scaled = scalePresetToTarget(preset.phases, targetWeeks);
    setPhases(scaled.map((p, i) => buildEmptyPhase(p.name, p.weeks, i)));
  };

  const updatePhase = (idx: number, updater: (p: Phase) => Phase) => {
    setPhases(prev => prev.map((p, i) => (i === idx ? updater(p) : p)));
  };

  const addPhase = () => {
    if (remainingWeeks <= 0) return;
    const newWeeks = Math.min(3, remainingWeeks);
    setPhases(prev => [
      ...prev,
      buildEmptyPhase(`Phase ${prev.length + 1}`, newWeeks, prev.length),
    ]);
  };

  const deletePhase = (idx: number) => {
    if (phases.length <= 1) return;
    Alert.alert('Delete Phase', `Delete "${phases[idx].name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPhases(prev =>
            prev.filter((_, i) => i !== idx).map((p, i) => ({ ...p, order_index: i })),
          );
        },
      },
    ]);
  };

  const handleNext = () => {
    navigation.navigate('CreateProgramSchedule', {
      name,
      sport,
      goalMode,
      event,
      eventDate,
      durationWeeks,
      goal,
      startDate,
      phases,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <KineticHeader
          eyebrow="Program Builder"
          title="Phases"
          subtitle={`Split the ${targetWeeks}-week program into training blocks. Tap a preset or build your own.`}
          style={styles.header}
        />
        <StepIndicator current={2} total={4} />

        {/* Preset chips */}
        <View style={styles.presetsRow}>
          {PHASE_PRESETS.map(p => (
            <Pressable
              key={p.id}
              style={[styles.presetChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              onPress={() => p.phases && applyPreset(p.id)}
              disabled={!p.phases}
            >
              <Text style={[styles.presetChipText, { color: colors.textSecondary }, !p.phases && { opacity: 0.5 }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Phase list */}
        {phases.map((phase, i) => {
          const color = PHASE_COLORS[i % PHASE_COLORS.length];
          const dates = phaseDates[i];
          return (
            <View
              key={i}
              style={[styles.phaseRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.phaseRowMain}>
                <View style={[styles.phaseColorBar, { backgroundColor: color }]} />
                <TextInput
                  value={phase.name}
                  onChangeText={text => updatePhase(i, p => ({ ...p, name: text }))}
                  style={[styles.phaseNameInput, { color: colors.textPrimary }]}
                  placeholder="Phase name"
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={[styles.stepper, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Pressable
                    style={[styles.stepperButton, { borderRightColor: colors.border }]}
                    onPress={() => updatePhase(i, p => ({ ...p, duration_weeks: Math.max(1, p.duration_weeks - 1) }))}
                  >
                    <Ionicons name="remove" size={14} color={colors.textPrimary} />
                  </Pressable>
                  <Text style={[styles.stepperValue, { color }]}>{phase.duration_weeks}w</Text>
                  <Pressable
                    style={[styles.stepperButton, { borderLeftColor: colors.border }, remainingWeeks <= 0 && styles.stepperButtonDisabled]}
                    onPress={() => {
                      if (remainingWeeks <= 0) return;
                      updatePhase(i, p => ({ ...p, duration_weeks: p.duration_weeks + 1 }));
                    }}
                    disabled={remainingWeeks <= 0}
                  >
                    <Ionicons name="add" size={14} color={remainingWeeks <= 0 ? colors.textSecondary : colors.textPrimary} />
                  </Pressable>
                </View>
                {phases.length > 1 && (
                  <Pressable onPress={() => deletePhase(i)} style={styles.deleteIcon} hitSlop={8}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
                  </Pressable>
                )}
              </View>
              {dates && (
                <View style={styles.phaseDates}>
                  <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                  <Text style={[styles.phaseDatesText, { color: colors.textSecondary }]}>
                    {fmt(dates.start)} – {fmt(dates.end)}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Add phase */}
        <Pressable
          style={[styles.addPhase, { borderColor: colors.border }, remainingWeeks <= 0 && styles.addPhaseDisabled]}
          onPress={addPhase}
          disabled={remainingWeeks <= 0}
        >
          <Ionicons name="add-circle-outline" size={16} color={remainingWeeks <= 0 ? colors.textSecondary : colors.primary} />
          <Text style={[styles.addPhaseText, { color: remainingWeeks <= 0 ? colors.textSecondary : colors.primary }]}>Add Phase</Text>
        </Pressable>

        {/* Proportional bar */}
        <View style={styles.arcBar}>
          {phases.map((p, i) => (
            <View
              key={i}
              style={{ flex: p.duration_weeks, backgroundColor: PHASE_COLORS[i % PHASE_COLORS.length] }}
            />
          ))}
        </View>

        <View
          style={[
            styles.totalRow,
            {
              backgroundColor: colors.surface,
              borderColor: exactMatch ? colors.success : overTarget ? colors.error : colors.border,
            },
          ]}
        >
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            {exactMatch ? 'Total duration' : overTarget ? `Over by ${-remainingWeeks}w` : `${remainingWeeks}w left to plan`}
          </Text>
          <Text style={[styles.totalValue, { color: colors.textPrimary }]}>
            {totalWeeks} / {targetWeeks} {targetWeeks === 1 ? 'week' : 'weeks'}
            {programEnd && exactMatch ? ` · ends ${fmt(programEnd)}` : ''}
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.primary }, !exactMatch && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!exactMatch}
        >
          <Text style={styles.nextButtonText}>Plan the Workouts</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  header: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },

  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },

  phaseRow: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  phaseRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  phaseColorBar: {
    width: 4,
    height: 42,
    borderRadius: 2,
  },
  phaseNameInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.bodySemiBold,
    paddingVertical: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderLeftWidth: 1,
  },
  stepperButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    fontFamily: Fonts.heading,
    fontSize: 14,
    minWidth: 38,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  deleteIcon: {
    padding: 2,
  },
  phaseDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    marginLeft: 14,
  },
  phaseDatesText: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },

  addPhase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: 14,
  },
  addPhaseDisabled: {
    opacity: 0.4,
  },
  addPhaseText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },

  arcBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
  },

  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: Fonts.body,
  },
  totalValue: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },

  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    paddingVertical: 16,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
    color: '#FFF',
  },
});
