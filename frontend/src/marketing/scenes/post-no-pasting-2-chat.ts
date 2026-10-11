import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

// Reel 1, payoff — the review itself. Grit compares today's intervals to the
// same session three weeks ago, the user says they had more in the tank, and
// Grit turns that straight into a program change with the inline edit card.
// Nothing was exported, pasted, or explained.
const editData: ProgramEditData = {
  type: 'program_edit',
  description: "Next week's intervals go up a rep with a higher target. The Saturday long ride stays easy.",
  edits: [
    {
      action: 'update_activity',
      activity_id: 'demo-wednesday-intervals',
      day_of_week: 3,
      activity_type: 'cycling',
      prescription: {
        duration: '85 min',
        intensity: 'Hard',
        description: '5 × 8 min at 250W, 4 min easy between reps.',
      },
      notes: '+1 rep · target up 5W',
      before: {
        activity: {
          activity_type: 'cycling',
          prescription: {
            duration: '80 min',
            intensity: 'Hard',
            description: '4 × 8 min at 245W, 4 min easy between reps.',
          },
          notes: 'Threshold intervals',
        },
      },
    },
  ],
};

export const postNoPasting2ChatScene: Scene = {
  id: 'post-no-pasting-2-chat',
  title: 'Post · No pasting · ride review + effort bump',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-np-m1',
        role: 'system',
        content: '',
        messageType: 'segment_header',
        segmentHeader: {
          segmentId: 'post-np-seg',
          segmentType: 'post_workout_review',
          label: 'Wednesday · interval ride review',
          startedAt: '2026-08-26T18:40:00Z',
        },
      },
      {
        id: 'post-np-m2',
        role: 'assistant',
        content:
          'Strong session. 4 × 8 min at **245W** and your HR stayed flat across the reps. Three weeks ago the same effort bought you 228W. Cadence held above 90 the whole way too. How did the legs feel?',
        messageType: 'text',
      },
      {
        id: 'post-np-m3',
        role: 'user',
        content: "felt strong tbh, could've done another rep",
        messageType: 'text',
      },
      {
        id: 'post-np-m4',
        role: 'assistant',
        content:
          "Then we use it. Next week goes to **5 × 8 min at 250W**. Saturday's long ride stays easy, that's the engine builder.",
        messageType: 'text',
      },
      {
        id: 'post-np-m5',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
    quickReplies: ['Do it', 'Keep it at 4 reps'],
  },
};
