import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import type { ProgramAlignment } from '../types/gps';

interface ProgramAlignmentCardProps {
  data: ProgramAlignment;
}

export function ProgramAlignmentCard({ data }: ProgramAlignmentCardProps) {
  const rows: { label: string; prescribed: string; actual: string; deviationPct?: number }[] = [];

  if (data.prescribed_distance_km != null && data.actual_distance_km != null) {
    rows.push({
      label: 'Distance',
      prescribed: `${data.prescribed_distance_km.toFixed(1)} km`,
      actual: `${data.actual_distance_km.toFixed(1)} km`,
      deviationPct: data.distance_deviation_pct,
    });
  }

  if (data.prescribed_pace && data.actual_pace) {
    rows.push({
      label: 'Pace',
      prescribed: data.prescribed_pace,
      actual: data.actual_pace,
      deviationPct: data.pace_deviation_pct,
    });
  }

  if (data.prescribed_duration_min != null && data.actual_duration_min != null) {
    rows.push({
      label: 'Duration',
      prescribed: `${data.prescribed_duration_min} min`,
      actual: `${data.actual_duration_min} min`,
      deviationPct: data.duration_deviation_pct,
    });
  }

  if (rows.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prescribed vs Actual</Text>

      <View style={styles.headerRow}>
        <Text style={[styles.cell, styles.labelCell, styles.headerText]}>Metric</Text>
        <Text style={[styles.cell, styles.headerText]}>Prescribed</Text>
        <Text style={[styles.cell, styles.headerText]}>Actual</Text>
        <Text style={[styles.cell, styles.headerText]}>Diff</Text>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={styles.dataRow}>
          <Text style={[styles.cell, styles.labelCell]}>{row.label}</Text>
          <Text style={styles.cell}>{row.prescribed}</Text>
          <Text style={styles.cell}>{row.actual}</Text>
          <Text style={[styles.cell, { color: deviationColor(row.deviationPct) }]}>
            {formatDeviation(row.deviationPct)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function deviationColor(pct?: number): string {
  if (pct == null) return Colors.textSecondary;
  const abs = Math.abs(pct);
  if (abs <= 5) return '#4CAF50';   // green — met target
  if (abs <= 15) return '#FFC107';  // yellow — close
  return '#F44336';                 // red — off target
}

function formatDeviation(pct?: number): string {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
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
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E0E0E0',
    marginBottom: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F0',
  },
  cell: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  labelCell: {
    fontWeight: '600',
  },
});
