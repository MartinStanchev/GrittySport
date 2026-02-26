import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Colors } from '../constants/colors';
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

// --- HR Over Time Chart ---

interface HROverTimeChartProps {
  readings: HRReading[];
  maxHR: number;
}

export function HROverTimeChart({ readings, maxHR }: HROverTimeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 72;

  const chartData = useMemo(() => {
    if (readings.length < 2) return [];
    const downsampled = downsample(readings, CHART_MAX_POINTS);
    return downsampled.map((r) => ({
      value: r.bpm,
      label: '',
    }));
  }, [readings]);

  if (chartData.length < 2) return null;

  const minBpm = Math.max(40, Math.min(...chartData.map((d) => d.value)) - 10);
  const maxBpm = Math.min(220, Math.max(...chartData.map((d) => d.value)) + 10);
  const avgHR = Math.round(readings.reduce((s, r) => s + r.bpm, 0) / readings.length);
  const peakHR = Math.max(...readings.map((r) => r.bpm));

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Heart Rate</Text>
        <View style={styles.chartStatsRow}>
          <Text style={styles.chartStat}>Avg: {avgHR} bpm</Text>
          <Text style={styles.chartStat}>Max: {peakHR} bpm</Text>
        </View>
      </View>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={140}
        spacing={Math.max(1, chartWidth / chartData.length)}
        color={Colors.primary}
        thickness={2}
        hideDataPoints
        hideRules
        yAxisTextStyle={{ fontSize: 9, color: Colors.textSecondary }}
        yAxisOffset={minBpm}
        maxValue={maxBpm - minBpm}
        noOfSections={4}
        xAxisLabelsHeight={0}
        hideXAxisText
        curved
        areaChart
        startFillColor={`${Colors.primary}30`}
        endFillColor={`${Colors.primary}05`}
        isAnimated={false}
      />
      {/* Zone legend */}
      <View style={styles.zoneLegend}>
        {ZONE_LABELS.map((label, i) => (
          <View key={label} style={styles.zoneItem}>
            <View style={[styles.zoneColorDot, { backgroundColor: HR_ZONE_COLORS[(i + 1) as HRZone] }]} />
            <Text style={styles.zoneText}>{label}</Text>
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
  const chartWidth = screenWidth - 72;

  const chartData = useMemo(() => {
    const series = computePaceTimeSeries(points);
    // Cap extreme values (pace > 15 min/km is walking/stopped)
    return series
      .filter((p) => p.paceSecPerKm > 0 && p.paceSecPerKm < 900)
      .map((p) => ({
        value: Math.round(p.paceSecPerKm),
        label: '',
      }));
  }, [points]);

  if (chartData.length < 3) return null;

  const minPace = Math.max(0, Math.min(...chartData.map((d) => d.value)) - 30);
  const maxPace = Math.min(900, Math.max(...chartData.map((d) => d.value)) + 30);
  const avgPace = Math.round(chartData.reduce((s, d) => s + d.value, 0) / chartData.length);

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Pace</Text>
        <Text style={styles.chartStat}>Avg: {formatPaceSecPerKm(avgPace)} /km</Text>
      </View>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={120}
        spacing={Math.max(1, chartWidth / chartData.length)}
        color="#4CAF50"
        thickness={2}
        hideDataPoints
        hideRules
        yAxisTextStyle={{ fontSize: 9, color: Colors.textSecondary }}
        yAxisOffset={minPace}
        maxValue={maxPace - minPace}
        noOfSections={4}
        xAxisLabelsHeight={0}
        hideXAxisText
        curved
        areaChart
        startFillColor="#4CAF5030"
        endFillColor="#4CAF5005"
        isAnimated={false}
        invertYAxis
      />
    </View>
  );
}

// --- Speed Over Time Chart ---

interface SpeedOverTimeChartProps {
  points: GPSPoint[];
}

export function SpeedOverTimeChart({ points }: SpeedOverTimeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 72;

  const chartData = useMemo(() => {
    const series = computeSpeedTimeSeries(points);
    return series
      .filter((p) => p.speedKph > 0)
      .map((p) => ({
        value: Math.round(p.speedKph * 10) / 10,
        label: '',
      }));
  }, [points]);

  if (chartData.length < 3) return null;

  const maxSpeed = Math.max(...chartData.map((d) => d.value)) + 5;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Speed</Text>
        <Text style={styles.chartStat}>
          Avg: {(chartData.reduce((s, d) => s + d.value, 0) / chartData.length).toFixed(1)} km/h
        </Text>
      </View>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={120}
        spacing={Math.max(1, chartWidth / chartData.length)}
        color="#2196F3"
        thickness={2}
        hideDataPoints
        hideRules
        yAxisTextStyle={{ fontSize: 9, color: Colors.textSecondary }}
        maxValue={maxSpeed}
        noOfSections={4}
        xAxisLabelsHeight={0}
        hideXAxisText
        curved
        areaChart
        startFillColor="#2196F330"
        endFillColor="#2196F305"
        isAnimated={false}
      />
    </View>
  );
}

// --- Cadence Chart ---

interface CadenceChartProps {
  readings: CadenceReading[];
}

export function CadenceChart({ readings }: CadenceChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 72;

  const chartData = useMemo(() => {
    const downsampled = downsample(readings, CHART_MAX_POINTS);
    return downsampled.map((r) => ({
      value: r.spm,
      label: '',
    }));
  }, [readings]);

  if (chartData.length < 3) return null;

  const avgCad = Math.round(readings.reduce((s, r) => s + r.spm, 0) / readings.length);
  const maxCad = Math.max(...readings.map((r) => r.spm));
  const chartMax = maxCad + 20;

  return (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Cadence</Text>
        <View style={styles.chartStatsRow}>
          <Text style={styles.chartStat}>Avg: {avgCad} spm</Text>
          <Text style={styles.chartStat}>Max: {maxCad} spm</Text>
        </View>
      </View>
      <LineChart
        data={chartData}
        width={chartWidth}
        height={100}
        spacing={Math.max(1, chartWidth / chartData.length)}
        color="#FF9800"
        thickness={2}
        hideDataPoints
        hideRules
        yAxisTextStyle={{ fontSize: 9, color: Colors.textSecondary }}
        maxValue={chartMax}
        noOfSections={3}
        xAxisLabelsHeight={0}
        hideXAxisText
        curved
        areaChart
        startFillColor="#FF980030"
        endFillColor="#FF980005"
        isAnimated={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  chartStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chartStat: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  zoneLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 8,
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
    color: Colors.textSecondary,
  },
});
