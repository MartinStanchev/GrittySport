import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { PhoneFrame } from './PhoneFrame';
import { ScreenMedia, type Media } from './ScreenMedia';
import { background, textColor, PALETTE, FONT } from './theme';

export type SingleHeroProps = {
  media: Media;
  headline: string;
  theme: 'light' | 'dark';
  durationInFrames: number;
};

// One scene in a gently floating / tilting phone on a branded gradient, with a
// headline and the GRITTY wordmark.
export const SingleHero: React.FC<SingleHeroProps> = ({ media, headline, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 30 });
  const float = Math.sin(frame / 22) * 10;
  const tilt = Math.sin(frame / 30) * 1.2;
  const phoneY = interpolate(enter, [0, 1], [80, 0]) + float;
  const phoneScale = interpolate(enter, [0, 1], [0.92, 1]);
  const headlineOpacity = interpolate(frame, [12, 32], [0, 1], { extrapolateRight: 'clamp' });

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
      <div style={{ position: 'absolute', top: 70, fontSize: 30, fontWeight: 800, color: PALETTE.accent, fontFamily: FONT, letterSpacing: 3 }}>
        GRITTY
      </div>
      <div style={{ transform: `translateY(${phoneY}px) scale(${phoneScale}) rotate(${tilt}deg)` }}>
        <PhoneFrame screenHeight={1340}>
          <ScreenMedia media={media} />
        </PhoneFrame>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 110,
          width: '82%',
          textAlign: 'center',
          opacity: headlineOpacity,
          transform: `translateY(${interpolate(headlineOpacity, [0, 1], [20, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 66, fontWeight: 800, color: textColor(theme), fontFamily: FONT, lineHeight: 1.08, letterSpacing: -1 }}>
          {headline}
        </div>
      </div>
    </AbsoluteFill>
  );
};
