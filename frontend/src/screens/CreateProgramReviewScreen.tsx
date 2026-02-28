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
import { Colors } from '../constants/colors';
import { createProgram } from '../services/api';
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
      Alert.alert('Error', 'Failed to create program. Please try again.');
      if (__DEV__) console.error('[CreateProgram] error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <StepIndicator current={3} total={3} />

        {/* Summary header */}
        <View style={styles.summaryCard}>
          <Text style={styles.programName}>{name}</Text>
          {sport ? <Text style={styles.programSport}>{sport}</Text> : null}
          {goal ? <Text style={styles.programGoal}>{goal}</Text> : null}
          <View style={styles.summaryMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{formatDateRange(startDate, endDate)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.metaText}>{totalWeeks} weeks</Text>
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

          const orderedDays = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

          return (
            <View key={pi} style={styles.phaseCard}>
              <View style={styles.phaseHeader}>
                <Text style={styles.phaseName}>{phase.name}</Text>
                <Text style={styles.phaseDuration}>{phase.duration_weeks} weeks</Text>
              </View>
              <View style={styles.phaseActivities}>
                {orderedDays.map(day => {
                  const acts = dayActivities.get(day);
                  if (!acts || acts.length === 0) return null;
                  return (
                    <View key={day} style={styles.dayRow}>
                      <Text style={styles.dayLabel}>{DAY_NAMES[day]}</Text>
                      <View style={styles.dayActivities}>
                        {acts.map((act: any, ai: number) => (
                          <View key={ai} style={styles.activityRow}>
                            <Text style={styles.activityType}>{act.activity_type}</Text>
                            <Text style={styles.activityDetail} numberOfLines={1}>
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
      <View style={styles.footer}>
        <Pressable
          style={[styles.createButton, saving && styles.createButtonSaving]}
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
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 100 },

  // Summary
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  programName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  programSport: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 4,
  },
  programGoal: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  summaryMeta: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Phase cards
  phaseCard: {
    backgroundColor: Colors.surface,
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
    borderBottomColor: '#F0F0F0',
  },
  phaseName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  phaseDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: '#F0F0F0',
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
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
  },
  activityDetail: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: Colors.surface,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
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
