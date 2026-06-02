import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ResolvedCaptionStyle } from './brandKit';

// Word-by-word kinetic caption. Words reveal across a window starting at
// `startFrame`; the most-recently-revealed word is "active" and emphasised per
// the preset. Timing is scripted (evenly spread over the reveal window) — no
// transcription needed because the caption text is authored, not spoken.
export const Caption: React.FC<{
  text: string;
  style: ResolvedCaptionStyle;
  startFrame?: number;
  // Window (frames) over which every word appears. Defaults to a snappy spread
  // capped so long captions don't crawl.
  revealFrames?: number;
  maxWidth: number;
}> = ({ text, style, startFrame = 6, revealFrames, maxWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;

  const revealWindow = revealFrames ?? Math.min(words.length * 7, 54);
  const perWord = revealWindow / words.length;
  const local = frame - startFrame;
  const activeIndex = Math.floor(local / perWord);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: `${Math.round(style.fontSize * 0.12)}px ${Math.round(style.fontSize * 0.24)}px`,
        maxWidth,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      {words.map((word, i) => {
        const wordStart = startFrame + i * perWord;
        const enter = spring({ frame: frame - wordStart, fps, config: { damping: 200, mass: 0.5 }, durationInFrames: 8 });
        if (enter <= 0) return null; // not revealed yet

        const isActive = i === activeIndex;
        const isPast = i < activeIndex;
        const popScale = style.highlight === 'pop' && isActive ? 1.14 : 1;
        const color =
          isActive && style.highlight !== 'none'
            ? style.activeColor
            : isPast && style.highlight === 'dim'
              ? style.dimColor
              : style.baseColor;

        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              transform: `translateY(${(1 - enter) * 18}px) scale(${enter * popScale})`,
              opacity: enter,
              color,
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              letterSpacing: style.letterSpacing,
              textTransform: style.uppercase ? 'uppercase' : 'none',
              padding: style.highlight === 'box' ? `${Math.round(style.fontSize * 0.06)}px ${Math.round(style.fontSize * 0.22)}px` : undefined,
              borderRadius: style.highlight === 'box' ? Math.round(style.fontSize * 0.22) : undefined,
              background: style.highlight === 'box' && isActive ? style.boxColor : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
