import type { Scene } from '../types';
import type { ProgramSummary, UpcomingActivity, WorkoutResponse } from '../../services/api';

// Home dashboard, "all done today" state: both scheduled sessions completed, the
// weekly effort bar in the green, a 5-day streak. The payoff-of-consistency shot.
const program: ProgramSummary = {
  id: 'demo-prog',
  name: 'Hybrid Strength + 10K',
  sport: 'run',
  start_date: '2026-05-11',
  status: 'active',
  created_by: 'grit',
  created_at: '2026-05-11T00:00:00Z',
  updated_at: '2026-06-20T00:00:00Z',
};

const todayActivities: UpcomingActivity[] = [
  {
    id: 'demo-done-intervals',
    activity_type: 'run',
    day_of_week: 6,
    prescription: { distance: '8 km', pace: '4:55 /km' },
    week_number: 6,
    phase_name: 'Peak',
    date: '2026-06-20',
  },
  {
    id: 'demo-done-mobility',
    activity_type: 'mobility',
    day_of_week: 6,
    prescription: { duration: '20 min' },
    week_number: 6,
    phase_name: 'Peak',
    date: '2026-06-20',
  },
];

const lastWorkout: WorkoutResponse = {
  id: 'demo-last',
  user_id: 'demo-user',
  activity_type: 'run',
  recorded_data: {},
  source: 'gps',
  started_at: '2026-06-20T07:14:00Z',
  finished_at: '2026-06-20T07:53:00Z',
  created_at: '2026-06-20T07:53:00Z',
  updated_at: '2026-06-20T07:53:00Z',
};

export const appHomeAllDoneScene: Scene = {
  id: 'app-home-alldone',
  title: 'App · Home all-done state',
  group: 'App screens',
  device: 'iphone-15-pro',
  kind: 'home',
  props: {
    firstName: 'Sam',
    greeting: 'Good evening',
    quickStats: { workouts: 5, streakDays: 5 },
    program,
    todayActivities,
    completedActivityIds: ['demo-done-intervals', 'demo-done-mobility'],
    insight: 'Both sessions logged and the intervals were right on pace. That is five days straight, recovery tomorrow is earned.',
    weeklyEffort: { total: 312, goal: 300, workoutCount: 5 },
    lastWorkout,
    completedDays: [0, 1, 3, 4, 5],
  },
};
