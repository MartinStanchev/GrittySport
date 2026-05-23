import type { Scene } from '../types';
import type { ProgramEditData } from '../../components/ProgramEditCard';

const editData: ProgramEditData = {
  type: 'program_edit',
  description: "Bumping Tuesday's 5 × 1km threshold reps up 10s/km. Rest of the week unchanged.",
  edits: [
    {
      action: 'update_activity',
      activity_id: 'demo-tuesday-threshold',
      day_of_week: 2,
      activity_type: 'run',
      prescription: {
        distance: '5 × 1km',
        pace: '4:40/km',
        rpe: '8',
        effort: 'Threshold',
      },
      notes: 'Threshold reps · RPE 8',
      before: {
        activity: {
          activity_type: 'run',
          prescription: {
            distance: '5 × 1km',
            pace: '4:50/km',
            rpe: '7',
            effort: 'Threshold',
          },
          notes: 'Threshold reps · RPE 7',
        },
      },
    },
  ],
};

export const exampleEditProposalScene: Scene = {
  id: 'example-edit-proposal',
  title: 'Example · One-tap workout adjustment',
  group: 'Examples (web)',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'example-edit-proposal-m1',
        role: 'user',
        content: "Today's tempo felt really easy. HR was barely Z3 for most of it.",
        messageType: 'text',
      },
      {
        id: 'example-edit-proposal-m2',
        role: 'assistant',
        content:
          "Nice. I checked the recording, your average HR sat at the top of Z2 the whole way. Tuesday's threshold reps were set off that older 10K, so I'm bumping the pace target 10s/km for that session only. Rest of the week stays as-is.",
        messageType: 'text',
      },
      {
        id: 'example-edit-proposal-m3',
        role: 'system',
        content: '',
        messageType: 'program_edit',
        proposalData: editData,
      },
    ],
  },
};
