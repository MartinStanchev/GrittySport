import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

type PanelTone = 'surface' | 'alt' | 'glass' | 'accent';
type BadgeTone = 'primary' | 'secondary' | 'tertiary' | 'neutral';

interface KineticHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface KineticPanelProps {
  children: ReactNode;
  tone?: PanelTone;
  style?: StyleProp<ViewStyle>;
}

interface KineticBadgeProps {
  label: string;
  tone?: BadgeTone;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function KineticHeader({
  eyebrow,
  title,
  subtitle,
  right,
  style,
}: KineticHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, style]}>
      {eyebrow ? (
        <Text style={[styles.eyebrow, { color: colors.primary }]}>
          {eyebrow}
        </Text>
      ) : null}
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

export function KineticPanel({
  children,
  tone = 'surface',
  style,
}: KineticPanelProps) {
  const { colors } = useTheme();
  const backgroundColor =
    tone === 'glass'
      ? colors.glass
      : tone === 'alt'
        ? colors.surfaceAlt
        : tone === 'accent'
          ? colors.primaryLight
          : colors.surface;

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor,
          borderColor: tone === 'accent' ? `${colors.primary}33` : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function KineticBadge({
  label,
  tone = 'primary',
  right,
  style,
}: KineticBadgeProps) {
  const { colors } = useTheme();

  const badgeStyle =
    tone === 'secondary'
      ? { backgroundColor: `${colors.secondary}1A`, color: colors.secondary }
      : tone === 'tertiary'
        ? { backgroundColor: `${colors.tertiary}1A`, color: colors.tertiary }
        : tone === 'neutral'
          ? { backgroundColor: colors.surfaceAlt, color: colors.textSecondary }
          : { backgroundColor: colors.primaryLight, color: colors.primary };

  return (
    <View style={[styles.badge, { backgroundColor: badgeStyle.backgroundColor }, style]}>
      <Text style={[styles.badgeText, { color: badgeStyle.color }]}>{label}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    lineHeight: 34,
    fontFamily: Fonts.heading,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.body,
    marginTop: 6,
  },
  panel: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
