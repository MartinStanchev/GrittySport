import type { Scene } from '../types';
import type { ScheduledActivityResponse } from '../../services/api';

// Post 1 — the wedge. A real multi-sport week that no single-sport app can
// hold: weekday running + cycling + the strength scheduled *around* them, plus
// the weekend recreational sports (climbing, football) people actually live by.
// Early-week sessions are completed (green ticks = progress is tracked), today
// is mobility, and the headline weekend sports sit upcoming.
const activities: ScheduledActivityResponse[] = [
  {
    id: 'rw-mon',
    day_of_week: 1,
    date: '2026-06-15',
    activity_type: 'strength_training',
    order_index: 0,
    prescription: { intensity: 'Moderate', description: 'Lower body + core. Placed early so legs recover before Wednesday’s ride.' },
    linked_workout_id: 'w-rw-mon',
  },
  {
    id: 'rw-tue',
    day_of_week: 2,
    date: '2026-06-16',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '6 km', intensity: 'Easy', description: 'Conversational shakeout. Keep it relaxed.' },
    linked_workout_id: 'w-rw-tue',
  },
  {
    id: 'rw-wed',
    day_of_week: 3,
    date: '2026-06-17',
    activity_type: 'cycling',
    order_index: 0,
    prescription: { distance: '55 km', intensity: 'Steady', description: 'Long endurance ride. Fuel every 45 min.' },
    linked_workout_id: 'w-rw-wed',
  },
  {
    id: 'rw-thu',
    day_of_week: 4,
    date: '2026-06-18',
    activity_type: 'yoga',
    order_index: 0,
    prescription: { duration: '30 min', intensity: 'Easy', description: 'Hips + thoracic. Undo the ride.' },
  },
  {
    id: 'rw-fri',
    day_of_week: 5,
    date: '2026-06-19',
    activity_type: 'strength_training',
    order_index: 0,
    prescription: { intensity: 'Moderate', description: 'Upper push/pull. Light on the legs — you climb tomorrow.' },
  },
  {
    id: 'rw-sat',
    day_of_week: 6,
    date: '2026-06-20',
    activity_type: 'climbing',
    order_index: 0,
    prescription: { duration: '2 h', intensity: 'Hard', description: 'Bouldering session. This is the fun one — go send.' },
  },
  {
    id: 'rw-sun',
    day_of_week: 0,
    date: '2026-06-21',
    activity_type: 'football',
    order_index: 0,
    prescription: { duration: '90 min', intensity: 'Hard', description: '5-a-side match. Grit kept Friday light so you’ve got legs.' },
  },
];

export const postRealWeekScene: Scene = {
  id: 'post-real-week',
  title: 'Post 1 · The week no single-sport app can hold',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'program-week',
  props: {
    weekMonday: '2026-06-15',
    highlightDayIdx: 3,
    activities,
  },
};
