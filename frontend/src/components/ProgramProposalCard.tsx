import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { dayAbbrev, formatActivityType } from '../constants/activityIcons';

interface ActivityProposal {
  day_of_week: number;
  activity_type: string;
  prescription: any;
}

interface TemplateWeek {
  activities: ActivityProposal[];
}

interface PhaseProposal {
  name: string;
  order_index: number;
  start_date?: string;
  end_date?: string;
  duration_weeks: number;
  template_week: TemplateWeek;
}

interface ProgramProposalData {
  name: string;
  sport?: string;
  goal_description?: string;
  start_date: string;
  end_date?: string;
  phases: PhaseProposal[];
}

interface ProgramProposalCardProps {
  data: ProgramProposalData;
  onAccept: () => void;
  onDeny: () => void;
  disabled?: boolean;
}

export function ProgramProposalCard({ data, onAccept, onDeny, disabled }: ProgramProposalCardProps) {
  const { colors } = useTheme();
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  const totalWeeks = data.phases.reduce((sum, p) => sum + p.duration_weeks, 0);
  const activitiesPerWeek = data.phases[0]?.template_week?.activities?.length || 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name="barbell-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{data.name}</Text>
      </View>

      {data.sport && <Text style={[styles.subtitle, { color: colors.primary }]}>{data.sport}</Text>}
      {data.goal_description && (
        <Text style={[styles.goal, { color: colors.textSecondary }]} numberOfLines={2}>{data.goal_description}</Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Duration</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{totalWeeks} weeks</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Phases</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{data.phases.length}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>Days/Week</Text>
          <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{activitiesPerWeek}</Text>
        </View>
      </View>

      {data.start_date && (
        <Text style={[styles.dates, { color: colors.textSecondary }]}>
          {formatDate(data.start_date)} — {formatDate(data.end_date)}
        </Text>
      )}

      <View style={[styles.phasesContainer, { borderTopColor: colors.border }]}>
        {data.phases.map((phase, idx) => (
          <View key={idx}>
            <TouchableOpacity
              style={styles.phaseRow}
              onPress={() => setExpandedPhase(expandedPhase === idx ? null : idx)}
            >
              <Ionicons
                name={expandedPhase === idx ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={[styles.phaseName, { color: colors.textPrimary }]}>{phase.name}</Text>
              <Text style={[styles.phaseWeeks, { color: colors.textSecondary }]}>{phase.duration_weeks}w</Text>
            </TouchableOpacity>

            {expandedPhase === idx && phase.template_week && (
              <View style={styles.weeksList}>
                <Text style={[styles.templateLabel, { color: colors.textSecondary }]}>
                  Template week · repeats {phase.duration_weeks}w
                </Text>
                <View style={styles.activitiesList}>
                  {phase.template_week.activities.map((act, aIdx) => (
                    <Text key={aIdx} style={[styles.activityText, { color: colors.textSecondary }]}>
                      {dayAbbrev(act.day_of_week)}: {formatActivityType(act.activity_type)}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.denyButton, { borderColor: colors.border }, disabled && styles.disabledButton]}
          onPress={onDeny}
          disabled={disabled}
        >
          <Text style={[styles.denyText, { color: colors.textSecondary }]}>Request Changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptButton, { backgroundColor: colors.primary }, disabled && styles.disabledButton]}
          onPress={onAccept}
          disabled={disabled}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.acceptText}>Accept Program</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  goal: {
    fontSize: 13,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  dates: {
    fontSize: 12,
    marginBottom: 12,
  },
  phasesContainer: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginBottom: 12,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  phaseName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  phaseWeeks: {
    fontSize: 12,
  },
  weeksList: {
    paddingLeft: 22,
    paddingBottom: 4,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  activitiesList: {
    paddingLeft: 8,
  },
  activityText: {
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  acceptText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  denyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
  },
  denyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
