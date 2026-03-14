import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../contexts/ThemeContext';
import { downsample, getHRZoneColor, HR_ZONE_COLORS } from '../services/gpsUtils';
import type { HRReading } from '../types/gps';

interface LiveHRChartProps {
  hrReadings: HRReading[];
  maxHR: number;
  startedAt: Date;
  width: number;
  height?: number;
}

const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

export default function LiveHRChart({
  hrReadings,
  maxHR,
  startedAt,
  width,
  height = 160,
}: LiveHRChartProps) {
  const { colors } = useTheme();
  const chartData = useMemo(() => {
    if (hrReadings.length < 2) return [];
    const downsampled = downsample(hrReadings, 80);
    return downsampled.map((r) => ({
      value: r.bpm,
      label: '',
      dataPointColor: getHRZoneColor(r.bpm, maxHR),
    }));
  }, [hrReadings, maxHR]);

  const currentHR = hrReadings.length > 0 ? hrReadings[hrReadings.length - 1].bpm : null;
  const avgHR =
    hrReadings.length > 0
      ? Math.round(hrReadings.reduce((s, r) => s + r.bpm, 0) / hrReadings.length)
      : null;

  if (chartData.length < 2) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Connect an HR monitor to see your heart rate graph</Text>
      </View>
    );
  }

  const minBpm = Math.max(40, Math.min(...chartData.map((d) => d.value)) - 10);
  const maxBpm = Math.min(220, Math.max(...chartData.map((d) => d.value)) + 10);
  const chartWidth = Math.max(width - 56, 100);

  return (
    <View style={[styles.container, { width }]}>
      {/* HR stats overlay */}
      <View style={styles.statsRow}>
        {currentHR && (
          <View style={styles.statBadge}>
            <Text style={[styles.statValue, { color: getHRZoneColor(currentHR, maxHR) }]}>
              {currentHR}
            </Text>
            <Text style={styles.statLabel}>bpm</Text>
          </View>
        )}
        {avgHR && (
          <View style={styles.statBadge}>
            <Text style={styles.statValue}>{avgHR}</Text>
            <Text style={styles.statLabel}>avg</Text>
          </View>
        )}
      </View>

      <LineChart
        data={chartData}
        width={chartWidth}
        height={height - 40}
        spacing={Math.max(1, chartWidth / chartData.length)}
        color={colors.primary}
        thickness={2}
        hideDataPoints
        hideRules
        yAxisTextStyle={{ fontSize: 9, color: colors.textSecondary }}
        yAxisOffset={minBpm}
        maxValue={maxBpm - minBpm}
        noOfSections={4}
        xAxisLabelsHeight={0}
        hideXAxisText
        curved
        areaChart
        startFillColor={`${colors.primary}30`}
        endFillColor={`${colors.primary}05`}
        isAnimated={false}
      />

      {/* Zone labels */}
      <View style={styles.zoneRow}>
        {ZONE_LABELS.map((label, i) => (
          <View key={label} style={[styles.zoneDot, { backgroundColor: HR_ZONE_COLORS[(i + 1) as 1 | 2 | 3 | 4 | 5] }]}>
            <Text style={styles.zoneLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
    alignSelf: 'flex-end',
    paddingRight: 4,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 10,
  },
  zoneRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  zoneDot: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  zoneLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFF',
  },
});
