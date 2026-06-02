import { MediaBeat } from './MediaBeat';
import { HookBeat } from './HookBeat';
import { StatBeat } from './StatBeat';
import { CtaBeat } from './CtaBeat';
import { SplitBeat } from './SplitBeat';
import type { Beat } from './types';
import type { SafeZone } from '../safeZones';
import type { MotionType } from '../presets';

// Renders one beat by kind on the shared branded background, so any mix of
// beats stitches seamlessly through the Story TransitionSeries.
export const BeatScene: React.FC<{
  beat: Beat;
  theme: 'light' | 'dark';
  motion: MotionType;
  captionPreset: string;
  safeZone: SafeZone;
}> = ({ beat, theme, motion, captionPreset, safeZone }) => {
  switch (beat.kind) {
    case 'hook':
      return <HookBeat beat={beat} theme={theme} safeZone={safeZone} />;
    case 'stat':
      return <StatBeat beat={beat} theme={theme} safeZone={safeZone} />;
    case 'cta':
      return <CtaBeat beat={beat} theme={theme} safeZone={safeZone} />;
    case 'split':
      return <SplitBeat beat={beat} theme={theme} captionPreset={captionPreset} safeZone={safeZone} />;
    case 'media':
      return <MediaBeat beat={beat} theme={theme} motion={motion} captionPreset={captionPreset} safeZone={safeZone} />;
    default:
      return null;
  }
};
