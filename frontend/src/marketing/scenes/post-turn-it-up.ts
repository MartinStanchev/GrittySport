import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

// Reel B — "turn it up without breaking it". The user asks for more, Grit
// raises the mid-week load but explicitly protects the long run and recovery,
// showing that adjustments always keep the main goal in mind.
const editData: ProgramEditData = {
  type: 'program_edit',
  description: 'Raising the mid-week load. Your long run and recovery days stay protected.',
  edits: [
    {
      action: 'update_activity',
      activity_id: 'demo-tuesday-intervals',
      day_of_week: 2,
      activity_type: 'run',
      prescription: {
        distance: '11 km',
        intensity: 'Hard',
        description: '8 × 1km at threshold, 90s jog recovery.',
      },
      notes: 'Up from 6 reps · same recovery',
      before: {
        activity: {
          activity_type: 'run',
          prescription: {
            distance: '9 km',
            intensity: 'Hard',
            description: '6 × 1km at threshold, 90s jog recovery.',
          },
          notes: 'Threshold intervals',
        },
      },
    },
    {
      action: 'update_activity',
      activity_id: 'demo-wednesday-ride',
      day_of_week: 3,
      activity_type: 'cycling',
      prescription: {
        distance: '55 km',
        intensity: 'Steady',
        description: 'Zone 2 endurance. Extra aerobic volume without pounding the legs.',
      },
      notes: '+10 km · still Zone 2',
      before: {
        activity: {
          activity_type: 'cycling',
          prescription: {
            distance: '45 km',
            intensity: 'Steady',
            description: 'Zone 2 endurance ride.',
          },
          notes: 'Endurance ride',
        },
      },
    },
  ],
};

export const postTurnItUpScene: Scene = {
  id: 'post-turn-it-up',
  title: 'Post · Turn it up, goal stays protected',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-tiu-m1',
        role: 'user',
        content: 'feeling really good lately. can we push harder this block?',
        messageType: 'text',
      },
      {
        id: 'post-tiu-m2',
        role: 'assistant',
        content:
          "You've earned it, the last 3 weeks were all green. I'll bump Tuesday to **8 × 1km** and add 10 km to Wednesday's ride. Friday stays easy, that's what keeps Sunday's long run quality. Deal?",
        messageType: 'text',
      },
      {
        id: 'post-tiu-m3',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
    quickReplies: ['Do it', 'Why not Friday too?'],
  },
};
