import { useCallback, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Fonts } from '../constants/fonts';
import { bleService } from '../services/bleService';

// Building blocks shared by the live recording screens (GPS and indoor), so both
// look and behave the same: hero metrics, metric cards and hold-to-activate controls.

export function HeroMetric({
  label,
  value,
  unit,
  accent,
  emphasized = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  emphasized?: boolean;
}) {
  const { colors } = useTheme();
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
}: {
  label: string;
  value: string;
  unit?: string;
  accent: string;
  support: string;
}) {
  const { colors } = useTheme();
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

/** Full-width pill for the single action outside recording, e.g. "Start Workout". */
export function PrimaryActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.primaryControl, { backgroundColor: colors.primary }]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.background} />
      <Text style={[styles.primaryControlText, { color: colors.background }]}>{label}</Text>
    </Pressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const HOLD_TO_ACTIVATE_DELAY_MS = 600;

// Recording controls double as a "second barrier" against accidental touches (the
// original incident: phone-against-body presses hit Lap then Pause mid-race). Anything
// destructive-ish requires a deliberate hold; a short tap only surfaces a toast hint so
// users learn the gesture instead of feeling like the button is broken. `onPress` and
// `onLongPress` are mutually exclusive at the RN Pressability layer — a long press never
// also fires `onPress` on release — so there's no risk of double-firing the action.
export function ControlButton({
  icon,
  label,
  accent,
  backgroundColor,
  variant = 'compact',
  holdToActivate = true,
  hintText,
  onActivate,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accent?: string;
  /** 'primary' variant only — the pill's fill color. */
  backgroundColor?: string;
  /** 'compact' (icon bubble on surfaceAlt) or 'primary' (filled pill, e.g. Pause). */
  variant?: 'compact' | 'primary';
  /** False for safe actions like Resume, which stay a plain tap. */
  holdToActivate?: boolean;
  /** Toast shown on a short tap when holdToActivate is true. */
  hintText?: string;
  onActivate: () => void;
}) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const [scale] = useState(() => new Animated.Value(1));

  const handlePressIn = useCallback(() => {
    Animated.timing(scale, { toValue: 0.94, duration: 90, useNativeDriver: true }).start();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  }, [scale]);

  const handleShortPress = useCallback(() => {
    if (hintText) showToast(hintText);
  }, [hintText, showToast]);

  const pressHandlers = holdToActivate
    ? { onPress: handleShortPress, onLongPress: onActivate, delayLongPress: HOLD_TO_ACTIVATE_DELAY_MS }
    : { onPress: onActivate };

  const dynamicStyle =
    variant === 'primary'
      ? [styles.primaryControl, styles.primaryControlCompact, { backgroundColor }]
      : [styles.controlButton, { backgroundColor: colors.surfaceAlt }];

  return (
    <AnimatedPressable
      style={[...dynamicStyle, { transform: [{ scale }] }]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...pressHandlers}
    >
      {variant === 'primary' ? (
        <>
          <Ionicons name={icon} size={18} color={colors.background} />
          <Text style={[styles.primaryControlText, { color: colors.background }]}>{label}</Text>
        </>
      ) : (
        <>
          <View style={[styles.controlIcon, { backgroundColor: `${accent}20` }]}>
            <Ionicons name={icon} size={18} color={accent} />
          </View>
          <Text style={[styles.controlButtonText, { color: colors.textPrimary }]}>{label}</Text>
        </>
      )}
    </AnimatedPressable>
  );
}

/**
 * The live controls row: Lap / Pause / Finish while recording, Finish / Resume / Discard
 * while paused.
 */
export function RecordingControls({
  paused,
  onLap,
  onPause,
  onResume,
  onFinish,
  onDiscard,
}: {
  paused: boolean;
  onLap: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const { colors } = useTheme();
  if (paused) {
    return (
      <View style={styles.controlsRow}>
        <ControlButton icon="stop" label="Finish" accent={colors.primary} onActivate={onFinish} hintText="Hold to finish" />
        <ControlButton
          variant="primary"
          holdToActivate={false}
          icon="play"
          label="Resume"
          backgroundColor={colors.primary}
          onActivate={onResume}
        />
        <ControlButton icon="trash-outline" label="Discard" accent={colors.error} onActivate={onDiscard} hintText="Hold to discard" />
      </View>
    );
  }
  return (
    <View style={styles.controlsRow}>
      <ControlButton icon="flag-outline" label="Lap" accent={colors.tertiary} onActivate={onLap} hintText="Hold to log a lap" />
      <ControlButton
        variant="primary"
        icon="pause"
        label="Pause"
        backgroundColor={colors.secondary}
        onActivate={onPause}
        hintText="Hold to pause"
      />
      <ControlButton icon="stop" label="Finish" accent={colors.primary} onActivate={onFinish} hintText="Hold to finish" />
    </View>
  );
}

// Heart-rate sensor row subtitle: connected device, in-flight reconnect, or prompt.
function hrConnectionLabel(connectedName: string | null | undefined, connectingTo: string | null): string {
  if (bleService.isConnected()) {
    return `Connected to ${connectedName ?? bleService.getDeviceName()}`;
  }
  if (connectingTo) {
    return `Connecting to ${connectingTo}…`;
  }
  return 'Connect heart rate monitor';
}

/** Tappable "Heart rate sensor" row that opens the HR sensor modal. */
export function HRSensorRow({
  deviceName,
  connectingTo,
  zoneColor,
  onPress,
}: {
  deviceName: string | null | undefined;
  connectingTo: string | null;
  zoneColor: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const connected = bleService.isConnected();
  return (
    <Pressable style={[styles.sensorRow, { backgroundColor: colors.surfaceAlt }]} onPress={onPress}>
      <View style={[styles.sensorIcon, { backgroundColor: `${zoneColor}20` }]}>
        <Ionicons
          name={connected ? 'heart' : 'heart-outline'}
          size={15}
          color={connected ? zoneColor : colors.textSecondary}
        />
      </View>
      <View style={styles.sensorCopy}>
        <Text style={[styles.sensorTitle, { color: colors.textPrimary }]}>Heart rate sensor</Text>
        <Text style={[styles.sensorSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {hrConnectionLabel(deviceName, connectingTo)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

/** Activity title with a live-state dot and status label, for the live screens' top bar. */
export function SessionBadge({
  title,
  status,
  tone,
  backgroundColor,
}: {
  title: string;
  status: string;
  tone: string;
  backgroundColor: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sessionBadge, { backgroundColor }]}>
      <Text style={[styles.sessionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
        {title.toUpperCase()}
      </Text>
      <View style={styles.sessionMetaRow}>
        <View style={[styles.liveDot, { backgroundColor: tone }]} />
        <Text style={[styles.sessionMetaText, { color: colors.textSecondary }]}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sessionBadge: {
    minWidth: 124,
    maxWidth: 168,
    flexShrink: 1,
    marginRight: 'auto',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sessionTitle: {
    fontSize: 14,
    fontFamily: Fonts.heading,
    letterSpacing: 0.6,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionMetaText: {
    fontSize: 12,
    fontFamily: Fonts.bodyMedium,
  },
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
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginTop: 14,
  },
  sensorIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sensorCopy: {
    flex: 1,
  },
  sensorTitle: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  sensorSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
    marginTop: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  primaryControl: {
    borderRadius: 24,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryControlCompact: {
    flex: 1,
  },
  primaryControlText: {
    fontSize: 15,
    fontFamily: Fonts.heading,
    letterSpacing: 0.2,
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
