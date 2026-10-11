import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

// Adjustability use case — bad sequencing, told in one sentence. The user says
// Thursday's leg day ruins Friday's run, Grit owns it and moves the session,
// and the inline edit card shows exactly what changes.
const editData: ProgramEditData = {
  type: 'program_edit',
  description: "Moving leg day to Monday so Friday's run gets fresh legs.",
  edits: [
    {
      action: 'update_activity',
      activity_id: 'demo-thursday-legs',
      day_of_week: 1,
      activity_type: 'strength_training',
      prescription: {
        duration: '50 min',
        intensity: 'Hard',
        description: 'Squats + posterior chain. Three clear days before the Friday run.',
      },
      notes: 'Moved from Thursday · same session',
      before: {
        activity: {
          activity_type: 'strength_training',
          prescription: {
            duration: '50 min',
            intensity: 'Hard',
            description: 'Squats + posterior chain.',
          },
          notes: 'Thursday · day before your run',
        },
      },
    },
  ],
};

export const postLegdayBeforeRunScene: Scene = {
  id: 'post-legday-before-run',
  title: 'Post · Leg day wrecks Friday run · move it',
  group: 'Social posts',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'post-lbr-m1',
        role: 'user',
        content: 'the leg day on thursday tires me out for the run on friday',
        messageType: 'text',
      },
      {
        id: 'post-lbr-m2',
        role: 'assistant',
        content:
          "Fair call, that's bad sequencing. I'll move legs to **Monday**, so you get three clear days before the run. Friday should feel completely different. Want me to make the swap?",
        messageType: 'text',
      },
      {
        id: 'post-lbr-m3',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
    quickReplies: ['Perfect, do it', 'Wednesday instead'],
  },
};
