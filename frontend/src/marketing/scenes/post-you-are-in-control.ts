import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

// Post 2 — "you're always in control". Life changed (a Sunday match got added),
// the user just tells Grit, and Grit reshuffles the rest of the week around it —
// then waits for the user to accept. The plan bends to your life, not the reverse.
const editData: ProgramEditData = {
  type: 'program_edit',
  description: 'Adding Sunday’s match and lightening Friday so you’ve got fresh legs for it.',
  edits: [
    {
      action: 'add_activity',
      day_of_week: 0,
      activity_type: 'football',
      prescription: { duration: '90 min', intensity: 'Hard', description: '5-a-side match — treat it as your hard session for the day.' },
      notes: '5-a-side · counts as your Sunday effort',
    },
    {
      action: 'update_activity',
      activity_id: 'demo-friday-strength',
      day_of_week: 5,
      activity_type: 'strength_training',
      prescription: { intensity: 'Light', description: 'Upper body only, leave the legs alone.' },
      notes: 'Upper push/pull · legs fresh for Sunday',
      before: {
        activity: {
          activity_type: 'strength_training',
          prescription: { intensity: 'Moderate', description: 'Full lower + upper, heavy squats.' },
          notes: 'Full body · heavy squats',
        },
      },
    },
  ],
};

export const postYouAreInControlScene: Scene = {
  id: 'post-you-are-in-control',
  title: 'Post 2 · You add it, Grit reshuffles',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-control-m1',
        role: 'user',
        content: 'Got a 5-a-side match this Sunday now. Can you fit it in without wrecking my legs?',
        messageType: 'text',
      },
      {
        id: 'post-control-m2',
        role: 'assistant',
        content:
          'On it. I’ll drop the match in as Sunday’s hard effort and pull the heavy squats out of Friday so your legs are fresh. Everything else stays where it is. Want me to make the change?',
        messageType: 'text',
      },
      {
        id: 'post-control-m3',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
    quickReplies: ['Yes, do it', 'Keep Friday heavy'],
  },
};
