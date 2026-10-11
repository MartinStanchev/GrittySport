import type { Scene } from '../types';
import type { ProgramProposalData } from '../../components/ProgramProposalCard';

// Reel A opener — the intake moment. The user states a big goal plus the two
// non-negotiables (Sunday football, Tuesday yoga), and Grit builds the marathon
// plan around them instead of asking the user to give anything up. Ends on the
// real proposal card so the payoff is visible, not just promised.
const proposalData: ProgramProposalData = {
  name: 'Valencia Marathon · 14 weeks',
  sport: 'running',
  goal_description:
    'Finish the Valencia Marathon strong. Quality runs early in the week, Tuesday yoga and Sunday football locked in, weekend kept light so you arrive at the match fresh.',
  start_date: '2026-07-20',
  end_date: '2026-10-25',
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
            activity_type: 'run',
            prescription: {
              distance: '8 km',
              heart_rate_zone: 'Z2',
              effort: 'Easy aerobic',
              rpe: '3/10',
            },
            notes: 'Fresh off the weekend. Keep it conversational.',
          },
          {
            day_of_week: 2,
            activity_type: 'yoga',
            prescription: { duration: '60 min', effort: 'Your usual class' },
            notes: 'Yours. I schedule around it, not over it.',
          },
          {
            day_of_week: 4,
            activity_type: 'run',
            prescription: {
              distance: '10 km',
              effort: '4 × 1km at threshold',
              rpe: '7/10',
            },
            notes: 'The quality session. Three clear days before the match.',
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: {
              distance: '16 km',
              heart_rate_zone: 'Z2',
              effort: 'Long run, easy pace',
              rpe: '4/10',
            },
            notes: 'Saturday morning, done by lunch. Easy on purpose.',
          },
          {
            day_of_week: 0,
            activity_type: 'football',
            prescription: { duration: '90 min', effort: 'Match' },
            notes: 'Your Sunday. Counts as the hard session of the weekend.',
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
            activity_type: 'run',
            prescription: { distance: '10 km', heart_rate_zone: 'Z2', effort: 'Easy' },
          },
          {
            day_of_week: 2,
            activity_type: 'yoga',
            prescription: { duration: '60 min', effort: 'Your usual class' },
          },
          {
            day_of_week: 4,
            activity_type: 'run',
            prescription: { distance: '12 km', effort: '3 × 3km at marathon pace', rpe: '7/10' },
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: { distance: '24 km', heart_rate_zone: 'Z2', effort: 'Long run' },
          },
          {
            day_of_week: 0,
            activity_type: 'football',
            prescription: { duration: '90 min', effort: 'Match' },
          },
        ],
      },
    },
    {
      name: 'Peak + taper',
      order_index: 2,
      start_date: '2026-09-28',
      end_date: '2026-10-25',
      duration_weeks: 4,
      template_week: {
        activities: [
          {
            day_of_week: 2,
            activity_type: 'yoga',
            prescription: { duration: '60 min', effort: 'Your usual class' },
          },
          {
            day_of_week: 4,
            activity_type: 'run',
            prescription: { distance: '8 km', effort: 'Race-pace touches', rpe: '6/10' },
          },
          {
            day_of_week: 6,
            activity_type: 'run',
            prescription: { distance: '30 km', effort: 'Peak long run, then it shrinks', rpe: '5/10' },
          },
        ],
      },
    },
  ],
};
export const postMarathonPlusLifeScene: Scene = {
  id: 'post-marathon-plus-life',
  title: 'Post · Marathon + a life · intake chat',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-mpl-m1',
        role: 'user',
        content:
          'want to train for the valencia marathon in october. but i play football every sunday and do yoga on tuesdays, not giving those up',
        messageType: 'text',
      },
      {
        id: 'post-mpl-m2',
        role: 'assistant',
        content:
          "You don't have to. Football stays as Sunday's hard session and Tuesday stays yoga only. I'll build the marathon work around them, quality runs early in the week so you hit Sunday on fresh legs.",
        messageType: 'text',
      },
      {
        id: 'post-mpl-m3',
        role: 'user',
        content: 'wait, what about the long run then?',
        messageType: 'text',
      },
      {
        id: 'post-mpl-m4',
        role: 'assistant',
        content:
          "Saturday morning, easy pace. It's aerobic work, it won't cook you for the match. The hard intervals land **Thursday**, well clear of the weekend. Want me to build it?",
        messageType: 'text',
      },
      {
        id: 'post-mpl-m5',
        role: 'user',
        content: 'ok build it',
        messageType: 'text',
      },
      {
        id: 'post-mpl-m6',
        role: 'assistant',
        content: 'Done. 14 weeks, football and yoga locked in every single week. Take a look.',
        messageType: 'text',
      },
      {
        id: 'post-mpl-m7',
        role: 'system',
        content: '',
        messageType: 'program_proposal',
        proposalData,
      },
    ],
  },
};
