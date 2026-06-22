import type { Scene } from '../types';
import type { ProgramSummary, UpcomingActivity, WorkoutResponse } from '../../services/api';

// Home dashboard for a multi-sport athlete mid-program: two sessions stacked for
// today (tempo run + strength), weekly effort climbing toward goal, a real streak,
// and a Grit insight line. Shows the "everything in one place" progress story.
const program: ProgramSummary = {
  id: 'demo-prog',
  name: 'Berlin Marathon Build',
  sport: 'run',
  start_date: '2026-05-04',
  status: 'active',
  created_by: 'grit',
  created_at: '2026-05-04T00:00:00Z',
  updated_at: '2026-06-20T00:00:00Z',
};

const todayActivities: UpcomingActivity[] = [
  {
    id: 'demo-today-run',
    activity_type: 'run',
    day_of_week: 6,
    prescription: { distance: '12 km', pace: '5:10 /km' },
    notes: 'Tempo: 3 km easy, 6 km @ threshold, 3 km easy.',
    week_number: 7,
    phase_name: 'Build',
    date: '2026-06-20',
  },
  {
    id: 'demo-today-strength',
    activity_type: 'strength_training',
    day_of_week: 6,
    prescription: { duration: '45 min' },
    notes: 'Posterior chain + core.',
    week_number: 7,
    phase_name: 'Build',
    date: '2026-06-20',
  },
];

const lastWorkout: WorkoutResponse = {
  id: 'demo-last',
  user_id: 'demo-user',
  activity_type: 'climbing',
  recorded_data: {},
  source: 'manual',
  started_at: '2026-06-19T18:30:00Z',
  finished_at: '2026-06-19T20:05:00Z',
  created_at: '2026-06-19T20:05:00Z',
  updated_at: '2026-06-19T20:05:00Z',
};

export const appHomeProgressScene: Scene = {
  id: 'app-home-progress',
  title: 'App · Home progress dashboard',
  group: 'App screens',
  device: 'iphone-15-pro',
  kind: 'home',
  props: {
    firstName: 'Alex',
    greeting: 'Good morning',
    quickStats: { workouts: 4, streakDays: 4 },
    program,
    todayActivities,
    insight: 'Threshold run today, then 45 min strength. Keep the run controlled, the legs lift better when they are not fried.',
    weeklyEffort: { total: 245, goal: 300, workoutCount: 4 },
    lastWorkout,
    completedDays: [0, 1, 2, 4],
  },
};
