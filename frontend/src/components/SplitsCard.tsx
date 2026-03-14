import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { formatPaceSecPerKm } from '../services/gpsUtils';
import type { SplitsAnalysis } from '../types/gps';

interface SplitsCardProps {
  data: SplitsAnalysis;
}

export function SplitsCard({ data }: SplitsCardProps) {
  const { colors } = useTheme();

  if (data.splits.length === 0) return null;

  const maxPace = Math.max(...data.splits.map((s) => s.paceSecPerKm));

  return (
    <View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Per-KM Splits</Text>

      {data.splits.map((split) => {
        const isFastest = split.km === data.fastestSplitKm;
        const isSlowest = split.km === data.slowestSplitKm;
        const barWidth = maxPace > 0 ? (split.paceSecPerKm / maxPace) * 100 : 0;
        const barColor = isFastest ? colors.success : isSlowest ? colors.error : colors.primary;

        return (
          <View key={split.km} style={styles.splitRow}>
            <Text style={[styles.kmLabel, { color: colors.textSecondary }]}>{split.km}</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor }]} />
            </View>
            <Text style={[styles.paceText, { color: barColor }]}>
              {formatPaceSecPerKm(split.paceSecPerKm)}
            </Text>
          </View>
        );
      })}

      <View style={styles.summaryRow}>
        {data.isNegativeSplit ? (
          <>
            <Ionicons name="checkmark-circle" size={16} color={colors.success} />
            <Text style={[styles.summaryText, { color: colors.success }]}>Negative split</Text>
          </>
        ) : (
          <>
            <Ionicons name="trending-up" size={16} color={colors.warning} />
            <Text style={[styles.summaryText, { color: colors.warning }]}>
              Positive split — faded {Math.abs(data.fadePct).toFixed(1)}%
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  kmLabel: {
    width: 22,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 16,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: 16,
    borderRadius: 4,
  },
  paceText: {
    width: 48,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
