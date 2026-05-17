import type { Scene } from '../types';

// Lives as its own file so the registry pattern (one file per scene) is
// established from day one. Delete once the first real scenes land.
export const sanityCheckScene: Scene = {
  id: 'sanity-check',
  title: 'Sanity check · text only',
  group: 'Examples',
  device: 'iphone-15-pro',
  kind: 'chat',
  props: {
    messages: [
      {
        id: 'sc-1',
        role: 'assistant',
        content: 'If you can read this rendered through the real `ChatMessageItem`, the playground is wired up correctly.',
        messageType: 'text',
      },
      {
        id: 'sc-2',
        role: 'user',
        content: 'great, ship the rest of the scenes',
        messageType: 'text',
      },
    ],
  },
};
