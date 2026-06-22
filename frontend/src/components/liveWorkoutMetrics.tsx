import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';

// Presentational metric tiles for the live GPS workout HUD. Extracted from
// RecordGPSScreen so the marketing playground can reuse the exact same tiles
// (no drift) when staging a live-recording scene.

export function HeroMetric({
  label,
  value,
  unit,
  accent,
  colors,
  emphasized = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  colors: ThemeColors;
  emphasized?: boolean;
}) {
  return (
    <View style={[styles.heroMetric, emphasized && styles.heroMetricWide]}>
      <View style={styles.heroLabelRow}>
        <View style={[styles.heroMetricDot, { backgroundColor: accent }]} />
        <Text style={[styles.heroMetricLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <View style={styles.heroValueRow}>
        <Text
          style={[
            styles.heroMetricValue,
            emphasized ? styles.heroMetricValueLarge : styles.heroMetricValueCompact,
            { color: colors.textPrimary },
          ]}
        >
          {value}
        </Text>
        {unit && <Text style={[styles.heroMetricUnit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
    </View>
  );
}

export function SecondaryMetricCard({
  label,
  value,
  unit,
  accent,
  support,
  colors,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  support: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: colors.surfaceAlt }]}>
      <View style={styles.metricCardHeader}>
        <Text style={[styles.metricCardLabel, { color: colors.textSecondary }]}>{label}</Text>
        <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      </View>
      <View style={styles.metricCardValueRow}>
        <Text style={[styles.metricCardValue, { color: colors.textPrimary }]}>{value}</Text>
        {unit && <Text style={[styles.metricCardUnit, { color: colors.textSecondary }]}>{unit}</Text>}
      </View>
      <Text style={[styles.metricCardSupport, { color: colors.textSecondary }]} numberOfLines={1}>
        {support}
      </Text>
    </View>
  );
}

export function ControlButton({
  icon,
  label,
  accent,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent: string;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable style={[styles.controlButton, { backgroundColor: colors.surfaceAlt }]} onPress={onPress}>
      <View style={[styles.controlIcon, { backgroundColor: `${accent}20` }]}>
        <Ionicons name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.controlButtonText, { color: colors.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroMetric: {
    flex: 1,
    justifyContent: 'space-between',
  },
  heroMetricWide: {
    flex: 1.2,
  },
  heroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  heroMetricDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  heroMetricLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  heroMetricValue: {
    fontVariant: ['tabular-nums'],
  },
  heroMetricValueLarge: {
    fontSize: 32,
    fontFamily: Fonts.heading,
    letterSpacing: -0.4,
  },
  heroMetricValueCompact: {
    fontSize: 24,
    fontFamily: Fonts.heading,
    letterSpacing: -0.3,
  },
  heroMetricUnit: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  metricCard: {
    width: '48%',
    minHeight: 108,
    borderRadius: 18,
    padding: 14,
    justifyContent: 'space-between',
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricCardLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  metricAccent: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricCardValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
  },
  metricCardValue: {
    fontSize: 24,
    fontFamily: Fonts.heading,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  metricCardUnit: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
  metricCardSupport: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 4,
  },
  controlButton: {
    width: 88,
    minHeight: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  controlIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonText: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
});
