import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { PhoneFrame } from '../PhoneFrame';
import { ScreenMedia } from '../ScreenMedia';
import { Caption } from '../Caption';
import { TapPointer } from '../TapPointer';
import { background } from '../theme';
import { PALETTE, resolveCaptionStyle } from '../brandKit';
import { stageLayout, type SafeZone } from '../safeZones';
import { motionTransform, type MotionType } from '../presets';
import type { MediaBeatData } from './types';

// A phone-framed screenshot/clip with a kinetic caption and optional tap overlay.
export const MediaBeat: React.FC<{
  beat: MediaBeatData;
  theme: 'light' | 'dark';
  motion: MotionType;
  captionPreset: string;
  safeZone: SafeZone;
}> = ({ beat, theme, motion, captionPreset, safeZone }) => {
  const frame = useCurrentFrame();
  const layout = stageLayout(safeZone);
  const captionStyle = resolveCaptionStyle(captionPreset, theme);
  const motionT = motionTransform(motion, frame, beat.durationInFrames);
  const screenHeight = Math.round(1300 * layout.phoneScale);

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
      <div style={{ transform: `translateY(${layout.phoneTranslateY}px) ${motionT}` }}>
        <PhoneFrame screenHeight={screenHeight}>
          <ScreenMedia media={beat.media} />
          {beat.taps?.length ? <TapPointer taps={beat.taps} /> : null}
        </PhoneFrame>
      </div>
      {beat.caption ? (
        <div style={{ position: 'absolute', bottom: layout.captionBottom, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <Caption text={beat.caption} style={captionStyle} maxWidth={layout.captionMaxWidth} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
