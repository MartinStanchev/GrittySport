import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, monospacedDigit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';
import type { LiveActivityStat, WorkoutActivityProps } from '../utils/liveActivityProps';

// Lock-screen banner + Dynamic Island for the workout being recorded. The 'widget'
// function is serialized into the widget extension, so everything it uses (colors,
// helpers) must be declared inside it — see https://docs.expo.dev/versions/latest/sdk/widgets/.
const WorkoutActivityLayout = (props: WorkoutActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const paused = props.pausedAtMs != null;
  // The Dynamic Island is always black; the banner follows the system color scheme.
  const islandAccent = '#cebdff';
  const bannerAccent = environment.colorScheme === 'dark' ? '#cebdff' : '#7C5CFC';
  const pausedColor = '#FFB020';
  const secondary = { type: 'hierarchical', style: 'secondary' } as const;

  // Counts up active time from timerStartMs; pauseTime freezes it during a pause.
  const clock = (size: number, color: string, maxWidth?: number) => (
    <Text
      timerInterval={{
        lower: new Date(props.timerStartMs),
        upper: new Date(props.timerStartMs + 24 * 60 * 60 * 1000),
      }}
      pauseTime={props.pausedAtMs != null ? new Date(props.pausedAtMs) : undefined}
      countsDown={false}
      modifiers={[
        font({ size, weight: 'semibold', design: 'rounded' }),
        monospacedDigit(),
        foregroundStyle(paused ? pausedColor : color),
        ...(maxWidth != null ? [frame({ maxWidth, alignment: 'leading' as const })] : []),
      ]}
    />
  );

  const valueRow = (s: LiveActivityStat, size: number, unitSize: number) => (
    <HStack spacing={2} alignment="firstTextBaseline">
      <Text modifiers={[font({ size, weight: 'semibold', design: 'rounded' }), monospacedDigit()]}>
        {s.value}
      </Text>
      <Text modifiers={[font({ size: unitSize }), foregroundStyle(secondary)]}>{s.unit}</Text>
    </HStack>
  );

  const stat = (s: LiveActivityStat, size: number) => (
    <VStack key={s.label} alignment="leading" spacing={0}>
      <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle(secondary)]}>
        {s.label.toUpperCase()}
      </Text>
      {valueRow(s, size, 12)}
    </VStack>
  );

  const pauseIcon = <Image systemName="pause.fill" color={pausedColor} size={12} />;
  const sportIcon = <Image systemName={props.icon} color={islandAccent} size={12} />;

  const header = (accent: string) => (
    <HStack spacing={6}>
      <Image systemName={props.icon} color={accent} size={14} />
      <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>{props.title}</Text>
      {props.statusLabel != null ? (
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(pausedColor)]}>
          {props.statusLabel}
        </Text>
      ) : null}
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 })]}>
        {header(bannerAccent)}
        <HStack alignment="bottom">
          {clock(34, bannerAccent)}
          <Spacer />
          <HStack spacing={16}>{props.stats.map((s) => stat(s, 20))}</HStack>
        </HStack>
      </VStack>
    ),
    compactLeading: clock(14, islandAccent, 64),
    compactTrailing: paused ? pauseIcon : props.compact != null ? valueRow(props.compact, 14, 10) : sportIcon,
    minimal: paused ? pauseIcon : sportIcon,
    expandedLeading: <VStack modifiers={[padding({ leading: 8 })]}>{header(islandAccent)}</VStack>,
    expandedTrailing: <VStack modifiers={[padding({ trailing: 8 })]}>{clock(24, islandAccent)}</VStack>,
    expandedBottom: (
      <HStack spacing={24} modifiers={[padding({ horizontal: 8 })]}>
        {props.stats.map((s) => stat(s, 22))}
        <Spacer />
      </HStack>
    ),
  };
};

export const WorkoutActivity = createLiveActivity('WorkoutActivity', WorkoutActivityLayout);
