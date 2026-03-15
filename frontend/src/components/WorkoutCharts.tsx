import { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Rect, Polyline, Line, Text as SvgText } from 'react-native-svg';
import { LineChart } from 'react-native-gifted-charts';
import { useTheme } from '../contexts/ThemeContext';
import {
  downsample,
  computePaceTimeSeries,
  computeSpeedTimeSeries,
  formatPaceSecPerKm,
} from '../services/gpsUtils';
import type { HRReading, CadenceReading, GPSPoint } from '../types/gps';

const CHART_MAX_POINTS = 150;

// Zone band colors ordered Z1 → Z5 (bottom → top), ~60% opacity
const ZONE_BAND_COLORS = [
  '#60A5FA99', // Z1 — blue
  '#4ADE8099', // Z2 — green
  '#FACC1599', // Z3 — amber
  '#FB923C99', // Z4 — orange
  '#F8717199', // Z5 — red
];

// Layout constants for the HR SVG chart
const HR_PLOT_HEIGHT = 180;
const HR_PAD_TOP = 10;
const HR_PAD_BOTTOM = 20; // space for time labels
const HR_CHART_HEIGHT = HR_PLOT_HEIGHT + HR_PAD_TOP + HR_PAD_BOTTOM;
const HR_LABEL_WIDTH = 34;
const HR_RIGHT_WIDTH = 30;
const TIME_TICKS = 5;

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return `${m}:${s.toString().padStart(2, '0')}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}:${rm.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface HROverTimeChartProps {
  readings: HRReading[];
  maxHR: number;
}

export function HROverTimeChart({ readings, maxHR }: HROverTimeChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const { colors } = useTheme();
  const plotWidth = screenWidth - 32 - HR_LABEL_WIDTH - HR_RIGHT_WIDTH;

  const { downsampled, avgHR, peakHR } = useMemo(() => {
    if (readings.length < 2) return { downsampled: [] as HRReading[], avgHR: 0, peakHR: 0 };

    let sum = 0, max = -Infinity;
    for (const r of readings) {
      if (r.bpm > max) max = r.bpm;
      sum += r.bpm;
    }

    return {
      downsampled: downsample(readings, CHART_MAX_POINTS),
      avgHR: Math.round(sum / readings.length),
      peakHR: max,
    };
  }, [readings]);

  // Zone boundaries: 50%, 60%, 70%, 80%, 90%, 100% of maxHR
  const zoneBounds = useMemo(() => {
    const step = maxHR * 0.1;
    return Array.from({ length: 6 }, (_, i) => Math.round(maxHR * 0.5 + step * i));
  }, [maxHR]);

  // Compute zone percentages from raw readings
  const zonePercents = useMemo(() => {
    const counts = [0, 0, 0, 0, 0];
    for (const r of readings) {
      if (r.bpm >= zoneBounds[4]) counts[4]++;
      else if (r.bpm >= zoneBounds[3]) counts[3]++;
      else if (r.bpm >= zoneBounds[2]) counts[2]++;
      else if (r.bpm >= zoneBounds[1]) counts[1]++;
      else counts[0]++;
    }
    const total = readings.length || 1;
    return counts.map((c) => Math.round((c / total) * 100));
  }, [readings, zoneBounds]);

  const chartMin = zoneBounds[0];
  const chartMax = zoneBounds[5];
  const chartRange = chartMax - chartMin;

  const bpmToY = (bpm: number) => {
    const clamped = Math.max(chartMin, Math.min(chartMax, bpm));
    return HR_PAD_TOP + HR_PLOT_HEIGHT - ((clamped - chartMin) / chartRange) * HR_PLOT_HEIGHT;
  };

  // Total duration for time axis (derived from timestamps in ms)
  const totalDuration = useMemo(() => {
    if (readings.length < 2) return 0;
    return (readings[readings.length - 1].timestamp - readings[0].timestamp) / 1000;
  }, [readings]);

  const polylinePoints = useMemo(() => {
    if (downsampled.length < 2) return '';
    const n = downsampled.length;
    return downsampled
      .map((r, i) => {
        const x = HR_LABEL_WIDTH + (i / (n - 1)) * plotWidth;
        const y = bpmToY(r.bpm);
        return `${x},${y}`;
      })
      .join(' ');
  }, [downsampled, plotWidth, chartMin, chartRange]);

  if (downsampled.length < 2) return null;

  const svgWidth = HR_LABEL_WIDTH + plotWidth + HR_RIGHT_WIDTH;
  const startSec = 0; // chart starts at 0:00

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

      <Svg width={svgWidth} height={HR_CHART_HEIGHT} style={styles.hrSvg}>
        {/* Zone background bands */}
        {ZONE_BAND_COLORS.map((fill, i) => {
          const bandHeight = HR_PLOT_HEIGHT / 5;
          const y = HR_PAD_TOP + HR_PLOT_HEIGHT - (i + 1) * bandHeight;
          return (
            <Rect
              key={i}
              x={HR_LABEL_WIDTH}
              y={y}
              width={plotWidth}
              height={bandHeight}
              fill={fill}
            />
          );
        })}

        {/* Zone boundary lines + BPM labels on left */}
        {zoneBounds.map((bpm, i) => {
          const y = bpmToY(bpm);
          return (
            <Line
              key={`line-${i}`}
              x1={HR_LABEL_WIDTH}
              y1={y}
              x2={HR_LABEL_WIDTH + plotWidth}
              y2={y}
              stroke={colors.textSecondary}
              strokeWidth={0.5}
              opacity={0.4}
            />
          );
        })}
        {/* Y-axis: percentage labels on left, zone % on right at boundary lines */}
        {zoneBounds.map((bpm, i) => {
          const y = bpmToY(bpm);
          const pctLabel = `${50 + i * 10}%`;
          return (
            <SvgText
              key={`label-${i}`}
              x={HR_LABEL_WIDTH - 4}
              y={y + 4}
              textAnchor="end"
              fontSize={10}
              fill={colors.textSecondary}
            >
              {pctLabel}
            </SvgText>
          );
        })}
        {zonePercents.map((pct, i) => {
          if (pct === 0) return null;
          const y = bpmToY(zoneBounds[i]) ;
          return (
            <SvgText
              key={`pct-${i}`}
              x={HR_LABEL_WIDTH + plotWidth + 4}
              y={y + 4}
              textAnchor="start"
              fontSize={10}
              fontWeight="600"
              fill={colors.textSecondary}
            >
              {pct}%
            </SvgText>
          );
        })}

        {/* HR data line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke="#E63946"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* X-axis time labels */}
        {Array.from({ length: TIME_TICKS + 1 }, (_, i) => {
          const frac = i / TIME_TICKS;
          const x = HR_LABEL_WIDTH + frac * plotWidth;
          const sec = startSec + frac * totalDuration;
          return (
            <SvgText
              key={`time-${i}`}
              x={x}
              y={HR_PAD_TOP + HR_PLOT_HEIGHT + 14}
              textAnchor="middle"
              fontSize={9}
              fill={colors.textSecondary}
            >
              {formatElapsed(sec)}
            </SvgText>
          );
        })}
      </Svg>
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
  hrSvg: {
    alignSelf: 'center',
  },
});
