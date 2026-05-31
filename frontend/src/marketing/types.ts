import type { ChatMessage } from '../hooks/useChatWebSocket';
import type { LockScreenMockupProps } from '../components/LockScreenMockup';
import type { ExerciseLog } from '../contexts/WorkoutContext';
import type { SetHighlight } from '../utils/setDetection';
import type { HRReading } from '../types/gps';
import type { ScheduledActivityResponse } from '../services/api';

// Device frame the scene is authored for. Use this to drop a "Capture at this
// device" hint on the playground header so screenshots come out at the right
// aspect ratio for posting.
export type DeviceFrame = 'iphone-15-pro' | 'iphone-15-pro-max' | 'pixel-8';

export interface ChatSceneProps {
  messages: ChatMessage[];
  // Optional quick-reply chips rendered below the message list, matching the
  // chips HomeScreen shows when Grit suggests replies. Same rendering rules as
  // production: borderColor primary, surface fill, primary-tinted text.
  quickReplies?: string[];
}

// Renders the real RecordManual strength logger with one set highlighted, plus
// a LiveHRChart above it, to show HR-spike-driven set detection.
export interface StrengthLogSceneProps {
  activityName: string;
  exercises: ExerciseLog[];
  highlight: SetHighlight | null;
  hrReadings: HRReading[];
  maxHR: number;
}

// Renders the real ProgramDetail week timeline (color-coded multi-sport week).
// weekMonday is an ISO 'YYYY-MM-DD' string the playground converts to a Date.
export interface ProgramWeekSceneProps {
  weekMonday: string;
  activities: ScheduledActivityResponse[];
  highlightDayIdx?: number;
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
    }
  | {
      id: string;
      title: string;
      group: string;
      device: DeviceFrame;
      kind: 'strength-log';
      props: StrengthLogSceneProps;
    }
  | {
      id: string;
      title: string;
      group: string;
      device: DeviceFrame;
      kind: 'program-week';
      props: ProgramWeekSceneProps;
    };

export const DEVICE_DIMENSIONS: Record<DeviceFrame, { width: number; height: number }> = {
  'iphone-15-pro': { width: 393, height: 852 },
  'iphone-15-pro-max': { width: 430, height: 932 },
  'pixel-8': { width: 412, height: 915 },
};
