import type { Scene } from '../types';
import type { ProgramProposalData } from '../../components/ProgramProposalCard';

// Reel 1 opener — the "no ChatGPT pasting" story starts with the program being
// created in the same chat where everything else will happen: a cycling block
// with the gym work scheduled between rides.
const proposalData: ProgramProposalData = {
  name: 'Gran fondo 100k · 12 weeks',
  sport: 'cycling',
  goal_description:
    'Finish the 100k gran fondo strong in October. Two quality rides a week with gym work in between, strength placed so legs are fresh for the key rides.',
  start_date: '2026-07-20',
  end_date: '2026-10-11',
  phases: [
    {
      name: 'Base',
      order_index: 0,
      start_date: '2026-07-20',
      end_date: '2026-08-16',
      duration_weeks: 4,
      template_week: {
        activities: [
          {
            day_of_week: 1,
            activity_type: 'strength_training',
            prescription: {
              duration: '50 min',
              exercises: [
                { name: 'Back squat', sets: 4, reps: '6', rpe: '7', rest: '2min' },
                { name: 'Romanian deadlift', sets: 3, reps: '8', rpe: '7', rest: '90s' },
                { name: 'Split squat', sets: 3, reps: '8/side', rpe: '7', rest: '90s' },
                { name: 'Plank', sets: 3, reps: '45s', rpe: '6', rest: '45s' },
              ],
            },
            notes: 'Lower strength. Two clear days before the interval ride.',
          },
          {
            day_of_week: 3,
            activity_type: 'cycling',
            prescription: {
              duration: '75 min',
              effort: '3 × 10 min tempo',
              heart_rate_zone: 'Z3',
              rpe: '6/10',
            },
            notes: 'Tempo work. Smooth, high cadence.',
          },
          {
            day_of_week: 4,
            activity_type: 'strength_training',
            prescription: {
              duration: '40 min',
              exercises: [
                { name: 'Bench press', sets: 4, reps: '8', rpe: '7', rest: '2min' },
                { name: 'Bent-over row', sets: 4, reps: '8', rpe: '7', rest: '90s' },
                { name: 'Overhead press', sets: 3, reps: '10', rpe: '6', rest: '90s' },
              ],
            },
            notes: 'Upper only. Legs stay fresh for Saturday.',
          },
          {
            day_of_week: 6,
            activity_type: 'cycling',
            prescription: {
              distance: '60 km',
              heart_rate_zone: 'Z2',
              effort: 'Endurance',
              rpe: '4/10',
            },
            notes: 'The long one. Fuel every 45 min, build toward 100k.',
          },
        ],
      },
    },
    {
      name: 'Build',
      order_index: 1,
      start_date: '2026-08-17',
      end_date: '2026-09-27',
      duration_weeks: 6,
      template_week: {
        activities: [
          {
            day_of_week: 1,
            activity_type: 'strength_training',
            prescription: { duration: '50 min', effort: 'Lower strength, maintained' },
          },
          {
            day_of_week: 3,
            activity_type: 'cycling',
            prescription: { duration: '80 min', effort: '4 × 8 min at threshold', rpe: '8/10' },
          },
          {
            day_of_week: 4,
            activity_type: 'strength_training',
            prescription: { duration: '40 min', effort: 'Upper push/pull' },
          },
          {
            day_of_week: 6,
            activity_type: 'cycling',
            prescription: { distance: '80 km', heart_rate_zone: 'Z2', effort: 'Endurance' },
          },
        ],
      },
    },
    {
      name: 'Peak + taper',
      order_index: 2,
      start_date: '2026-09-28',
      end_date: '2026-10-11',
      duration_weeks: 2,
      template_week: {
        activities: [
          {
            day_of_week: 3,
            activity_type: 'cycling',
            prescription: { duration: '60 min', effort: 'Race-pace touches, short' },
          },
          {
            day_of_week: 6,
            activity_type: 'cycling',
            prescription: { distance: '40 km', effort: 'Sharp but easy. Trust the work.' },
          },
        ],
      },
    },
  ],
};

export const postCyclingProgramCreateScene: Scene = {
  id: 'post-cycling-program-create',
  title: 'Post · Cycling program created in chat',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-cpc-m1',
        role: 'user',
        content:
          'want to get faster on the bike, doing a 100k gran fondo in october. i can train 4 days a week and i want to keep lifting',
        messageType: 'text',
      },
      {
        id: 'post-cpc-m2',
        role: 'assistant',
        content:
          "Good target, 12 weeks is enough to build properly. Two quality rides a week, and the lifting stays but it starts working for the bike. Heavy legs on Monday, upper body Thursday, so you're fresh for both key rides.",
        messageType: 'text',
      },
      {
        id: 'post-cpc-m3',
        role: 'user',
        content: 'ok lets see it',
        messageType: 'text',
      },
      {
        id: 'post-cpc-m4',
        role: 'system',
        content: '',
        messageType: 'program_proposal',
        proposalData,
      },
    ],
  },
};
