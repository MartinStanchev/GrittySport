import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { BeatScene } from './beats/BeatScene';
import type { Beat } from './beats/types';
import { ReelAudio, type MusicProps } from './ReelAudio';
import { SafeZoneOverlay, type SafeZone } from './safeZones';
import { transitionPresentation, type TransitionType, type MotionType } from './presets';

export type StoryReelProps = {
  beats: Beat[];
  theme: 'light' | 'dark';
  transitionFrames: number;
  transition: TransitionType;
  motion: MotionType;
  captionPreset: string;
  safeZone: SafeZone;
  showSafeZones: boolean;
  music?: MusicProps;
};

// Multi-beat reel: each beat (media screenshot, hook, stat, CTA, or before/after
// split) renders on the shared background and is stitched with the chosen
// transition (or hard cuts when 'none').
export const StoryReel: React.FC<StoryReelProps> = ({ beats, theme, transitionFrames, transition, motion, captionPreset, safeZone, showSafeZones, music }) => {
  const presentation = transitionPresentation(transition);
  const children = beats.flatMap((beat, i) => {
    const seq = (
      <TransitionSeries.Sequence key={`seq-${i}`} durationInFrames={beat.durationInFrames}>
        <BeatScene beat={beat} theme={theme} motion={motion} captionPreset={captionPreset} safeZone={safeZone} />
      </TransitionSeries.Sequence>
    );
    const tr =
      i < beats.length - 1 && presentation ? (
        <TransitionSeries.Transition
          key={`tr-${i}`}
          timing={linearTiming({ durationInFrames: transitionFrames })}
          presentation={presentation}
        />
      ) : null;
    return tr ? [seq, tr] : [seq];
  });
  return (
    <>
      <TransitionSeries>{children}</TransitionSeries>
      <ReelAudio music={music} />
      {showSafeZones && <SafeZoneOverlay zone={safeZone} />}
    </>
  );
};
