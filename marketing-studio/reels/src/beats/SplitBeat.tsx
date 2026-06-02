import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from '../PhoneFrame';
import { ScreenMedia, type Media } from '../ScreenMedia';
import { Caption } from '../Caption';
import { background } from '../theme';
import { resolveCaptionStyle, textColor, accentFor } from '../brandKit';
import { FONTS } from '../fonts';
import { stageLayout, usableCenterOffset, type SafeZone } from '../safeZones';
import type { SplitBeatData } from './types';

const Side: React.FC<{ media: Media; label?: string; bad?: boolean; theme: 'light' | 'dark'; enter: number; fromLeft: boolean }> = ({ media, label, bad, theme, enter, fromLeft }) => {
  const dx = interpolate(enter, [0, 1], [fromLeft ? -120 : 120, 0]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, opacity: enter, transform: `translateX(${dx}px)` }}>
      {label ? (
        <div
          style={{
            fontFamily: FONTS.body,
            fontWeight: 700,
            fontSize: 34,
            letterSpacing: 2,
            textTransform: 'uppercase',
            color: bad ? (theme === 'dark' ? 'rgba(243,241,251,0.5)' : 'rgba(26,22,38,0.45)') : accentFor(theme),
          }}
        >
          {bad ? '✕ ' : '✓ '}
          {label}
        </div>
      ) : null}
      <div style={{ filter: bad ? 'saturate(0.5) brightness(0.85)' : 'none' }}>
        <PhoneFrame screenHeight={920} bezel={14}>
          <ScreenMedia media={media} />
        </PhoneFrame>
      </div>
    </div>
  );
};

// Before/After comparison: two phones slide in from opposite edges with labels,
// over an optional caption. Great for "generic plan vs Grit's adaptive plan".
export const SplitBeat: React.FC<{ beat: SplitBeatData; theme: 'light' | 'dark'; captionPreset: string; safeZone: SafeZone }> = ({ beat, theme, captionPreset, safeZone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 22 });
  const layout = stageLayout(safeZone);
  const captionStyle = resolveCaptionStyle(captionPreset, theme);

  return (
    <AbsoluteFill style={{ background: background(theme), justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 36, alignItems: 'center', transform: `translateY(${usableCenterOffset(safeZone) - 40}px)` }}>
        <Side media={beat.left} label={beat.leftLabel} bad theme={theme} enter={enter} fromLeft />
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 64, color: textColor(theme), opacity: enter }}>→</div>
        <Side media={beat.right} label={beat.rightLabel} theme={theme} enter={enter} fromLeft={false} />
      </div>
      {beat.caption ? (
        <div style={{ position: 'absolute', bottom: layout.captionBottom, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Caption text={beat.caption} style={captionStyle} maxWidth={layout.captionMaxWidth} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
