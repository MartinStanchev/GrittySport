import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

export interface ActivityProposal {
  day_of_week: number;
  activity_type: string;
  prescription: any;
  notes?: string;
}

export interface TemplateWeek {
  activities: ActivityProposal[];
}

export interface PhaseProposal {
  name: string;
  order_index: number;
  start_date?: string;
  end_date?: string;
  duration_weeks: number;
  template_week: TemplateWeek;
}

export interface ProgramProposalData {
  name: string;
  sport?: string;
  goal_description?: string;
  start_date: string;
  end_date?: string;
  phases: PhaseProposal[];
}

interface ProgramProposalCardProps {
  data: ProgramProposalData;
  onReview: () => void;
  disabled?: boolean;
}

export function ProgramProposalCard({ data, onReview, disabled }: ProgramProposalCardProps) {
  const { colors } = useTheme();

  const totalWeeks = data.phases.reduce((sum, p) => sum + p.duration_weeks, 0);
  const sessionsPerWeek = (data.phases[0]?.template_week?.activities || []).filter(
    (a) => a.activity_type && !a.activity_type.toLowerCase().includes('rest'),
  ).length;

  return (
    <View style={[styles.card, { backgroundColor: colors.glass, borderColor: colors.border }]}>
      <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name="barbell-outline" size={12} color={colors.primary} />
        <Text style={[styles.badgeText, { color: colors.primary }]}>PROGRAM PROPOSAL</Text>
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
        {data.name}
      </Text>

      {data.goal_description && (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
          {data.goal_description}
        </Text>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.statChip, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{totalWeeks}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>weeks</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{sessionsPerWeek}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>sessions/wk</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.statValue, { color: colors.primary }]}>{data.phases.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>phases</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.reviewButton, { backgroundColor: colors.primary }]}
        onPress={onReview}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <Ionicons name="eye-outline" size={18} color={colors.background} />
        <Text style={[styles.reviewButtonText, { color: colors.background }]}>REVIEW PROGRAM</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 4,
    borderWidth: 1,
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts.heading,
    lineHeight: 28,
  },
  description: {
    fontSize: 14,
    fontFamily: Fonts.body,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statValue: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 4,
  },
  reviewButtonText: {
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
    letterSpacing: 0.5,
  },
});
