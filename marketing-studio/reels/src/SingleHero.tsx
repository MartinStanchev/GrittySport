import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from './PhoneFrame';
import { ScreenMedia, type Media } from './ScreenMedia';
import { background } from './theme';
import { PALETTE, textColor, accentFor } from './brandKit';
import { FONTS } from './fonts';
import { ReelAudio, type MusicProps } from './ReelAudio';
import { stageLayout, SafeZoneOverlay, type SafeZone } from './safeZones';
import { motionTransform, type MotionType } from './presets';

export type SingleHeroProps = {
  media: Media;
  headline: string;
  theme: 'light' | 'dark';
  durationInFrames: number;
  motion: MotionType;
  safeZone: SafeZone;
  showSafeZones: boolean;
  music?: MusicProps;
};

// One scene in a phone on a branded gradient, with a headline and the GRITTY
// wordmark. The phone springs in, then the chosen motion preset animates it.
export const SingleHero: React.FC<SingleHeroProps> = ({ media, headline, theme, durationInFrames, motion, safeZone, showSafeZones, music }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const layout = stageLayout(safeZone);

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const enterY = interpolate(enter, [0, 1], [80, 0]);
  const enterScale = interpolate(enter, [0, 1], [0.92, 1]);
  const motionT = motionTransform(motion, frame, durationInFrames);
  const headlineOpacity = interpolate(frame, [12, 32], [0, 1], { extrapolateRight: 'clamp' });
  const screenHeight = Math.round(1340 * layout.phoneScale);

  return (
    <AbsoluteFill style={{ background: background(theme), justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          top: 280,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${PALETTE.accent}33, transparent 60%)`,
          filter: 'blur(20px)',
        }}
      />
      <div style={{ position: 'absolute', top: 70, fontSize: 30, fontWeight: 700, color: accentFor(theme), fontFamily: FONTS.display, letterSpacing: 3 }}>
        GRITTY
      </div>
      <div style={{ transform: `translateY(${layout.phoneTranslateY + enterY}px) scale(${enterScale}) ${motionT}` }}>
        <PhoneFrame screenHeight={screenHeight}>
          <ScreenMedia media={media} />
        </PhoneFrame>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: layout.captionBottom,
          width: layout.captionMaxWidth,
          textAlign: 'center',
          opacity: headlineOpacity,
          transform: `translateY(${interpolate(headlineOpacity, [0, 1], [20, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 66, fontWeight: 700, color: textColor(theme), fontFamily: FONTS.display, lineHeight: 1.08, letterSpacing: -1 }}>
          {headline}
        </div>
      </div>
      {showSafeZones && <SafeZoneOverlay zone={safeZone} />}
      <ReelAudio music={music} />
    </AbsoluteFill>
  );
};
