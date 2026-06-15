import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import type { AdherenceCounts } from '../utils/adherence';

interface AdherenceBarProps {
  counts: AdherenceCounts;
  title: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * A three-segment progress bar showing completed / skipped / to-go scheduled
 * sessions. Renders nothing when there are no counted sessions.
 */
export function AdherenceBar({ counts, title, icon = 'checkmark-done-outline' }: AdherenceBarProps) {
  const { colors } = useTheme();
  const { done, skipped, upcoming, total } = counts;

  if (total === 0) return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Ionicons name={icon} size={18} color={colors.success} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.headline, { color: colors.textSecondary }]}>
          <Text style={[styles.headlineValue, { color: colors.textPrimary }]}>{done}</Text>
          {`/${total}`}
        </Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: colors.surfaceAlt }]}>
        {done > 0 && <View style={{ flex: done, backgroundColor: colors.success }} />}
        {skipped > 0 && <View style={{ flex: skipped, backgroundColor: colors.error }} />}
        {upcoming > 0 && <View style={{ flex: upcoming }} />}
      </View>

      <View style={styles.legendRow}>
        <LegendItem color={colors.success} label="Done" value={done} colors={colors} />
        {skipped > 0 && <LegendItem color={colors.error} label="Skipped" value={skipped} colors={colors} />}
        {upcoming > 0 && <LegendItem color={colors.surfaceAlt} label="To go" value={upcoming} colors={colors} />}
      </View>
    </View>
  );
}

function LegendItem({
  color,
  label,
  value,
  colors,
}: {
  color: string;
  label: string;
  value: number;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendText, { color: colors.textSecondary }]}>
        {label} {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  headline: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  headlineValue: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  barTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
});
