import type { ChatMessage } from '../hooks/useChatWebSocket';
import type { LockScreenMockupProps } from '../components/LockScreenMockup';

// Device frame the scene is authored for. Use this to drop a "Capture at this
// device" hint on the playground header so screenshots come out at the right
// aspect ratio for posting.
export type DeviceFrame = 'iphone-15-pro' | 'iphone-15-pro-max' | 'pixel-8';

export interface ChatSceneProps {
  messages: ChatMessage[];
}

export type Scene =
  | {
      id: string;
      title: string;
      group: string;
      device: DeviceFrame;
      kind: 'chat';
      props: ChatSceneProps;
    }
  | {
      id: string;
      title: string;
      group: string;
      device: DeviceFrame;
      kind: 'lockscreen';
      props: LockScreenMockupProps;
    };

export const DEVICE_DIMENSIONS: Record<DeviceFrame, { width: number; height: number }> = {
  'iphone-15-pro': { width: 393, height: 852 },
  'iphone-15-pro-max': { width: 430, height: 932 },
  'pixel-8': { width: 412, height: 915 },
};
