import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TapMark } from './beats/types';

// Overlay that makes a phone-framed screenshot read as real usage: a soft pointer
// glides to each tap coordinate and a ripple pulses at the tap moment. Coordinates
// are percentages of the phone screen; rendered inside PhoneFrame over the media,
// so it inherits the screen's rounded clip.
export const TapPointer: React.FC<{ taps: TapMark[] }> = ({ taps }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!taps.length) return null;

  // Current target = the latest tap whose time has passed; before the first tap
  // the pointer rests just off its first target so the glide-in reads.
  const elapsed = frame / fps;
  const reached = taps.filter((t) => elapsed >= t.atSec);
  const target = reached[reached.length - 1] ?? taps[0];
  const prev = reached.length >= 2 ? reached[reached.length - 2] : { xPct: target.xPct + 14, yPct: target.yPct + 18, atSec: 0 };

  const targetFrame = target.atSec * fps;
  const glide = spring({ frame: frame - (targetFrame - 12), fps, config: { damping: 200 }, durationInFrames: 14 });
  const x = interpolate(glide, [0, 1], [prev.xPct, target.xPct]);
  const y = interpolate(glide, [0, 1], [prev.yPct, target.yPct]);

  // Ripple fires at the tap moment.
  const sinceTap = frame - targetFrame;
  const rippleP = sinceTap >= 0 ? interpolate(sinceTap, [0, 18], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const press = sinceTap >= 0 && sinceTap < 6 ? 0.86 : 1;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {rippleP > 0 && rippleP < 1 && (
        <div
          style={{
            position: 'absolute',
            left: `${x}%`,
            top: `${y}%`,
            width: 160,
            height: 160,
            marginLeft: -80,
            marginTop: -80,
            borderRadius: '50%',
            border: '4px solid rgba(124,92,255,0.7)',
            transform: `scale(${0.3 + rippleP * 1.1})`,
            opacity: 1 - rippleP,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          width: 78,
          height: 78,
          marginLeft: -39,
          marginTop: -39,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.32)',
          border: '3px solid rgba(255,255,255,0.85)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          transform: `scale(${press})`,
        }}
      />
    </div>
  );
};
