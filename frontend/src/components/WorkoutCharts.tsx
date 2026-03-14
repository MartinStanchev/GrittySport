import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../contexts/ThemeContext';
import {
  downsample,
  HR_ZONE_COLORS,
  computePaceTimeSeries,
  computeSpeedTimeSeries,
  formatPaceSecPerKm,
} from '../services/gpsUtils';
import type { HRReading, CadenceReading, GPSPoint, HRZone } from '../types/gps';

const CHART_MAX_POINTS = 150;
const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;
const ZONE_COUNT = 5;

// Bright zone colors for chart background bands (~60% opacity)
const SECTION_COLORS = [
  '#F8717199', // Z5 — red
  '#FB923C99', // Z4 — orange
  '#FACC1599', // Z3 — amber
  '#4ADE8099', // Z2 — green
  '#60A5FA99', // Z1 — blue
];

// --- HR Over Time Chart ---

interface HROverTimeChartProps {
  readings: HRReading[];
  maxHR: number;
}

export function HROverTimeChart({ readings, maxHR }: HROverTimeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const chartWidth = screenWidth - 80;

  const { chartData, avgHR, peakHR } = useMemo(() => {
    if (readings.length < 2) return { chartData: [], avgHR: 0, peakHR: 0 };

    let sum = 0, max = -Infinity;
    for (const r of readings) {
      if (r.bpm > max) max = r.bpm;
      sum += r.bpm;
    }

    const chartPoints = downsample(readings, CHART_MAX_POINTS)
      .map((r) => ({ value: r.bpm, label: '' }));

    return {
      chartData: chartPoints,
      avgHR: Math.round(sum / readings.length),
      peakHR: max,
    };
  }, [readings]);

  // Chart Y range: 50% to 100% of maxHR — 5 zones of equal height (10% each)
  const chartMin = Math.round(maxHR * 0.5);
  const chartRange = maxHR - chartMin;

  const formatHRLabel = useCallback((label: string) => {
    const bpm = Math.round(parseFloat(label));
    if (bpm <= chartMin + 2 || bpm >= maxHR - 2) return '';
    return String(bpm);
  }, [chartMin, maxHR]);

  if (chartData.length < 2) return null;

  return (
    <View style={styles.chartSection}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>Heart Rate</Text>
        <View style={styles.chartStatsInline}>
          <Text style={[styles.chartStatLabel, { color: colors.textSecondary }]}>Avg </Text>
          <Text style={[styles.chartStatValue, { color: colors.textPrimary }]}>{avgHR}</Text>
          <Text style={[styles.chartStatUnit, { color: colors.textSecondary }]}> bpm</Text>
          <Text style={styles.chartStatSep}>  </Text>
          <Text style={[styles.chartStatLabel, { color: colors.textSecondary }]}>Peak </Text>
          <Text style={[styles.chartStatValue, { color: colors.textPrimary }]}>{peakHR}</Text>
          <Text style={[styles.chartStatUnit, { color: colors.textSecondary }]}> bpm</Text>
        </View>
      </View>
      <View style={styles.chartClip}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={180}
          initialSpacing={0}
          endSpacing={0}
          spacing={Math.max(1, chartWidth / Math.max(1, chartData.length - 1))}
          color="#E63946"
          thickness={2}
          hideDataPoints
          hideRules
          yAxisTextStyle={{ fontSize: 10, color: colors.textSecondary }}
          formatYLabel={formatHRLabel}
          yAxisOffset={chartMin}
          maxValue={chartRange}
          noOfSections={ZONE_COUNT}
          sectionColors={SECTION_COLORS}
          xAxisLabelsHeight={0}
          hideXAxisText
          curved
          isAnimated={false}
        />
      </View>
      <View style={styles.zoneLegend}>
        {ZONE_LABELS.map((label, i) => (
          <View key={label} style={styles.zoneItem}>
            <View style={[styles.zoneColorDot, { backgroundColor: HR_ZONE_COLORS[(i + 1) as HRZone] }]} />
            <Text style={[styles.zoneText, { color: colors.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// --- Pace Over Time Chart ---

interface PaceOverTimeChartProps {
  points: GPSPoint[];
}

export function PaceOverTimeChart({ points }: PaceOverTimeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const chartWidth = screenWidth - 80;

  const { chartData, minPace, maxPace } = useMemo(() => {
    const series = computePaceTimeSeries(points);
    let min = Infinity, max = -Infinity;
    const data = series
      .filter((p) => p.paceSecPerKm > 0 && p.paceSecPerKm < 900)
      .map((p) => {
        const v = Math.round(p.paceSecPerKm);
        if (v < min) min = v;
        if (v > max) max = v;
        return { value: v, label: '' };
      });
    return {
      chartData: data,
      minPace: Math.max(0, min === Infinity ? 0 : min - 30),
      maxPace: Math.min(900, max === -Infinity ? 900 : max + 30),
    };
  }, [points]);

  if (chartData.length < 3) return null;

  return (
    <View style={styles.chartSection}>
      <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>Pace</Text>
      <View style={styles.chartClip}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={120}
          initialSpacing={0}
          endSpacing={0}
          spacing={Math.max(1, chartWidth / Math.max(1, chartData.length - 1))}
          color="#4CAF50"
          thickness={2}
          hideDataPoints
          hideRules
          yAxisTextStyle={{ fontSize: 10, color: colors.textSecondary }}
          formatYLabel={(label) => formatPaceSecPerKm(parseInt(label, 10))}
          yAxisOffset={minPace}
          maxValue={maxPace - minPace}
          noOfSections={4}
          xAxisLabelsHeight={0}
          hideXAxisText
          curved
          areaChart
          startFillColor="#4CAF5020"
          endFillColor="#4CAF5005"
          isAnimated={false}
          invertYAxis
        />
      </View>
    </View>
  );
}

// --- Speed Over Time Chart ---

interface SpeedOverTimeChartProps {
  points: GPSPoint[];
}

export function SpeedOverTimeChart({ points }: SpeedOverTimeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const chartWidth = screenWidth - 80;

  const { chartData, maxSpeed } = useMemo(() => {
    const series = computeSpeedTimeSeries(points);
    let peak = 0;
    const data = series
      .filter((p) => p.speedKph > 0)
      .map((p) => {
        const v = Math.round(p.speedKph * 10) / 10;
        if (v > peak) peak = v;
        return { value: v, label: '' };
      });
    return { chartData: data, maxSpeed: peak + 5 };
  }, [points]);

  if (chartData.length < 3) return null;

  return (
    <View style={styles.chartSection}>
      <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>Speed</Text>
      <View style={styles.chartClip}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={120}
          initialSpacing={0}
          endSpacing={0}
          spacing={Math.max(1, chartWidth / Math.max(1, chartData.length - 1))}
          color="#2196F3"
          thickness={2}
          hideDataPoints
          hideRules
          yAxisTextStyle={{ fontSize: 10, color: colors.textSecondary }}
          maxValue={maxSpeed}
          noOfSections={4}
          xAxisLabelsHeight={0}
          hideXAxisText
          curved
          areaChart
          startFillColor="#2196F320"
          endFillColor="#2196F305"
          isAnimated={false}
        />
      </View>
    </View>
  );
}

// --- Cadence Chart ---

interface CadenceChartProps {
  readings: CadenceReading[];
}

export function CadenceChart({ readings }: CadenceChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const chartWidth = screenWidth - 80;

  const { chartData, avgCad, maxCad } = useMemo(() => {
    let sum = 0, peak = 0;
    for (const r of readings) {
      sum += r.spm;
      if (r.spm > peak) peak = r.spm;
    }
    const data = downsample(readings, CHART_MAX_POINTS)
      .map((r) => ({ value: r.spm, label: '' }));
    return {
      chartData: data,
      avgCad: readings.length > 0 ? Math.round(sum / readings.length) : 0,
      maxCad: peak,
    };
  }, [readings]);

  if (chartData.length < 3) return null;

  const chartMax = maxCad + 20;

  return (
    <View style={styles.chartSection}>
      <View style={styles.chartHeader}>
        <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>Cadence</Text>
        <View style={styles.chartStatsInline}>
          <Text style={[styles.chartStatLabel, { color: colors.textSecondary }]}>Avg </Text>
          <Text style={[styles.chartStatValue, { color: colors.textPrimary }]}>{avgCad}</Text>
          <Text style={[styles.chartStatUnit, { color: colors.textSecondary }]}> spm</Text>
          <Text style={styles.chartStatSep}>  </Text>
          <Text style={[styles.chartStatLabel, { color: colors.textSecondary }]}>Peak </Text>
          <Text style={[styles.chartStatValue, { color: colors.textPrimary }]}>{maxCad}</Text>
          <Text style={[styles.chartStatUnit, { color: colors.textSecondary }]}> spm</Text>
        </View>
      </View>
      <View style={styles.chartClip}>
        <LineChart
          data={chartData}
          width={chartWidth}
          height={100}
          initialSpacing={0}
          endSpacing={0}
          spacing={Math.max(1, chartWidth / Math.max(1, chartData.length - 1))}
          color="#FF9800"
          thickness={2}
          hideDataPoints
          hideRules
          yAxisTextStyle={{ fontSize: 10, color: colors.textSecondary }}
          maxValue={chartMax}
          noOfSections={3}
          xAxisLabelsHeight={0}
          hideXAxisText
          curved
          areaChart
          startFillColor="#FF980020"
          endFillColor="#FF980005"
          isAnimated={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chartSection: {
    marginBottom: 24,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  chartStatsInline: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  chartStatLabel: {
    fontSize: 11,
  },
  chartStatValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  chartStatUnit: {
    fontSize: 11,
  },
  chartStatSep: {
    fontSize: 11,
  },
  chartClip: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  zoneLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 10,
  },
  zoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  zoneColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  zoneText: {
    fontSize: 10,
  },
});
