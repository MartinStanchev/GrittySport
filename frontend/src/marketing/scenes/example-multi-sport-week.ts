import type { Scene } from '../types';
import type { ScheduledActivityResponse } from '../../services/api';

const activities: ScheduledActivityResponse[] = [
  {
    id: 'msw-mon',
    day_of_week: 1,
    date: '2026-06-01',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '8 km', intensity: 'Easy', description: 'Conversational pace, nose-breathing only.' },
    linked_workout_id: 'w-mon',
  },
  {
    id: 'msw-tue',
    day_of_week: 2,
    date: '2026-06-02',
    activity_type: 'strength',
    order_index: 0,
    prescription: { intensity: 'Moderate', description: 'Dryland: squats, hinges, single-leg work.' },
    linked_workout_id: 'w-tue',
  },
  {
    id: 'msw-wed-1',
    day_of_week: 3,
    date: '2026-06-03',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '10 km', intensity: 'Hard', description: '3 × 8 min @ threshold, 2 min jog between.' },
  },
  {
    id: 'msw-wed-2',
    day_of_week: 3,
    date: '2026-06-03',
    activity_type: 'mobility',
    order_index: 1,
    prescription: { duration: '15 min', intensity: 'Easy', description: 'Hips + ankles after the hard session.' },
  },
  {
    id: 'msw-thu',
    day_of_week: 4,
    date: '2026-06-04',
    activity_type: 'recovery',
    order_index: 0,
    prescription: { intensity: 'Easy', description: 'Active recovery — walk or easy spin, keep it light.' },
  },
  {
    id: 'msw-fri',
    day_of_week: 5,
    date: '2026-06-05',
    activity_type: 'strength',
    order_index: 0,
    prescription: { intensity: 'Moderate', description: 'Upper push/pull + core.' },
  },
  {
    id: 'msw-sat',
    day_of_week: 6,
    date: '2026-06-06',
    activity_type: 'run',
    order_index: 0,
    prescription: { distance: '18 km', intensity: 'Easy', description: 'Long run, fuel every 40 min.' },
  },
];

export const exampleMultiSportWeekScene: Scene = {
  id: 'example-multi-sport-week',
  title: 'Example · Multi-sport week',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'program-week',
  props: {
    weekMonday: '2026-06-01',
    highlightDayIdx: 2,
    activities,
  },
};
