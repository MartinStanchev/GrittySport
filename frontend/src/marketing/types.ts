import type { ChatMessage } from '../hooks/useChatWebSocket';
import type { LockScreenMockupProps } from '../components/LockScreenMockup';
import type { ExerciseLog } from '../contexts/WorkoutContext';
import type { SetHighlight } from '../utils/setDetection';
import type { HRReading, HRZone, EffortScoreData, SplitsAnalysis, PersonalRecord, WeeklyTrend } from '../types/gps';
import type {
  ScheduledActivityResponse,
  UpcomingActivity,
  ProgramSummary,
  WorkoutResponse,
} from '../services/api';

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

// Semantic accent keys for metric tiles, resolved against the active theme by
// the rendering stage. Keeps scene files free of raw color values.
export type MetricAccent = 'primary' | 'secondary' | 'tertiary' | 'hr' | 'muted';

// Home / progress-tracking dashboard. Mirrors HomeScreen's card stack, but with
// every value injected so the headless renderer never hits the network.
export interface HomeSceneProps {
  firstName: string;
  greeting?: string; // e.g. 'Good morning' — defaults to a time-based greeting
  quickStats: { workouts: number; streakDays: number };
  program: ProgramSummary | null;
  todayActivities: UpcomingActivity[];
  completedActivityIds?: string[];
  insight: string;
  weeklyEffort: { total: number; goal: number; workoutCount: number };
  lastWorkout?: WorkoutResponse | null;
  completedDays: number[]; // day indices that had a workout (Mon=0 .. Sun=6)
}

export interface LiveMetricTile {
  label: string;
  value: string;
  unit?: string;
  accent?: MetricAccent;
}

// Live GPS recording HUD. Reuses the real metric tiles over a stylized map
// backdrop (react-native-maps doesn't render on web, where captures happen).
export interface LiveWorkoutSceneProps {
  activityLabel: string; // e.g. 'OUTDOOR RUN'
  status: 'recording' | 'paused' | 'idle';
  gpsQuality?: string; // e.g. 'Strong'
  time: string; // 'MM:SS'
  heroMetrics: [LiveMetricTile, LiveMetricTile]; // the two tiles beside Time
  secondaryMetrics: (LiveMetricTile & { support: string })[];
  sensor?: { connected: boolean; label: string };
  routePoints?: { lat: number; lng: number }[];
}

// Post-workout summary / metrics. Display-ready values plus optional real
// analytics cards (effort, splits, HR chart).
export interface WorkoutSummarySceneProps {
  activityTitle: string;
  dateLabel: string;
  routePoints?: { lat: number; lng: number }[];
  stats: { label: string; value: string; unit?: string }[];
  hrZones?: { zone: HRZone; pct: number }[]; // pct in 0..1
  hrReadings?: HRReading[];
  maxHR?: number;
  effort?: EffortScoreData;
  splits?: SplitsAnalysis;
  showPR?: boolean;
  // Premium "best efforts" — e.g. a Fastest 5K record with improvement over the
  // previous best. Rendered as PR rows inside the Analytics card.
  personalRecords?: PersonalRecord[];
  // Premium pace-trend one-liner — e.g. "Pace was 30% faster than your last 2 runs".
  trendText?: string;
  // Premium week-over-week comparison (volume / effort / HR-at-pace rows).
  weeklyTrend?: WeeklyTrend;
  isPremium?: boolean;
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
      kind: 'home';
      props: HomeSceneProps;
    }
  | {
      id: string;
      title: string;
      group: string;
      device: DeviceFrame;
      kind: 'live-workout';
      props: LiveWorkoutSceneProps;
    }
  | {
      id: string;
      title: string;
      group: string;
      device: DeviceFrame;
      kind: 'workout-summary';
      props: WorkoutSummarySceneProps;
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
