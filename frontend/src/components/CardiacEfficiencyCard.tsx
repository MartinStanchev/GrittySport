import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import type { CardiacEfficiency } from '../types/gps';

interface CardiacEfficiencyCardProps {
  data: CardiacEfficiency;
}

export function CardiacEfficiencyCard({ data }: CardiacEfficiencyCardProps) {
  const { colors } = useTheme();

  const trendColor =
    data.trend === 'improving' ? colors.success
    : data.trend === 'declining' ? colors.error
    : colors.warning;

  const trendIcon =
    data.trend === 'improving' ? 'arrow-down' as const
    : data.trend === 'declining' ? 'arrow-up' as const
    : 'remove' as const;

  const absDelta = Math.abs(data.delta_hr);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="heart-outline" size={18} color={trendColor} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Cardiac Efficiency</Text>
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.deltaCircle, { borderColor: trendColor }]}>
          <Ionicons name={trendIcon} size={14} color={trendColor} />
          <Text style={[styles.deltaText, { color: trendColor }]}>{absDelta}</Text>
        </View>
        <View style={styles.metricInfo}>
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>bpm difference</Text>
          <Text style={[styles.metricDetail, { color: colors.textPrimary }]}>
            {data.current_avg_hr} bpm vs {data.historical_avg_hr} bpm avg
          </Text>
        </View>
      </View>

      <Text style={[styles.summary, { color: colors.textSecondary }]}>{data.summary}</Text>
      <Text style={[styles.sampleSize, { color: colors.textSecondary }]}>
        Based on {data.comparison_count} similar workout{data.comparison_count !== 1 ? 's' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  deltaCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  deltaText: {
    fontSize: 18,
    fontFamily: Fonts.heading,
  },
  metricInfo: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  metricDetail: {
    fontSize: 14,
    fontFamily: Fonts.bodyMedium,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  summary: {
    fontSize: 13,
    fontFamily: Fonts.body,
    lineHeight: 18,
  },
  sampleSize: {
    fontSize: 11,
    fontFamily: Fonts.body,
    marginTop: 4,
  },
});
