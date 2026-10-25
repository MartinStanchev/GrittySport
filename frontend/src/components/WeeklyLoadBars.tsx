import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { formatDistanceM, formatDurationSec, formatRange } from '../utils/prescription';
import type { WeekLoad } from './ProgramProposalCard';

const BAR_AREA_HEIGHT = 44;

/**
 * Mini bar chart of a phase's planned weekly volume. Uses distance when the
 * phase has any, otherwise duration (e.g. strength-only phases). Deload
 * weeks are drawn in the accent color.
 */
export function WeeklyLoadBars({ weeks }: { weeks: WeekLoad[] }) {
  const { colors } = useTheme();
  const byDistance = weeks.some((w) => w.distance_m > 0);
  const values = weeks.map((w) => (byDistance ? w.distance_m : w.duration_sec));
  const peak = Math.max(0, ...values);
  if (peak === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>WEEKLY VOLUME</Text>
        <Text style={[styles.range, { color: colors.textPrimary }]}>
          {formatRange(values, byDistance ? formatDistanceM : formatDurationSec)}
        </Text>
      </View>
      <View style={[styles.bars, { height: BAR_AREA_HEIGHT }]}>
        {weeks.map((w, i) => (
          <View
            key={w.week}
            style={[
              styles.bar,
              {
                height: Math.max(2, (values[i] / peak) * BAR_AREA_HEIGHT),
                backgroundColor: w.deload ? colors.tertiary : colors.primary,
                opacity: w.deload ? 0.8 : 0.35 + 0.65 * (values[i] / peak),
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>W1</Text>
        <Text style={[styles.axisLabel, { color: colors.textSecondary }]}>W{weeks.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
  },
  range: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    flex: 1,
    borderRadius: 3,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodyMedium,
  },
});
