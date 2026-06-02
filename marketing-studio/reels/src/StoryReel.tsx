import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { PhoneFrame } from './PhoneFrame';
import { ScreenMedia, type Media } from './ScreenMedia';
import { background, textColor, PALETTE, FONT } from './theme';
import { transitionPresentation, motionTransform, type TransitionType, type MotionType } from './presets';

export type Beat = { media: Media; caption: string; durationInFrames: number };
export type StoryReelProps = {
  beats: Beat[];
  theme: 'light' | 'dark';
  transitionFrames: number;
  transition: TransitionType;
  motion: MotionType;
};

const BeatScene: React.FC<{ beat: Beat; theme: 'light' | 'dark'; motion: MotionType }> = ({ beat, theme, motion }) => {
  const frame = useCurrentFrame();
  const cap = interpolate(frame, [6, 20], [0, 1], { extrapolateRight: 'clamp' });
  const motionT = motionTransform(motion, frame, beat.durationInFrames);
  return (
    <AbsoluteFill style={{ background: background(theme), justifyContent: 'center', alignItems: 'center' }}>
      <div
        style={{
          position: 'absolute',
          width: 820,
          height: 820,
          top: 240,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${PALETTE.accent}30, transparent 60%)`,
          filter: 'blur(20px)',
        }}
      />
      <div style={{ transform: `translateY(-46px) ${motionT}` }}>
        <PhoneFrame screenHeight={1300}>
          <ScreenMedia media={beat.media} />
        </PhoneFrame>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 104,
          width: '84%',
          textAlign: 'center',
          opacity: cap,
          transform: `translateY(${interpolate(cap, [0, 1], [22, 0])}px)`,
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 800, color: textColor(theme), fontFamily: FONT, lineHeight: 1.12, letterSpacing: -0.5 }}>
          {beat.caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Multi-beat reel: each beat is a phone-framed scene with a caption; beats are
// stitched with the chosen transition (or hard cuts when 'none').
export const StoryReel: React.FC<StoryReelProps> = ({ beats, theme, transitionFrames, transition, motion }) => {
  const presentation = transitionPresentation(transition);
  const children: React.ReactNode[] = [];
  beats.forEach((beat, i) => {
    children.push(
      <TransitionSeries.Sequence key={`seq-${i}`} durationInFrames={beat.durationInFrames}>
        <BeatScene beat={beat} theme={theme} motion={motion} />
      </TransitionSeries.Sequence>,
    );
    if (i < beats.length - 1 && presentation) {
      children.push(
        <TransitionSeries.Transition
          key={`tr-${i}`}
          timing={linearTiming({ durationInFrames: transitionFrames })}
          presentation={presentation}
        />,
      );
    }
  });
  return <TransitionSeries>{children}</TransitionSeries>;
};
