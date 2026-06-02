import React from 'react';
import { Audio, interpolate, staticFile, useVideoConfig } from 'remotion';

export type MusicProps = { src: string; volume?: number; startFromSec?: number };

const CLAMP = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Background music for a reel, with a short fade-in and a fade-out over the last
// 0.8s so it never cuts off abruptly. `src` is an http URL (preview) or a path
// under the Remotion public/ dir, e.g. `audio/track.mp3` (render).
export const ReelAudio: React.FC<{ music?: MusicProps }> = ({ music }) => {
  const { fps, durationInFrames } = useVideoConfig();
  if (!music?.src) return null;

  const src = music.src.startsWith('http') ? music.src : staticFile(music.src);
  const base = music.volume ?? 0.6;
  const fadeInFrames = Math.round(fps * 0.4);
  const fadeOutFrames = Math.round(fps * 0.8);

  return (
    <Audio
      src={src}
      startFrom={Math.round((music.startFromSec ?? 0) * fps)}
      volume={(f) => {
        const fadeIn = interpolate(f, [0, fadeInFrames], [0, 1], CLAMP);
        const fadeOut = interpolate(f, [durationInFrames - fadeOutFrames, durationInFrames], [1, 0], CLAMP);
        return base * fadeIn * fadeOut;
      }}
    />
  );
};
