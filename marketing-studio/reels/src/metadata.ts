import type { TransitionType } from './presets';

// Total frames of a Story reel: beats overlap by `transitionFrames` at each cut,
// except with hard cuts ('none') where there is no overlap. Shared by Root's
// calculateMetadata and the live-preview duration so they never disagree.
export function storyDurationInFrames(
  beats: { durationInFrames: number }[],
  transitionFrames: number,
  transition: TransitionType,
): number {
  const sum = beats.reduce((acc, b) => acc + b.durationInFrames, 0);
  const overlaps = transition === 'none' ? 0 : Math.max(0, beats.length - 1) * transitionFrames;
  return Math.max(1, sum - overlaps);
}
