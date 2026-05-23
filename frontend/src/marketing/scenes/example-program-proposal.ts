import type { Scene } from '../types';
import type { ProgramProposalData } from '../../components/ProgramProposalCard';

const proposalData: ProgramProposalData = {
  name: 'First half-marathon · 14 weeks',
  sport: 'running',
  goal_description: 'Complete first half-marathon in under 1:55, building from a 53:20 10K base with progressive volume and 2 strength sessions/week from build onward.',
  start_date: '2026-05-25',
  end_date: '2026-08-30',
  phases: [
    {
      name: 'Base',
      order_index: 0,
      start_date: '2026-05-25',
      end_date: '2026-06-21',
      duration_weeks: 4,
      template_week: {
        activities: [
          {
            day_of_week: 1,
            activity_type: 'run',
            prescription: {
              distance: '6 km',
              pace: '5:50/km',
              heart_rate_zone: 'Z2',
              effort: 'Easy aerobic',
              rpe: '3/10',
              duration: '35 min',
            },
            notes: 'Conversational pace. If you can\'t hold a sentence, slow down.',
          },
          {
            day_of_week: 2,
            activity_type: 'strength',
            prescription: {
              duration: '45 min',
              exercises: [
                { name: 'Goblet squat', sets: 3, reps: '8', rpe: '7', rest: '90s' },
                { name: 'Romanian deadlift', sets: 3, reps: '8', rpe: '7', rest: '90s' },
                { name: 'Single-leg glute bridge', sets: 3, reps: '10/side', rpe: '6', rest: '60s' },
                { name: 'Push-up', sets: 3, reps: '8-12', rpe: '7', rest: '60s' },
                { name: 'Side plank', sets: 3, reps: '30s/side', rpe: '6', rest: '45s' },
              ],
            },
            notes: 'Posterior chain + core. Quality over load.',
          },
          {
            day_of_week: 4,
            activity_type: 'run',
            prescription: {
              distance: '5 km',
              pace: '5:50/km',
              heart_rate_zone: 'Z2',
              effort: 'Easy',
              rpe: '3/10',
              duration: '30 min',
            },
          },
          {
            day_of_week: 5,
            activity_type: 'mobility',
            prescription: {
              duration: '20 min',
              style: 'Dynamic + static',
              focus: 'Hips, hamstrings, ankles',
              rpe: '2/10',
            },
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: {
              distance: '10 km',
              pace: '6:00/km',
              heart_rate_zone: 'Z2',
              effort: 'Easy long',
              rpe: '4/10',
              duration: '60 min',
            },
            notes: 'Long run. Build up by 1 km each week of this phase.',
          },
        ],
      },
    },
    {
      name: 'Build',
      order_index: 1,
      start_date: '2026-06-22',
      end_date: '2026-07-26',
      duration_weeks: 5,
      template_week: {
        activities: [
          {
            day_of_week: 1,
            activity_type: 'run',
            prescription: {
              distance: '6 km',
              pace: '5:50/km',
              heart_rate_zone: 'Z2',
              effort: 'Easy recovery',
              rpe: '3/10',
              duration: '35 min',
            },
          },
          {
            day_of_week: 2,
            activity_type: 'strength',
            prescription: {
              duration: '50 min',
              exercises: [
                { name: 'Back squat', sets: 4, reps: '6', rpe: '7', rest: '2 min' },
                { name: 'Romanian deadlift', sets: 3, reps: '8', rpe: '7', rest: '90s' },
                { name: 'Walking lunge', sets: 3, reps: '10/side', rpe: '7', rest: '90s' },
                { name: 'Pull-up / lat pulldown', sets: 3, reps: '6-8', rpe: '7', rest: '90s' },
                { name: 'Pallof press', sets: 3, reps: '10/side', rpe: '6', rest: '60s' },
              ],
            },
          },
          {
            day_of_week: 3,
            activity_type: 'run',
            prescription: {
              warmup: '15 min easy + 4x strides',
              cooldown: '10 min easy',
              sets: [
                { reps: 5, distance: '1 km', pace: '5:00/km', rest: '90s jog', rpe: '7/10' },
              ],
              total_distance: '12 km',
              effort: 'Quality · threshold intervals',
            },
            notes: '5x1K @ 10K pace. The first one should feel almost too easy.',
          },
          {
            day_of_week: 4,
            activity_type: 'mobility',
            prescription: {
              duration: '20 min',
              style: 'Foam roll + static',
              focus: 'Calves, quads, IT band',
              rpe: '2/10',
            },
          },
          {
            day_of_week: 5,
            activity_type: 'strength',
            prescription: {
              duration: '40 min',
              exercises: [
                { name: 'Trap-bar deadlift', sets: 3, reps: '5', rpe: '7', rest: '2 min' },
                { name: 'Split squat', sets: 3, reps: '8/side', rpe: '7', rest: '90s' },
                { name: 'Calf raise', sets: 3, reps: '12', rpe: '7', rest: '60s' },
                { name: 'Hanging knee raise', sets: 3, reps: '10', rpe: '7', rest: '60s' },
              ],
              notes: 'Lower volume than Tuesday. Save legs for Saturday long.',
            },
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: {
              distance: '14 km',
              pace: '5:55/km',
              heart_rate_zone: 'Z2',
              effort: 'Long aerobic',
              rpe: '4/10',
              duration: '85 min',
            },
            notes: 'Build to 18 km by end of phase.',
          },
        ],
      },
    },
    {
      name: 'Peak',
      order_index: 2,
      start_date: '2026-07-27',
      end_date: '2026-08-16',
      duration_weeks: 3,
      template_week: {
        activities: [
          {
            day_of_week: 1,
            activity_type: 'run',
            prescription: {
              distance: '6 km',
              pace: '5:50/km',
              heart_rate_zone: 'Z2',
              effort: 'Recovery',
              rpe: '3/10',
              duration: '35 min',
            },
          },
          {
            day_of_week: 2,
            activity_type: 'strength',
            prescription: {
              duration: '40 min',
              exercises: [
                { name: 'Back squat', sets: 3, reps: '5', rpe: '7', rest: '2 min' },
                { name: 'Romanian deadlift', sets: 3, reps: '6', rpe: '7', rest: '90s' },
                { name: 'Single-leg calf raise', sets: 3, reps: '10/side', rpe: '7', rest: '60s' },
                { name: 'Plank', sets: 3, reps: '45s', rpe: '6', rest: '45s' },
              ],
              notes: 'Maintenance. Cut volume, keep intensity.',
            },
          },
          {
            day_of_week: 3,
            activity_type: 'run',
            prescription: {
              warmup: '15 min easy + 4x strides',
              cooldown: '10 min easy',
              sets: [
                { reps: 1, distance: '5 km', pace: '5:25/km', rest: '3 min jog', rpe: '7/10' },
                { reps: 1, distance: '3 km', pace: '5:25/km', rest: '-', rpe: '7/10' },
              ],
              total_distance: '14 km',
              effort: 'Goal-pace tempo',
            },
            notes: '5K + 3K at goal HM pace. This is the race-readiness test.',
          },
          {
            day_of_week: 4,
            activity_type: 'mobility',
            prescription: {
              duration: '25 min',
              style: 'Yoga flow',
              focus: 'Hips, hamstrings, t-spine',
              rpe: '2/10',
            },
          },
          {
            day_of_week: 5,
            activity_type: 'strength',
            prescription: {
              duration: '35 min',
              exercises: [
                { name: 'Trap-bar deadlift', sets: 3, reps: '4', rpe: '7', rest: '2 min' },
                { name: 'Split squat', sets: 2, reps: '6/side', rpe: '7', rest: '90s' },
                { name: 'Hanging knee raise', sets: 3, reps: '8', rpe: '6', rest: '60s' },
              ],
            },
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: {
              distance: '20 km',
              pace: '5:55/km',
              heart_rate_zone: 'Z2',
              effort: 'Long aerobic',
              rpe: '5/10',
              duration: '2:00:00',
            },
            notes: 'Peak long. 20 km is your longest of the block.',
          },
        ],
      },
    },
    {
      name: 'Taper',
      order_index: 3,
      start_date: '2026-08-17',
      end_date: '2026-08-30',
      duration_weeks: 2,
      template_week: {
        activities: [
          {
            day_of_week: 1,
            activity_type: 'run',
            prescription: {
              distance: '5 km',
              pace: '5:50/km',
              heart_rate_zone: 'Z2',
              effort: 'Easy',
              rpe: '3/10',
              duration: '30 min',
            },
          },
          {
            day_of_week: 2,
            activity_type: 'strength',
            prescription: {
              duration: '25 min',
              exercises: [
                { name: 'Goblet squat', sets: 2, reps: '5', rpe: '6', rest: '90s' },
                { name: 'Romanian deadlift', sets: 2, reps: '5', rpe: '6', rest: '90s' },
                { name: 'Plank', sets: 2, reps: '30s', rpe: '5', rest: '45s' },
              ],
              notes: 'Movement quality only. No fatigue.',
            },
          },
          {
            day_of_week: 3,
            activity_type: 'run',
            prescription: {
              warmup: '10 min easy + 4x strides',
              cooldown: '10 min easy',
              sets: [
                { reps: 3, distance: '1 km', pace: '5:25/km', rest: '90s jog', rpe: '6/10' },
              ],
              total_distance: '8 km',
              effort: 'Goal-pace primer',
            },
            notes: 'Short sharpener. Should feel controlled, not hard.',
          },
          {
            day_of_week: 4,
            activity_type: 'mobility',
            prescription: {
              duration: '20 min',
              style: 'Dynamic + static',
              focus: 'Full body',
              rpe: '2/10',
            },
          },
          {
            day_of_week: 5,
            activity_type: 'run',
            prescription: {
              distance: '4 km',
              pace: '5:50/km',
              heart_rate_zone: 'Z2',
              effort: 'Shakeout',
              rpe: '2/10',
              duration: '25 min',
            },
            notes: 'Race week: 20 min easy + 4x strides on Friday, rest Saturday, race Sunday.',
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: {
              distance: '8 km',
              pace: '5:55/km',
              heart_rate_zone: 'Z2',
              effort: 'Easy',
              rpe: '4/10',
              duration: '48 min',
            },
            notes: 'Week 1 of taper only. Race week replaces this with rest.',
          },
        ],
      },
    },
  ],
};

