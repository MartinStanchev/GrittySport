import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

// Post — "every session feeds the plan". A strength workout review turns into a
// real conversation: Grit notices the user crushed the prescribed weight, asks
// whether to push next week's targets, the user agrees, and the inline program
// change lands right there in the chat. Shows the coaching loop, not just a log.
const editData: ProgramEditData = {
  type: 'program_edit',
  description: 'Raising next week’s lower-body targets after today’s lift. Upper-body work stays put so we progress one thing at a time.',
  edits: [
    {
      action: 'update_activity',
      activity_id: 'demo-next-tue-strength',
      day_of_week: 2,
      activity_type: 'strength_training',
      prescription: { duration: '60 min', intensity: 'Hard', description: 'Heavy lower focus.' },
      notes: 'Squat 5×5 @ 102.5 kg · Deadlift 3×5 @ 120 kg',
      before: {
        activity: {
          activity_type: 'strength_training',
          prescription: { duration: '60 min', intensity: 'Moderate', description: 'Lower focus.' },
          notes: 'Squat 5×5 @ 92 kg · Deadlift 3×5 @ 110 kg',
        },
      },
    },
  ],
};

export const postStrengthReviewProgressionScene: Scene = {
  id: 'post-strength-review-progression',
  title: 'Post · Lift review → target bump',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-strength-review-seg',
        role: 'system',
        content: '',
        messageType: 'segment_header',
        segmentHeader: {
          segmentId: 'post-strength-review-segment',
          segmentType: 'post_workout_review',
          label: 'Tuesday · lower-body review',
          startedAt: '2026-06-16T18:20:00Z',
        },
      },
      {
        id: 'post-strength-review-m1',
        role: 'assistant',
        content:
          'Strong session — you went well past the plan. Squats came in at 5×5 @ 110 kg, about 20% over the 92 kg I prescribed, and you logged every rep at RPE 7 and clean. Bench and rows landed right on target. Numbers that comfortable tell me your lower-body targets are overdue for a bump. Want me to raise next week’s?',
        messageType: 'text',
      },
      {
        id: 'post-strength-review-m2',
        role: 'user',
        content: 'Yeah, honestly the weight felt easy — let’s increase.',
        messageType: 'text',
      },
      {
        id: 'post-strength-review-m3',
        role: 'assistant',
        content: 'Love it. Here’s the bump for next Tuesday:',
        messageType: 'text',
      },
      {
        id: 'post-strength-review-m4',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
  },
};
