import type { Media } from '../ScreenMedia';

// A Story reel is a sequence of heterogeneous beats, all stitched by the same
// TransitionSeries on the shared branded background. `media` is a phone-framed
// screenshot/clip (the original behaviour); the rest are full-screen cards.
export type TapMark = { xPct: number; yPct: number; atSec: number };

type BaseBeat = { durationInFrames: number };

export type MediaBeatData = BaseBeat & { kind: 'media'; media: Media; caption?: string; taps?: TapMark[] };
export type HookBeatData = BaseBeat & { kind: 'hook'; text: string; kicker?: string };
export type StatBeatData = BaseBeat & { kind: 'stat'; value: number; label: string; prefix?: string; suffix?: string };
export type CtaBeatData = BaseBeat & {
  kind: 'cta';
  headline: string;
  sub?: string;
  badges?: ('appstore' | 'googleplay')[];
  qrDataUrl?: string;
};
export type SplitBeatData = BaseBeat & {
  kind: 'split';
  left: Media;
  right: Media;
  leftLabel?: string;
  rightLabel?: string;
  caption?: string;
};

export type Beat = MediaBeatData | HookBeatData | StatBeatData | CtaBeatData | SplitBeatData;

export const BEAT_KINDS = ['media', 'hook', 'stat', 'cta', 'split'] as const;
