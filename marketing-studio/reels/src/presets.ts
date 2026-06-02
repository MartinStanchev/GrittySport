import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';
import type { TransitionPresentation } from '@remotion/transitions';

export type TransitionType = 'slide' | 'fade' | 'wipe' | 'flip' | 'none';
export const TRANSITION_TYPES: TransitionType[] = ['slide', 'fade', 'wipe', 'flip', 'none'];

// null = hard cut (no transition element rendered).
export function transitionPresentation(t: TransitionType): TransitionPresentation<Record<string, unknown>> | null {
  switch (t) {
    case 'fade':
      return fade();
    case 'wipe':
      return wipe();
    case 'flip':
      return flip();
    case 'none':
      return null;
    case 'slide':
    default:
      return slide();
  }
}

export type MotionType = 'float' | 'kenburns' | 'tilt' | 'none';
export const MOTION_TYPES: MotionType[] = ['float', 'kenburns', 'tilt', 'none'];

// The motion-specific CSS transform for the phone, composed by callers with any
// base/enter transforms they apply.
export function motionTransform(motion: MotionType, frame: number, durationInFrames: number): string {
  switch (motion) {
    case 'float':
      return `translateY(${Math.sin(frame / 22) * 10}px)`;
    case 'tilt':
      return `rotate(${Math.sin(frame / 30) * 1.4}deg)`;
    case 'kenburns': {
      const t = durationInFrames > 0 ? Math.min(frame / durationInFrames, 1) : 0;
      return `scale(${1 + 0.08 * t})`;
    }
    case 'none':
    default:
      return '';
  }
}
