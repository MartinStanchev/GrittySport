import type { Scene } from '../types';
import type { ScheduledActivityResponse } from '../../services/api';

// The "before" half of the before/after split: a rigid single-sport running plan.
// Every day is a run — it has no idea you also lift, ride, or play football on
// Sunday, so it stacks hard runs and drops a 20k long run the day before your
// match. One sport, one-size-fits-all. Monochrome on purpose (all teal).
const activities: ScheduledActivityResponse[] = [
  {
    id: 'ss-mon',
    day_of_week: 1,
    date: '2026-06-15',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '8 km', intensity: 'Easy', description: 'Easy miles at prescribed pace.' },
    linked_workout_id: 'w-ss-mon',
  },
  {
    id: 'ss-tue',
    day_of_week: 2,
    date: '2026-06-16',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '10 km', intensity: 'Hard', description: '6 × 1km threshold. Hit the splits.' },
    linked_workout_id: 'w-ss-tue',
  },
  {
    id: 'ss-wed',
    day_of_week: 3,
    date: '2026-06-17',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '8 km', intensity: 'Easy', description: 'Recovery run.' },
    linked_workout_id: 'w-ss-wed',
  },
  {
    id: 'ss-thu',
    day_of_week: 4,
    date: '2026-06-18',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '10 km', intensity: 'Hard', description: 'Hill repeats. Push the climbs.' },
  },
  {
    id: 'ss-fri',
    day_of_week: 5,
    date: '2026-06-19',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '6 km', intensity: 'Easy', description: 'Shakeout.' },
  },
  {
    id: 'ss-sat',
    day_of_week: 6,
    date: '2026-06-20',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '20 km', intensity: 'Hard', description: 'Long run. (It has no idea you play football tomorrow.)' },
  },
  {
    id: 'ss-sun',
    day_of_week: 0,
    date: '2026-06-21',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '5 km', intensity: 'Easy', description: 'Recovery jog.' },
  },
];

export const postSingleSportPlanScene: Scene = {
  id: 'post-single-sport-plan',
  title: 'Post · Single-sport plan (before half)',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'program-week',
  props: {
    weekMonday: '2026-06-15',
    highlightDayIdx: 3,
    activities,
  },
};
