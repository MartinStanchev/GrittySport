import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import type { ProgramAlignment } from '../types/gps';

interface ProgramAlignmentCardProps {
  data: ProgramAlignment;
}

export function ProgramAlignmentCard({ data }: ProgramAlignmentCardProps) {
  const { colors } = useTheme();
  const rows: { label: string; prescribed: string; actual: string; deviationPct?: number }[] = [];

  if (data.prescribed_distance_km != null && data.actual_distance_km != null) {
    rows.push({
      label: 'Distance',
      prescribed: `${data.prescribed_distance_km.toFixed(2)} km`,
      actual: `${data.actual_distance_km.toFixed(2)} km`,
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
      <Text style={[styles.title, { color: colors.textPrimary }]}>Prescribed vs Actual</Text>

      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <Text style={[styles.cell, styles.labelCell, styles.headerText, { color: colors.textSecondary }]}>Metric</Text>
        <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Prescribed</Text>
        <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Actual</Text>
        <Text style={[styles.cell, styles.headerText, { color: colors.textSecondary }]}>Diff</Text>
      </View>

      {rows.map((row) => (
        <View key={row.label} style={[styles.dataRow, { borderBottomColor: colors.surfaceAlt }]}>
          <Text style={[styles.cell, styles.labelCell, { color: colors.textPrimary }]}>{row.label}</Text>
          <Text style={[styles.cell, { color: colors.textPrimary }]}>{row.prescribed}</Text>
          <Text style={[styles.cell, { color: colors.textPrimary }]}>{row.actual}</Text>
          <Text style={[styles.cell, { color: deviationColor(row.deviationPct, colors) }]}>
            {formatDeviation(row.deviationPct)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function deviationColor(pct: number | undefined, colors: { success: string; warning: string; error: string; textSecondary: string }): string {
  if (pct == null) return colors.textSecondary;
  const abs = Math.abs(pct);
  if (abs <= 5) return colors.success;
  if (abs <= 15) return colors.warning;
  return colors.error;
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
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  headerText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cell: {
    flex: 1,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  labelCell: {
    fontWeight: '600',
  },
});
