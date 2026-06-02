import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { background } from '../theme';
import { textColor, accentFor } from '../brandKit';
import { FONTS } from '../fonts';
import { usableCenterOffset, type SafeZone } from '../safeZones';
import type { HookBeatData } from './types';

// Opening pattern-interrupt card: a small accent kicker over a big bold line that
// reveals word-by-word, with an accent underline that swipes in beneath it.
export const HookBeat: React.FC<{ beat: HookBeatData; theme: 'light' | 'dark'; safeZone: SafeZone }> = ({ beat, theme, safeZone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = beat.text.trim().split(/\s+/).filter(Boolean);
  const kickerEnter = interpolate(frame, [2, 16], [0, 1], { extrapolateRight: 'clamp' });
  const underline = spring({ frame: frame - (8 + words.length * 4), fps, config: { damping: 200 }, durationInFrames: 18 });

  return (
    <AbsoluteFill style={{ background: background(theme), justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ transform: `translateY(${usableCenterOffset(safeZone)}px)`, width: '82%', textAlign: 'center' }}>
        {beat.kicker ? (
          <div
            style={{
              fontFamily: FONTS.body,
              fontWeight: 700,
              fontSize: 30,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: accentFor(theme),
              opacity: kickerEnter,
              transform: `translateY(${interpolate(kickerEnter, [0, 1], [16, 0])}px)`,
              marginBottom: 28,
            }}
          >
            {beat.kicker}
          </div>
        ) : null}
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 96, lineHeight: 1.04, letterSpacing: -2, color: textColor(theme), display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 24px' }}>
          {words.map((word, i) => {
            const enter = spring({ frame: frame - (8 + i * 4), fps, config: { damping: 200, mass: 0.6 }, durationInFrames: 12 });
            return (
              <span key={i} style={{ display: 'inline-block', opacity: enter, transform: `translateY(${(1 - enter) * 26}px)` }}>
                {word}
              </span>
            );
          })}
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 6,
            margin: '36px auto 0',
            width: `${Math.round(underline * 42)}%`,
            background: accentFor(theme),
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
