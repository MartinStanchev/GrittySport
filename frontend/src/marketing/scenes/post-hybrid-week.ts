import type { Scene } from '../types';
import type { ScheduledActivityResponse } from '../../services/api';

// Hybrid-athlete week — the "strong AND fast" crowd: heavy lifting balanced with
// run intervals and endurance cycling in the same week, all sequenced so the hard
// days don't collide. Targets people who refuse to choose between the barbell and
// the road. Mon–Wed completed (ticks), Thu is today.
const activities: ScheduledActivityResponse[] = [
  {
    id: 'hw-mon',
    day_of_week: 1,
    date: '2026-06-15',
    activity_type: 'strength_training',
    order_index: 0,
    prescription: { intensity: 'Hard', description: 'Lower power: back squat 5×3 @ 82%, RDLs, walking lunges.' },
    linked_workout_id: 'w-hw-mon',
  },
  {
    id: 'hw-tue',
    day_of_week: 2,
    date: '2026-06-16',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '8 km', intensity: 'Hard', description: '6 × 800m @ 5K pace, 90s jog. Legs were fresh after the lift — good.' },
    linked_workout_id: 'w-hw-tue',
  },
  {
    id: 'hw-wed',
    day_of_week: 3,
    date: '2026-06-17',
    activity_type: 'cycling',
    order_index: 0,
    prescription: { distance: '45 km', intensity: 'Steady', description: 'Zone 2 endurance. Keeps the aerobic base without taxing the legs.' },
    linked_workout_id: 'w-hw-wed',
  },
  {
    id: 'hw-thu',
    day_of_week: 4,
    date: '2026-06-18',
    activity_type: 'strength_training',
    order_index: 0,
    prescription: { intensity: 'Moderate', description: 'Upper push/pull + core. Bench, weighted pull-ups, carries.' },
  },
  {
    id: 'hw-fri',
    day_of_week: 5,
    date: '2026-06-19',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '6 km', intensity: 'Easy', description: 'Recovery shuffle. Flush the legs before the weekend volume.' },
  },
  {
    id: 'hw-sat',
    day_of_week: 6,
    date: '2026-06-20',
    activity_type: 'cycling',
    order_index: 0,
    prescription: { distance: '70 km', intensity: 'Steady', description: 'Long ride. Fuel early and often — this is the big aerobic day.' },
  },
  {
    id: 'hw-sun',
    day_of_week: 0,
    date: '2026-06-21',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '16 km', intensity: 'Moderate', description: 'Long run off tired legs. Builds the engine that ties it all together.' },
  },
];

export const postHybridWeekScene: Scene = {
  id: 'post-hybrid-week',
  title: 'Post · Hybrid athlete week (lift + run + ride)',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'program-week',
  props: {
    weekMonday: '2026-06-15',
    highlightDayIdx: 3,
    activities,
  },
};
