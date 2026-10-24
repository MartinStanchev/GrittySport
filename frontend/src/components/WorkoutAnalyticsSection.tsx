import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Fonts } from '../constants/fonts';
import { getWorkoutAnalytics } from '../services/api';
import type { WorkoutAnalytics } from '../types/gps';
import { isPremium } from '../utils/premium';
import { hasAnalyticsContent } from '../utils/workoutAnalytics';
import { PremiumStatsCard } from './PremiumStatsCard';
import { EffortScoreCard } from './EffortScoreCard';
import { CardiacEfficiencyCard } from './CardiacEfficiencyCard';
import { ProgramAlignmentCard } from './ProgramAlignmentCard';
import { PRBadge } from './PRBadge';
import { WeeklyTrendCard } from './WeeklyTrendCard';

interface Props {
  workoutId: string;
  /** Free users see a locked "Unlock with Premium" card when true (e.g. workout has GPS/HR data). */
  showUpsell: boolean;
  /** Changing this refetches analytics (e.g. after linking to a scheduled activity, which adds program alignment). */
  refreshKey?: string | null;
}

/**
 * Server-computed premium analytics for a saved workout: effort, cardiac
 * efficiency, program alignment, personal records and weekly trend.
 */
export function WorkoutAnalyticsSection({ workoutId, showUpsell, refreshKey }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const userIsPremium = isPremium(user);
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);

  useEffect(() => {
    if (!userIsPremium) return;
    let active = true;
    getWorkoutAnalytics(workoutId)
      .then((a) => { if (active) setAnalytics(a); })
      .catch(() => {});
    return () => { active = false; };
  }, [workoutId, userIsPremium, refreshKey]);

  if (!userIsPremium) {
    return showUpsell ? <PremiumStatsCard isPremium={false} title="Analytics">{null}</PremiumStatsCard> : null;
  }
  if (!analytics || !hasAnalyticsContent(analytics)) return null;

  return (
    <PremiumStatsCard isPremium title="Analytics">
      {analytics.effort_score > 0 && (
        <EffortScoreCard data={{ score: analytics.effort_score, label: analytics.effort_label }} />
      )}

      {analytics.cardiac_efficiency && (
        <CardiacEfficiencyCard data={analytics.cardiac_efficiency} />
      )}

      {analytics.program_alignment && (
        <ProgramAlignmentCard data={analytics.program_alignment} />
      )}

      {analytics.personal_records && analytics.personal_records.length > 0 && (
        <View style={styles.prSection}>
          <Text style={[styles.prSectionTitle, { color: colors.textPrimary }]}>Personal Records</Text>
          {analytics.personal_records.map((pr) => (
            <View key={pr.category} style={styles.prRow}>
              <PRBadge />
              <View style={styles.prInfo}>
                <Text style={[styles.prCategory, { color: colors.textPrimary }]}>{pr.category}</Text>
                {pr.formatted_value ? (
                  <Text style={[styles.prValue, { color: colors.textSecondary }]}>
                    {pr.formatted_value}
                    {pr.improvement_pct != null && pr.improvement_pct > 0
                      ? ` (+${pr.improvement_pct.toFixed(1)}%)`
                      : ''}
                  </Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      )}

      {analytics.weekly_trend && (
        <WeeklyTrendCard data={analytics.weekly_trend} />
      )}

      {!analytics.weekly_trend && analytics.trend && (
        <Text style={[styles.trendText, { color: colors.textSecondary }]}>
          {analytics.trend.comparison_text}
        </Text>
      )}
    </PremiumStatsCard>
  );
}

const styles = StyleSheet.create({
  prSection: {
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  prSectionTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prInfo: {
    flex: 1,
  },
  prCategory: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  prValue: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontVariant: ['tabular-nums'] as any,
    marginTop: 1,
  },
  trendText: {
    fontSize: 13,
    fontFamily: Fonts.body,
    marginTop: 8,
  },
});
