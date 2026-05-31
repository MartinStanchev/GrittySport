import type { Scene } from '../types';
import type { ExerciseLog } from '../../contexts/WorkoutContext';
import type { HRReading } from '../../types/gps';

const exercises: ExerciseLog[] = [
  {
    name: 'Bench Press',
    targetSets: 4,
    targetReps: '5',
    targetWeight: '80kg',
    targetRpe: '8',
    restSeconds: 120,
    sets: [
      { reps: '5', weight: '80', rpe: '7', completed: true },
      { reps: '5', weight: '80', rpe: '8', completed: true },
      { reps: '', weight: '80', rpe: '', completed: false },
      { reps: '', weight: '80', rpe: '', completed: false },
    ],
  },
  {
    name: 'Barbell Row',
    targetSets: 3,
    targetReps: '8',
    targetWeight: '60kg',
    restSeconds: 90,
    sets: [{ reps: '', weight: '60', rpe: '', completed: false }],
  },
];

// HR recovers during rest then climbs as the lifter re-racks for the next set —
// the rise is what trips set detection and highlights set 3.
const base = Date.parse('2026-05-30T17:24:00Z');
const bpmCurve = [138, 129, 121, 114, 108, 104, 101, 100, 102, 107, 115, 124, 133, 141];
const hrReadings: HRReading[] = bpmCurve.map((bpm, i) => ({
  bpm,
  timestamp: base + i * 5000,
}));

export const exampleStrengthSetDetectionScene: Scene = {
  id: 'example-strength-set-detection',
  title: 'Example · Strength set detection',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'strength-log',
  props: {
    activityName: 'Upper Body Strength',
    exercises,
    highlight: { exIdx: 0, setIdx: 2, firedAt: base + 13 * 5000 },
    hrReadings,
    maxHR: 190,
  },
};
