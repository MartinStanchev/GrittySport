import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import type { WeeklyTrend } from '../types/gps';

interface WeeklyTrendCardProps {
  data: WeeklyTrend;
}

function ChangeBadge({ value, inverted }: { value: number; inverted?: boolean }) {
  const { colors } = useTheme();
  const positive = inverted ? value < 0 : value >= 0;
  const color = Math.abs(value) < 3 ? colors.warning : positive ? colors.success : colors.error;
  const sign = value >= 0 ? '+' : '';

  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.badgeText, { color }]}>{sign}{value.toFixed(1)}%</Text>
    </View>
  );
}

export function WeeklyTrendCard({ data }: WeeklyTrendCardProps) {
  const { colors } = useTheme();

  const hasContent = !!(data.volume_trend || data.effort_trend || data.hr_trend);
  if (!hasContent) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Week-over-Week</Text>

      {data.volume_trend && (
        <>
          {data.volume_trend.this_week_km != null && data.volume_trend.last_week_km != null && (
            <View style={[styles.row, { borderBottomColor: colors.surfaceAlt }]}>
              <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Volume</Text>
              <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
                {data.volume_trend.this_week_km} vs {data.volume_trend.last_week_km} km
              </Text>
              {data.volume_trend.change_km_pct != null && (
                <ChangeBadge value={data.volume_trend.change_km_pct} />
              )}
            </View>
          )}
          <View style={[styles.row, { borderBottomColor: colors.surfaceAlt }]}>
            <Ionicons name="fitness-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Sessions</Text>
            <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
              {data.volume_trend.this_week_sessions} vs {data.volume_trend.last_week_sessions}
            </Text>
            <ChangeBadge value={data.volume_trend.change_session_pct} />
          </View>
        </>
      )}

      {data.effort_trend && (
        <View style={[styles.row, { borderBottomColor: colors.surfaceAlt }]}>
          <Ionicons name="flame-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>Avg Effort</Text>
          <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
            {data.effort_trend.this_week_avg_effort} vs {data.effort_trend.last_4_weeks_avg_effort}
          </Text>
          <ChangeBadge value={data.effort_trend.change_pct} />
        </View>
      )}

      {data.hr_trend && (
        <View style={[styles.row, { borderBottomColor: colors.surfaceAlt }]}>
          <Ionicons name="heart-outline" size={16} color={colors.textSecondary} />
          <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>HR at Pace</Text>
          <Text style={[styles.rowValue, { color: colors.textSecondary }]}>
            {data.hr_trend.avg_hr_at_pace_this_week} vs {data.hr_trend.avg_hr_at_pace_last_4_wks} bpm
          </Text>
          <ChangeBadge value={data.hr_trend.delta_hr} inverted />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
    width: 80,
  },
  rowValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: Fonts.body,
    fontVariant: ['tabular-nums'],
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    fontVariant: ['tabular-nums'],
  },
});
