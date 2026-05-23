import type { Scene } from '../types';

export const exampleSetReminderScene: Scene = {
  id: 'example-set-reminder',
  title: 'Example · Grit sets a reminder',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'example-set-reminder-m1',
        role: 'user',
        content: 'Can you remind me to do 15 min of mobility tonight at 8?',
        messageType: 'text',
      },
      {
        id: 'example-set-reminder-m2',
        role: 'system',
        content: 'Scheduled a reminder',
        messageType: 'tool_action',
        toolName: 'set_reminder',
        toolDone: true,
      },
      {
        id: 'example-set-reminder-m3',
        role: 'assistant',
        content:
          'Done — you\'ll get a nudge at 8:00 PM tonight: "15 min mobility — ankles + hips." Want me to make it a recurring weekday thing, or just tonight?',
        messageType: 'text',
      },
    ],
    quickReplies: [
      'Just tonight',
      'Every weekday at 8',
      'Mon/Wed/Fri only',
    ],
  },
};
