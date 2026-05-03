import { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { Fonts } from '../constants/fonts';
import { RACE_EVENTS, SPORT_LABELS } from '../constants/sports';
import StepIndicator from '../components/StepIndicator';
import { KineticHeader, KineticPanel } from '../components/Kinetic';
import DatePickerSheet from '../components/DatePickerSheet';

const DURATION_PRESETS = [4, 8, 12, 16, 20, 24];

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function weeksUntil(eventDate: string): number | null {
  if (!eventDate) return null;
  const target = new Date(eventDate + 'T00:00:00');
  const now = getToday();
  const diff = Math.round((target.getTime() - now.getTime()) / (7 * 24 * 3600 * 1000));
  return diff > 0 ? diff : null;
}

function parseISODate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

type GoalMode = 'event' | 'duration';

interface Props {
  navigation: any;
  route: any;
}

export default function CreateProgramBasicsScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // If we navigated back from a later step, restore state from route params.
  const restored = route.params || {};
  const [name, setName] = useState<string>(restored.name ?? '');
  const [sport, setSport] = useState<string>(restored.sport ?? '');
  const [customSport, setCustomSport] = useState<boolean>(
    !!restored.sport && !SPORT_LABELS.includes(restored.sport),
  );
  const [goalMode, setGoalMode] = useState<GoalMode>(restored.goalMode ?? 'event');
  const [event, setEvent] = useState<string>(restored.event ?? '');
  const [eventDate, setEventDate] = useState<string>(restored.eventDate ?? '');
  const [durationWeeks, setDurationWeeks] = useState<number>(restored.durationWeeks ?? 12);
  const [goal, setGoal] = useState<string>(restored.goal ?? '');
  const [startDate, setStartDate] = useState<Date>(
    restored.startDate ? new Date(restored.startDate + 'T00:00:00') : getNextMonday(),
  );
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);

  const canProceed = name.trim().length > 0;
  const eventWeeks = goalMode === 'event' ? weeksUntil(eventDate) : null;
  const eventDateObj = parseISODate(eventDate);

  const shiftDate = (days: number) => {
    setStartDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };

  const handleNext = () => {
    navigation.navigate('CreateProgramPhases', {
      name: name.trim(),
      sport: sport.trim(),
      goalMode,
      event: event.trim(),
      eventDate,
      durationWeeks,
      goal: goal.trim(),
      startDate: formatDate(startDate),
      phases: route.params?.phases ?? null,
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        <KineticHeader
          eyebrow="Program Builder"
          title="Shape the basics"
          subtitle="Set the sport, target, and kickoff date before we build the weekly structure."
          style={styles.header}
        />
        <StepIndicator current={1} total={4} />

        <KineticPanel>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Program Name *</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="e.g. Marathon Training Plan"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Sport</Text>
          <View style={styles.chipRow}>
            {SPORT_LABELS.map(s => {
              const isOther = s === 'Other';
              const active = isOther ? customSport : !customSport && sport === s;
              return (
                <Pressable
                  key={s}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    active && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => {
                    if (isOther) {
                      setCustomSport(prev => !prev);
                      setSport('');
                    } else {
                      setCustomSport(false);
                      setSport(active ? '' : s);
                    }
                  }}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary }, active && styles.chipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {customSport && (
            <TextInput
              style={[styles.textInput, styles.textInputCompact, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border, marginTop: 10 }]}
              placeholder="Specify sport (e.g. climbing)"
              placeholderTextColor={colors.textSecondary}
              value={sport}
              onChangeText={setSport}
            />
          )}
        </KineticPanel>

        <KineticPanel style={styles.panelGap}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 0 }]}>Target</Text>
          <View style={styles.modeRow}>
            {([
              ['event', 'Race / Event'],
              ['duration', 'Open Duration'],
            ] as [GoalMode, string][]).map(([k, l]) => (
              <Pressable
                key={k}
                style={[
                  styles.modeButton,
                  { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  goalMode === k && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                onPress={() => setGoalMode(k)}
              >
                <Text style={[styles.modeText, { color: colors.textSecondary }, goalMode === k && { color: colors.primary }]}>
                  {l}
                </Text>
              </Pressable>
            ))}
          </View>

          {goalMode === 'event' ? (
            <>
              <View style={[styles.chipRow, { marginTop: 12 }]}>
                {RACE_EVENTS.map(e => (
                  <Pressable
                    key={e}
                    style={[
                      styles.chipSmall,
                      { borderColor: colors.border },
                      event === e && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setEvent(event === e ? '' : e)}
                  >
                    <Text style={[styles.chipSmallText, { color: colors.textSecondary }, event === e && styles.chipTextActive]}>
                      {e}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Event Date</Text>
              <Pressable
                style={[styles.dateField, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                onPress={() => setShowEventPicker(true)}
              >
                <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                <Text
                  style={[
                    styles.dateFieldText,
                    { color: eventDateObj ? colors.textPrimary : colors.textSecondary },
                  ]}
                >
                  {eventDateObj ? formatDisplayDate(eventDateObj) : 'Select a date'}
                </Text>
                {eventDateObj && (
                  <Pressable hitSlop={10} onPress={() => setEventDate('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </Pressable>
                )}
              </Pressable>
              {eventWeeks !== null && (
                <View style={[styles.countdownPill, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                  <Text style={[styles.countdownText, { color: colors.primary }]}>
                    {eventWeeks} {eventWeeks === 1 ? 'week' : 'weeks'} until race day
                  </Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.durationRow, { marginTop: 12 }]}>
              {DURATION_PRESETS.map(w => (
                <Pressable
                  key={w}
                  style={[
                    styles.durationButton,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    durationWeeks === w && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setDurationWeeks(w)}
                >
                  <Text style={[styles.durationText, { color: colors.textPrimary }, durationWeeks === w && styles.chipTextActive]}>
                    {w}w
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Text style={[styles.subLabel, { color: colors.textSecondary }]}>Goal Description (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea, { backgroundColor: colors.inputBackground, color: colors.textPrimary, borderColor: colors.border }]}
            placeholder="Anything else Grit should know about the goal — e.g. sub-4 hour, first attempt, recovering from injury…"
            placeholderTextColor={colors.textSecondary}
            value={goal}
            onChangeText={setGoal}
            multiline
            numberOfLines={3}
          />
        </KineticPanel>

        <KineticPanel style={styles.panelGap}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 0 }]}>Start Date</Text>
          <View style={styles.dateRow}>
            <Pressable style={[styles.dateArrow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => shiftDate(-7)}>
              <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
            </Pressable>
            <Pressable
              style={[styles.dateDisplay, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              onPress={() => setShowStartPicker(true)}
            >
              <Text style={[styles.dateText, { color: colors.textPrimary }]}>{formatDisplayDate(startDate)}</Text>
            </Pressable>
            <Pressable style={[styles.dateArrow, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={() => shiftDate(7)}>
              <Ionicons name="chevron-forward" size={20} color={colors.textPrimary} />
            </Pressable>
          </View>
          <View style={styles.quickDateRow}>
            <Pressable
              style={[styles.quickDateButton, { borderColor: colors.border }]}
              onPress={() => setStartDate(getToday())}
            >
              <Ionicons name="flash-outline" size={14} color={colors.primary} />
              <Text style={[styles.quickDateText, { color: colors.primary }]}>Today</Text>
            </Pressable>
            <Pressable
              style={[styles.quickDateButton, { borderColor: colors.border }]}
              onPress={() => setStartDate(getNextMonday())}
            >
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={[styles.quickDateText, { color: colors.primary }]}>Next Monday</Text>
            </Pressable>
            <Pressable
              style={[styles.quickDateButton, { borderColor: colors.border }]}
              onPress={() => shiftDate(1)}
            >
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text style={[styles.quickDateText, { color: colors.primary }]}>+1 day</Text>
            </Pressable>
          </View>
        </KineticPanel>

        <Pressable
          style={[styles.nextButton, { backgroundColor: colors.primary }, !canProceed && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={!canProceed}
        >
          <Text style={styles.nextButtonText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFF" />
        </Pressable>
      </ScrollView>

      <DatePickerSheet
        visible={showEventPicker}
        value={eventDateObj ?? getToday()}
        title="Event date"
        minimumDate={getToday()}
        onConfirm={(d) => {
          setEventDate(formatDate(d));
          setShowEventPicker(false);
        }}
        onCancel={() => setShowEventPicker(false)}
      />
      <DatePickerSheet
        visible={showStartPicker}
        value={startDate}
        title="Start date"
        onConfirm={(d) => {
          d.setHours(0, 0, 0, 0);
          setStartDate(d);
          setShowStartPicker(false);
        }}
        onCancel={() => setShowStartPicker(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 20 },
  header: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  panelGap: { marginTop: 14 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginTop: 20,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
  },
  textInput: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: Fonts.body,
    borderWidth: 1,
  },
  textInputCompact: {
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipSmallText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  chipText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  chipTextActive: {
    color: '#FFF',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateFieldText: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.body,
  },
  countdownPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
  },
  countdownText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 6,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  durationText: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dateArrow: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dateDisplay: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  dateText: {
    fontSize: 16,
    fontFamily: Fonts.headingMedium,
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickDateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickDateText: {
    fontSize: 13,
    fontFamily: Fonts.bodySemiBold,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    paddingVertical: 16,
    marginTop: 32,
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    fontSize: 17,
    fontFamily: Fonts.headingMedium,
    color: '#FFF',
  },
});
