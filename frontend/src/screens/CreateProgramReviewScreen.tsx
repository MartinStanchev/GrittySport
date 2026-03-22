import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatActivityType, WEEK_DAYS_MON_SUN } from '../constants/activityIcons';
import { ApiError, createProgram } from '../services/api';
import { useProgram } from '../contexts/ProgramContext';
import StepIndicator from '../components/StepIndicator';
import { formatDateRange } from '../utils/dates';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function prescriptionSummary(prescription: Record<string, any>): string {
  const parts: string[] = [];
  if (prescription.distance) parts.push(prescription.distance);
  if (prescription.pace) parts.push(prescription.pace);
  if (prescription.duration) parts.push(prescription.duration);
  if (prescription.exercises?.length) parts.push(`${prescription.exercises.length} exercises`);
  if (prescription.intervals?.length) parts.push(`${prescription.intervals.length} intervals`);
  return parts.join(' · ') || 'No details';
}

interface Props {
  navigation: any;
  route: any;
}

export default function CreateProgramReviewScreen({ navigation, route }: Props) {
  const { colors } = useTheme();
  const { name, sport, goal, startDate, endDate, phases } = route.params;
  const insets = useSafeAreaInsets();
  const { notifyProgramDataChanged } = useProgram();
  const [saving, setSaving] = useState(false);

  const totalWeeks = phases.reduce((sum: number, p: any) => sum + p.duration_weeks, 0);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const result = await createProgram({
        name,
        sport,
        goal_description: goal,
        start_date: startDate,
        end_date: endDate,
        phases: phases.map((p: any, i: number) => ({
          name: p.name,
          order_index: i,
          duration_weeks: p.duration_weeks,
          template_week: p.template_week,
        })),
      });
      await notifyProgramDataChanged();
      navigation.navigate('ProgramDetail', { programId: result.id });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        Alert.alert(
          'Program Limit Reached',
          'Free accounts are limited to 1 program. Upgrade to premium for unlimited programs.',
          [
            { text: 'OK', style: 'cancel' },
            { text: 'Upgrade (Coming Soon)', onPress: () => Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!') },
          ],
        );
      } else {
        Alert.alert('Error', 'Failed to create program. Please try again.');
      }
      if (__DEV__) console.error('[CreateProgram] error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <StepIndicator current={3} total={3} />

        {/* Summary header */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
          <Text style={[styles.programName, { color: colors.textPrimary }]}>{name}</Text>
          {sport ? <Text style={[styles.programSport, { color: colors.primary }]}>{sport}</Text> : null}
          {goal ? <Text style={[styles.programGoal, { color: colors.textSecondary }]}>{goal}</Text> : null}
          <View style={[styles.summaryMeta, { borderTopColor: colors.border }]}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatDateRange(startDate, endDate)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{totalWeeks} weeks</Text>
            </View>
          </View>
        </View>

        {/* Phase cards */}
        {phases.map((phase: any, pi: number) => {
          const dayActivities = new Map<number, any[]>();
          for (const act of phase.template_week.activities) {
            const list = dayActivities.get(act.day_of_week) || [];
            list.push(act);
            dayActivities.set(act.day_of_week, list);
          }

          const orderedDays = WEEK_DAYS_MON_SUN;

          return (
            <View key={pi} style={[styles.phaseCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}>
              <View style={[styles.phaseHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.phaseName, { color: colors.textPrimary }]}>{phase.name}</Text>
                <Text style={[styles.phaseDuration, { color: colors.textSecondary, backgroundColor: colors.surfaceAlt }]}>
                  {phase.duration_weeks} weeks
                </Text>
              </View>
              <View style={styles.phaseActivities}>
                {orderedDays.map(day => {
                  const acts = dayActivities.get(day);
                  if (!acts || acts.length === 0) return null;
                  return (
                    <View key={day} style={styles.dayRow}>
                      <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>{DAY_NAMES[day]}</Text>
                      <View style={styles.dayActivities}>
                        {acts.map((act: any, ai: number) => (
                          <View key={ai} style={styles.activityRow}>
                            <Text style={[styles.activityType, { color: colors.textPrimary }]}>{formatActivityType(act.activity_type)}</Text>
                            <Text style={[styles.activityDetail, { color: colors.textSecondary }]} numberOfLines={1}>
                              {prescriptionSummary(act.prescription)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* Create button */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable
          style={[styles.createButton, { backgroundColor: colors.primary }, saving && styles.createButtonSaving]}
          onPress={handleCreate}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.createButtonText}>Create Program</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 100 },

  // Summary
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  programName: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  programSport: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  programGoal: {
    fontSize: 14,
    marginBottom: 12,
  },
  summaryMeta: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Phase cards
  phaseCard: {
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  phaseName: {
    fontSize: 16,
    fontWeight: '700',
  },
  phaseDuration: {
    fontSize: 13,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  phaseActivities: {
    padding: 12,
  },
  dayRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  dayLabel: {
    width: 40,
    fontSize: 13,
    fontWeight: '700',
    paddingTop: 2,
  },
  dayActivities: {
    flex: 1,
    gap: 4,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '600',
  },
  activityDetail: {
    flex: 1,
    fontSize: 12,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  createButtonSaving: {
    opacity: 0.7,
  },
  createButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
