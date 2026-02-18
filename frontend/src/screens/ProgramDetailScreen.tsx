import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { dayAbbrev, formatPrescriptionSummary } from '../constants/activityIcons';
import { getProgram } from '../services/api';
import type { ProgramDetail } from '../services/api';
import { CriteriaEditorModal } from '../components/CriteriaEditorModal';

export default function ProgramDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { programId } = route.params;
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [criteriaModalVisible, setCriteriaModalVisible] = useState(false);

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

  useEffect(() => {
    fetchProgram();
  }, [fetchProgram]);

  const togglePhase = useCallback((phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }, []);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
    >
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={styles.programName}>{program.name}</Text>
        {program.sport && <Text style={styles.sport}>{program.sport}</Text>}
        {program.goal_description && (
          <Text style={styles.goal}>{program.goal_description}</Text>
        )}
        <Text style={styles.dates}>
          {formatDate(program.start_date)} — {formatDate(program.end_date)}
        </Text>
      </View>

      {/* Criteria Section */}
      {program.criteria.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Program Settings</Text>
            <Pressable
              style={styles.editButton}
              onPress={() => setCriteriaModalVisible(true)}
            >
              <Ionicons name="create-outline" size={16} color={Colors.primary} />
              <Text style={styles.editButtonText}>Edit Settings</Text>
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

      {/* Phases */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Training Plan</Text>
        {program.phases.map((phase) => (
          <View key={phase.id} style={styles.phaseContainer}>
            <Pressable
              style={styles.phaseHeader}
              onPress={() => togglePhase(phase.id)}
            >
              <Ionicons
                name={expandedPhases.has(phase.id) ? 'chevron-down' : 'chevron-forward'}
                size={18}
                color={Colors.textSecondary}
              />
              <Text style={styles.phaseName}>{phase.name}</Text>
              <Text style={styles.phaseWeekCount}>
                {phase.weeks.length} {phase.weeks.length === 1 ? 'week' : 'weeks'}
              </Text>
            </Pressable>

            {expandedPhases.has(phase.id) && (
              <View style={styles.weeksContainer}>
                {phase.weeks.map((week) => (
                  <View key={week.id} style={styles.weekContainer}>
                    <Text style={styles.weekLabel}>Week {week.week_number}</Text>
                    {week.activities.map((activity) => (
                      <Pressable
                        key={activity.id}
                        style={({ pressed }) => [styles.activityRow, pressed && styles.activityRowPressed]}
                        onPress={() => navigation.navigate('ActivityDetail', { activityId: activity.id })}
                      >
                        <Text style={styles.activityDay}>
                          {dayAbbrev(activity.day_of_week)}
                        </Text>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityType}>
                            {activity.activity_type}
                          </Text>
                          <Text style={styles.activityPrescription} numberOfLines={1}>
                            {formatPrescriptionSummary(activity.prescription)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                      </Pressable>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Criteria Editor Modal */}
      <CriteriaEditorModal
        visible={criteriaModalVisible}
        programId={programId}
        criteria={program.criteria}
        onClose={() => setCriteriaModalVisible(false)}
        onSaved={fetchProgram}
      />
    </ScrollView>
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
  },
  dates: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
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
    marginBottom: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editButtonText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
  },
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
  phaseContainer: {
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  phaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 8,
  },
  phaseName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  phaseWeekCount: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  weeksContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  weekContainer: {
    marginBottom: 12,
  },
  weekLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 4,
    paddingRight: 4,
    borderRadius: 6,
  },
  activityRowPressed: {
    backgroundColor: '#E8E8E8',
  },
  activityDay: {
    width: 36,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  activityContent: {
    flex: 1,
  },
  activityType: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  activityPrescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
});
