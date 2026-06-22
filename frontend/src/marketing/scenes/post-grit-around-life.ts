import type { Scene } from '../types';
import type { ScheduledActivityResponse } from '../../services/api';

// The "after" half of the before/after split: the same person's week, but Grit
// knows about everything they do and sequences around it. The hard run lands on
// fresh legs (Mon), strength is placed so leg-heavy work never sits right before a
// run or the Sunday match, and the weekend is kept light for football.
const activities: ScheduledActivityResponse[] = [
  {
    id: 'gal-mon',
    day_of_week: 1,
    date: '2026-06-15',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '10 km', intensity: 'Hard', description: '6 × 1km threshold — on fresh legs, so the quality is real.' },
    linked_workout_id: 'w-gal-mon',
  },
  {
    id: 'gal-tue',
    day_of_week: 2,
    date: '2026-06-16',
    activity_type: 'strength_training',
    order_index: 0,
    prescription: { intensity: 'Moderate', description: 'Upper push/pull — legs recover from yesterday’s run.' },
    linked_workout_id: 'w-gal-tue',
  },
  {
    id: 'gal-wed',
    day_of_week: 3,
    date: '2026-06-17',
    activity_type: 'cycling',
    order_index: 0,
    prescription: { distance: '45 km', intensity: 'Steady', description: 'Zone 2 endurance. Aerobic work without frying the legs.' },
    linked_workout_id: 'w-gal-wed',
  },
  {
    id: 'gal-thu',
    day_of_week: 4,
    date: '2026-06-18',
    activity_type: 'strength_training',
    order_index: 0,
    prescription: { intensity: 'Hard', description: 'Lower power — placed mid-week, well clear of Sunday’s match.' },
  },
  {
    id: 'gal-fri',
    day_of_week: 5,
    date: '2026-06-19',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '6 km', intensity: 'Easy', description: 'Easy shakeout. Nothing heavy this close to the weekend.' },
  },
  {
    id: 'gal-sat',
    day_of_week: 6,
    date: '2026-06-20',
    activity_type: 'mobility',
    order_index: 0,
    prescription: { duration: '20 min', intensity: 'Easy', description: 'Light mobility only — save the legs for tomorrow.' },
  },
  {
    id: 'gal-sun',
    day_of_week: 0,
    date: '2026-06-21',
    activity_type: 'football',
    order_index: 0,
    prescription: { duration: '90 min', intensity: 'Hard', description: '5-a-side match. Grit kept the weekend light so you arrive fresh.' },
  },
];

export const postGritAroundLifeScene: Scene = {
  id: 'post-grit-around-life',
  title: 'Post · Grit plans around your life (after half)',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'program-week',
  props: {
    weekMonday: '2026-06-15',
    highlightDayIdx: 3,
    activities,
  },
};
