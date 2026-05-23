import type { Scene } from '../types';

export const examplePostWorkoutReviewScene: Scene = {
  id: 'example-post-workout-review',
  title: 'Example · Post-workout review',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'example-post-workout-review-m1',
        role: 'system',
        content: '',
        messageType: 'segment_header',
        segmentHeader: {
          segmentId: 'example-post-workout-review-seg',
          segmentType: 'post_workout_review',
          label: 'Saturday · long run review',
          startedAt: '2026-05-23T10:42:00Z',
        },
      },
      {
        id: 'example-post-workout-review-m2',
        role: 'assistant',
        content:
          "Solid long run — 18.4 km at 5:38/km, effort score 84. Splits got faster through the second hour (negative split, +) and HR stayed in Z2 except the last two km. This week's session ticks the box for the build phase. How did the legs feel at the end?",
        messageType: 'text',
      },
    ],
    quickReplies: [
      "Strong, could've kept going",
      'Tired but fine',
      'Heavy — calves were cooked',
      "Let's talk about it",
    ],
  },
};
