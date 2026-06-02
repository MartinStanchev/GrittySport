import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { background } from '../theme';
import { textColor, accentFor } from '../brandKit';
import { FONTS } from '../fonts';
import { usableCenterOffset, type SafeZone } from '../safeZones';
import type { StatBeatData } from './types';

// Big animated number that counts up to `value`, with prefix/suffix and a label.
// Non-integer targets keep one decimal; integers stay whole.
function formatValue(value: number, current: number): string {
  return Number.isInteger(value) ? String(Math.round(current)) : current.toFixed(1);
}

export const StatBeat: React.FC<{ beat: StatBeatData; theme: 'light' | 'dark'; safeZone: SafeZone }> = ({ beat, theme, safeZone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const countP = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.8 }, durationInFrames: 36 });
  const current = countP * beat.value;
  const labelOpacity = interpolate(frame, [20, 38], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ background: background(theme), justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `translateY(${usableCenterOffset(safeZone)}px)`, width: '86%', textAlign: 'center' }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 240, lineHeight: 1, letterSpacing: -6, color: accentFor(theme) }}>
          {beat.prefix ?? ''}
          {formatValue(beat.value, current)}
          {beat.suffix ?? ''}
        </div>
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: 58,
            lineHeight: 1.1,
            letterSpacing: -1,
            color: textColor(theme),
            opacity: labelOpacity,
            transform: `translateY(${interpolate(labelOpacity, [0, 1], [18, 0])}px)`,
            marginTop: 24,
          }}
        >
          {beat.label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
