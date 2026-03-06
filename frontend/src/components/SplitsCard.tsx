import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { formatPaceSecPerKm } from '../services/gpsUtils';
import type { SplitsAnalysis } from '../types/gps';

interface SplitsCardProps {
  data: SplitsAnalysis;
}

export function SplitsCard({ data }: SplitsCardProps) {
  if (data.splits.length === 0) return null;

  const maxPace = Math.max(...data.splits.map((s) => s.paceSecPerKm));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Per-KM Splits</Text>

      {data.splits.map((split) => {
        const isFastest = split.km === data.fastestSplitKm;
        const isSlowest = split.km === data.slowestSplitKm;
        const barWidth = maxPace > 0 ? (split.paceSecPerKm / maxPace) * 100 : 0;
        const barColor = isFastest ? '#4CAF50' : isSlowest ? '#F44336' : Colors.primary;

        return (
          <View key={split.km} style={styles.splitRow}>
            <Text style={styles.kmLabel}>{split.km}</Text>
            <View style={styles.barTrack}>
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
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={[styles.summaryText, { color: '#4CAF50' }]}>Negative split</Text>
          </>
        ) : (
          <>
            <Ionicons name="trending-up" size={16} color="#FF9800" />
            <Text style={[styles.summaryText, { color: '#FF9800' }]}>
              Positive split — faded {Math.abs(data.fadePct).toFixed(1)}%
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 16,
    backgroundColor: '#F0F0F0',
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
