import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import type { ThemeColors } from '../constants/colors';
import { HeroMetric, SecondaryMetricCard, ControlButton } from '../components/liveWorkoutMetrics';
import { MarketingMapBackdrop } from './MarketingMapBackdrop';
import type { LiveWorkoutSceneProps, MetricAccent } from './types';

const noop = () => {};

// Dominant map band height (kept in sync with styles.mapSection so the initial
// route framing matches before onLayout reports the measured value).
const MAP_BAND_HEIGHT = 392;

function resolveAccent(accent: MetricAccent | undefined, colors: ThemeColors): string {
  switch (accent) {
    case 'secondary': return colors.secondary;
    case 'tertiary': return colors.tertiary;
    case 'hr': return colors.error;
    case 'muted': return colors.textSecondary;
    default: return colors.primary;
  }
}

const STATUS_LABEL: Record<LiveWorkoutSceneProps['status'], string> = {
  recording: 'Recording',
  paused: 'Auto-paused',
  idle: 'Ready',
};

// Marketing render of the live GPS recording HUD: stylized map backdrop with the
// real metric tiles (HeroMetric / SecondaryMetricCard / ControlButton) over a
// static bottom panel. Mirrors RecordGPSScreen's chrome without its live state.
export function MarketingLiveWorkout(props: LiveWorkoutSceneProps) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = props.status === 'recording' ? colors.secondary : colors.primary;
  const mapOverlay = isDark ? 'rgba(17, 17, 26, 0.78)' : 'rgba(255, 255, 255, 0.82)';
  const collapsedPillBg = isDark ? 'rgba(17, 17, 26, 0.88)' : 'rgba(255, 255, 255, 0.92)';

  // Measure the visible map band so the route is framed within it (not centered
  // behind the bottom panel). Defaults to MAP_BAND_HEIGHT until the first layout.
  const [mapHeight, setMapHeight] = useState(MAP_BAND_HEIGHT);
  const onMapLayout = (e: LayoutChangeEvent) => setMapHeight(e.nativeEvent.layout.height);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.mapSection} onLayout={onMapLayout}>
        <MarketingMapBackdrop points={props.routePoints} height={mapHeight} style={StyleSheet.absoluteFill} />

        <View style={[styles.topBar, { top: insets.top + 12 }]}>
          <View style={[styles.iconButton, { backgroundColor: mapOverlay }]}>
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </View>
          <View style={[styles.sessionBadge, { backgroundColor: mapOverlay }]}>
            <Text style={[styles.sessionTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {props.activityLabel.toUpperCase()}
            </Text>
            <View style={styles.sessionMetaRow}>
              <View style={[styles.liveDot, { backgroundColor: accent }]} />
              <Text style={[styles.sessionMetaText, { color: colors.textSecondary }]}>
                {STATUS_LABEL[props.status]}
              </Text>
            </View>
          </View>
          {props.gpsQuality && (
            <View style={[styles.qualityBadge, { backgroundColor: mapOverlay }]}>
              <Ionicons name="locate" size={14} color={colors.secondary} />
              <Text style={[styles.qualityText, { color: colors.textPrimary }]}>{props.gpsQuality}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.bottomPanel, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.panelHandle, { backgroundColor: `${colors.textSecondary}55` }]} />

        <View style={[styles.heroMetricsCard, { backgroundColor: collapsedPillBg }]}>
          <View style={styles.heroMetricsRow}>
            <HeroMetric label="Time" value={props.time} accent={accent} colors={colors} emphasized />
            <View style={styles.heroPager}>
              {props.heroMetrics.map((m, i) => (
                <HeroMetric
                  key={i}
                  label={m.label}
                  value={m.value}
                  unit={m.unit}
                  accent={resolveAccent(m.accent, colors)}
                  colors={colors}
                />
              ))}
            </View>
          </View>
        </View>

        <View style={styles.controlsDock}>
          {props.status === 'idle' ? (
            <View style={[styles.primaryControl, { backgroundColor: colors.primary }]}>
              <Ionicons name="play" size={18} color={colors.background} />
              <Text style={[styles.primaryControlText, { color: colors.background }]}>Start Workout</Text>
            </View>
          ) : props.status === 'recording' ? (
            <View style={styles.controlsRow}>
              <ControlButton icon="flag-outline" label="Lap" accent={colors.tertiary} onPress={noop} colors={colors} />
              <View style={[styles.primaryControl, styles.primaryControlCompact, { backgroundColor: colors.secondary }]}>
                <Ionicons name="pause" size={18} color={colors.background} />
                <Text style={[styles.primaryControlText, { color: colors.background }]}>Pause</Text>
              </View>
              <ControlButton icon="stop" label="Finish" accent={colors.primary} onPress={noop} colors={colors} />
            </View>
          ) : (
            <View style={styles.controlsRow}>
              <ControlButton icon="stop" label="Finish" accent={colors.primary} onPress={noop} colors={colors} />
              <View style={[styles.primaryControl, styles.primaryControlCompact, { backgroundColor: colors.primary }]}>
                <Ionicons name="play" size={18} color={colors.background} />
                <Text style={[styles.primaryControlText, { color: colors.background }]}>Resume</Text>
              </View>
              <ControlButton icon="trash-outline" label="Discard" accent={colors.error} onPress={noop} colors={colors} />
            </View>
          )}
        </View>

        <ScrollView style={styles.panelScroll} contentContainerStyle={styles.metricGrid} scrollEnabled={false}>
          {props.secondaryMetrics.map((m) => (
            <SecondaryMetricCard
              key={m.label}
              label={m.label}
              value={m.value}
              unit={m.unit}
              accent={resolveAccent(m.accent, colors)}
              support={m.support}
              colors={colors}
            />
          ))}
        </ScrollView>

        {props.sensor && (
          <View style={[styles.sensorRow, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.sensorIcon, { backgroundColor: `${colors.error}20` }]}>
              <Ionicons
                name={props.sensor.connected ? 'heart' : 'heart-outline'}
                size={15}
                color={props.sensor.connected ? colors.error : colors.textSecondary}
              />
            </View>
            <View style={styles.sensorCopy}>
              <Text style={[styles.sensorTitle, { color: colors.textPrimary }]}>Heart rate sensor</Text>
              <Text style={[styles.sensorSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {props.sensor.label}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Dominant map band (mirrors RecordGPSScreen, where the map fills the screen
  // under the HUD). Metrics flow below so a device-scroll reveals them.
  mapSection: { height: MAP_BAND_HEIGHT, overflow: 'hidden' },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionBadge: {
    minWidth: 124,
    maxWidth: 168,
    flexShrink: 1,
    marginRight: 'auto',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sessionTitle: { fontSize: 14, fontFamily: Fonts.heading, letterSpacing: 0.6 },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  sessionMetaText: { fontSize: 12, fontFamily: Fonts.bodyMedium },
  qualityBadge: {
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityText: { fontSize: 12, fontFamily: Fonts.bodySemiBold },
  bottomPanel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  panelHandle: {
    width: 52,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 14,
  },
  heroMetricsCard: { borderRadius: 28, padding: 18 },
  heroMetricsRow: { flexDirection: 'row', alignItems: 'stretch', gap: 14 },
  heroPager: { flex: 2, flexDirection: 'row', gap: 14 },
  controlsDock: { marginTop: 14 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryControl: {
    borderRadius: 24,
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryControlCompact: { flex: 1 },
  primaryControlText: { fontSize: 15, fontFamily: Fonts.heading, letterSpacing: 0.2 },
  panelScroll: { marginTop: 16 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginTop: 14,
  },
  sensorIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  sensorCopy: { flex: 1 },
  sensorTitle: { fontSize: 14, fontFamily: Fonts.bodySemiBold },
  sensorSubtitle: { fontSize: 12, fontFamily: Fonts.body, marginTop: 1 },
});
