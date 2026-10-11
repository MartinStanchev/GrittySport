import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

// Missed-week check-in — Grit notices the silence, the user explains they were
// sick, and Grit doesn't just say "no worries": he actually reduces next week's
// load with an inline edit so the comeback doesn't dig a hole.
const editData: ProgramEditData = {
  type: 'program_edit',
  description: "Easing next week back in after the sick week. Volume down, intensity out until you're through it.",
  edits: [
    {
      action: 'update_activity',
      activity_id: 'demo-tuesday-intervals',
      day_of_week: 2,
      activity_type: 'run',
      prescription: {
        distance: '6 km',
        intensity: 'Easy',
        description: 'Easy conversational run. Testing the waters, nothing more.',
      },
      notes: 'Intervals pulled · easy only',
      before: {
        activity: {
          activity_type: 'run',
          prescription: {
            distance: '10 km',
            intensity: 'Hard',
            description: '6 × 1km at threshold, 90s jog recovery.',
          },
          notes: 'Threshold intervals',
        },
      },
    },
    {
      action: 'update_activity',
      activity_id: 'demo-saturday-long',
      day_of_week: 6,
      activity_type: 'run',
      prescription: {
        distance: '14 km',
        intensity: 'Easy',
        description: 'Shortened long run. If anything feels off, cut it and tell me.',
      },
      notes: 'Down from 22 km',
      before: {
        activity: {
          activity_type: 'run',
          prescription: {
            distance: '22 km',
            intensity: 'Steady',
            description: 'Long run, steady Z2.',
          },
          notes: 'Long run',
        },
      },
    },
  ],
};

export const postMissedWeekCheckinScene: Scene = {
  id: 'post-missed-week-checkin',
  title: 'Post · Sick week · Grit eases the comeback',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-mwc-m1',
        role: 'system',
        content: '',
        messageType: 'segment_header',
        segmentHeader: {
          segmentId: 'post-mwc-seg',
          segmentType: 'missed_workout_review',
          label: 'Weekly check-in',
          startedAt: '2026-07-17T18:05:00Z',
        },
      },
      {
        id: 'post-mwc-m2',
        role: 'assistant',
        content: "You missed all three sessions this week. That's not like you, what's going on?",
        messageType: 'text',
      },
      {
        id: 'post-mwc-m3',
        role: 'user',
        content: "i was sick the whole week, i'm getting back to it this weekend",
        messageType: 'text',
      },
      {
        id: 'post-mwc-m4',
        role: 'assistant',
        content:
          "Glad you're on the mend. We don't jump back to full load after a sick week, that's how people dig a hole. I'll cut next week's volume by about a third and keep it easy until Thursday, then we reassess.",
        messageType: 'text',
      },
      {
        id: 'post-mwc-m5',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
    quickReplies: ['Sounds right', 'I feel fine, keep it'],
  },
};
