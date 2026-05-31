import type { Scene } from '../types';

export const exampleMissedWorkoutCheckinScene: Scene = {
  id: 'example-missed-workout-checkin',
  title: 'Example · Missed workout check-in',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'example-missed-workout-checkin-m1',
        role: 'system',
        content: '',
        messageType: 'segment_header',
        segmentHeader: {
          segmentId: 'example-missed-workout-checkin-seg',
          segmentType: 'missed_workout_review',
          label: 'Wednesday · missed session check-in',
          startedAt: '2026-05-27T07:14:00Z',
        },
      },
      {
        id: 'example-missed-workout-checkin-m2',
        role: 'assistant',
        content:
          "Tuesday's threshold run didn't get logged. No stress, a skipped day won't dent your base. You've got 9 days to the 10K though, so I'd rather move it than lose it. Three ways to play it:",
        messageType: 'text',
      },
    ],
    quickReplies: [
      'Move it to today',
      "Swap with Thursday's easy run",
      'Drop it, protect the taper',
    ],
  },
};
