import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { dayAbbrev } from '../constants/activityIcons';

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
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null);

  const totalWeeks = data.phases.reduce((sum, p) => sum + p.duration_weeks, 0);
  const activitiesPerWeek = data.phases[0]?.template_week?.activities?.length || 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="barbell-outline" size={20} color={Colors.primary} />
        <Text style={styles.title}>{data.name}</Text>
      </View>

      {data.sport && <Text style={styles.subtitle}>{data.sport}</Text>}
      {data.goal_description && (
        <Text style={styles.goal} numberOfLines={2}>{data.goal_description}</Text>
      )}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Duration</Text>
          <Text style={styles.metaValue}>{totalWeeks} weeks</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Phases</Text>
          <Text style={styles.metaValue}>{data.phases.length}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Days/Week</Text>
          <Text style={styles.metaValue}>{activitiesPerWeek}</Text>
        </View>
      </View>

      {data.start_date && (
        <Text style={styles.dates}>
          {formatDate(data.start_date)} — {formatDate(data.end_date)}
        </Text>
      )}

      <View style={styles.phasesContainer}>
        {data.phases.map((phase, idx) => (
          <View key={idx}>
            <TouchableOpacity
              style={styles.phaseRow}
              onPress={() => setExpandedPhase(expandedPhase === idx ? null : idx)}
            >
              <Ionicons
                name={expandedPhase === idx ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={Colors.textSecondary}
              />
              <Text style={styles.phaseName}>{phase.name}</Text>
              <Text style={styles.phaseWeeks}>{phase.duration_weeks}w</Text>
            </TouchableOpacity>

            {expandedPhase === idx && phase.template_week && (
              <View style={styles.weeksList}>
                <Text style={styles.templateLabel}>
                  Template week · repeats {phase.duration_weeks}w
                </Text>
                <View style={styles.activitiesList}>
                  {phase.template_week.activities.map((act, aIdx) => (
                    <Text key={aIdx} style={styles.activityText}>
                      {dayAbbrev(act.day_of_week)}: {act.activity_type}
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
          style={[styles.denyButton, disabled && styles.disabledButton]}
          onPress={onDeny}
          disabled={disabled}
        >
          <Text style={styles.denyText}>Request Changes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptButton, disabled && styles.disabledButton]}
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
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: Colors.textPrimary,
    flex: 1,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  goal: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  dates: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  phasesContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    color: Colors.textPrimary,
    flex: 1,
  },
  phaseWeeks: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  weeksList: {
    paddingLeft: 22,
    paddingBottom: 4,
  },
  templateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  activitiesList: {
    paddingLeft: 8,
  },
  activityText: {
    fontSize: 12,
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primary,
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
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 12,
  },
  denyText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