export const exampleProgramProposalScene: Scene = {
  id: 'example-program-proposal',
  title: 'Example · Half-marathon program proposal',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'example-program-proposal-m1',
        role: 'user',
        content: 'I want to run my first half-marathon in 14 weeks. Around 3 sessions a week, can lift 1–2x. No injuries.',
        messageType: 'text',
      },
      {
        id: 'example-program-proposal-m2',
        role: 'assistant',
        content: "Got it — first half-marathon, 14 weeks, 3 runs + 1–2 lifts. Two quick questions: roughly what's your current easy-run pace per km, and any 5K or 10K time from the last few months I can use as a benchmark?",
        messageType: 'text',
      },
      {
        id: 'example-program-proposal-m3',
        role: 'user',
        content: 'Easy is around 5:50/km. Ran a 10K in 53:20 in March.',
        messageType: 'text',
      },
      {
        id: 'example-program-proposal-m4',
        role: 'assistant',
        content: "Perfect. Based on that 10K I've put your goal at around 1:55. Here's the full 14-week plan — base, build, peak, taper. Strength is in there too. Tap any session to edit, or send it back to me with changes.",
        messageType: 'text',
      },
      {
        id: 'example-program-proposal-m5',
        role: 'system',
        content: '',
        messageType: 'program_proposal',
        proposalData,
      },
    ],
  },
};
