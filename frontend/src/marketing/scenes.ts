import type { Scene } from './types';
import { exampleEditProposalScene } from './scenes/example-edit-proposal';
import { exampleMissedWorkoutCheckinScene } from './scenes/example-missed-workout-checkin';
import { exampleMissedWorkoutLockscreenScene } from './scenes/example-missed-workout-lockscreen';
import { exampleMultiSportWeekScene } from './scenes/example-multi-sport-week';
import { examplePostWorkoutReviewScene } from './scenes/example-post-workout-review';
import { exampleStrengthSetDetectionScene } from './scenes/example-strength-set-detection';
import { exampleProgramProposalScene } from './scenes/example-program-proposal';
import { exampleSetReminderScene } from './scenes/example-set-reminder';
import { sanityCheckScene } from './scenes/sanity-check';

// Registry. Add one import + one entry per new scene file in scenes/.
export const SCENES: Scene[] = [
  sanityCheckScene,
  exampleProgramProposalScene,
  exampleEditProposalScene,
  exampleMissedWorkoutCheckinScene,
  exampleMissedWorkoutLockscreenScene,
  exampleMultiSportWeekScene,
  examplePostWorkoutReviewScene,
  exampleStrengthSetDetectionScene,
  exampleSetReminderScene,
];

export function findScene(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

export function groupScenes(): [string, Scene[]][] {
  const map = new Map<string, Scene[]>();
  for (const s of SCENES) {
    const arr = map.get(s.group) ?? [];
    arr.push(s);
    map.set(s.group, arr);
  }
  return [...map.entries()];
}
