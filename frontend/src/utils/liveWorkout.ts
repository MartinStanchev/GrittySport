import type { GPSRecordingState } from '../contexts/WorkoutContext';

export type GPSQualityTone = 'good' | 'fair' | 'searching';

export interface GPSQualityState {
  label: string;
  tone: GPSQualityTone;
}

export interface LiveMapCoordinate {
  latitude: number;
  longitude: number;
}

export interface LiveMapCameraSnapshot {
  altitude?: number;
  zoom?: number;
}

const LIVE_MAP_SIDE_PADDING = 16;
const LIVE_MAP_BOTTOM_EXTRA_PADDING = 24;
const LIVE_MAP_TOP_CLEARANCE = 136;

export function formatLiveWorkoutType(activityType: string): string {
  return activityType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function getRecordingStatusLabel(recordingState: GPSRecordingState): string {
  switch (recordingState) {
    case 'recording':
      return 'Recording';
    case 'paused':
      return 'Auto-paused';
    case 'stopped':
      return 'Finished';
    default:
      return 'Ready';
  }
}

export function getGPSQualityState(accuracy: number | null | undefined, hasPoints: boolean): GPSQualityState {
  if (!hasPoints && (accuracy == null || accuracy <= 0)) {
    return { label: 'Searching', tone: 'searching' };
  }
  if (accuracy == null || accuracy <= 0 || accuracy <= 10) {
    return { label: 'Locked', tone: 'good' };
  }
  if (accuracy <= 25) {
    return { label: 'Tracking', tone: 'fair' };
  }
  return { label: 'Weak GPS', tone: 'searching' };
}

export function buildNorthUpCamera(
  center: LiveMapCoordinate,
  currentCamera?: LiveMapCameraSnapshot | null,
) {
  return {
    center,
    heading: 0,
    pitch: 0,
    ...(currentCamera?.zoom != null ? { zoom: currentCamera.zoom } : {}),
    ...(currentCamera?.altitude != null ? { altitude: currentCamera.altitude } : {}),
  };
}

export function getLiveMapPadding(topInset: number, bottomInset: number, bottomOverlayHeight: number) {
  return {
    top: topInset + LIVE_MAP_TOP_CLEARANCE,
    right: LIVE_MAP_SIDE_PADDING,
    bottom: bottomInset + bottomOverlayHeight + LIVE_MAP_BOTTOM_EXTRA_PADDING,
    left: LIVE_MAP_SIDE_PADDING,
  };
}

// ── Collapsed metric carousel ──────────────────────────────────────────

export type CollapsedMetricId =
  | 'distance'
  | 'pace'
  | 'speed'
  | 'avg_pace'
  | 'avg_speed'
  | 'heart_rate'
  | 'cadence'
  | 'elevation'
  | 'lap';

export interface CollapsedMetricSlot {
  id: CollapsedMetricId;
  label: string;
  unit?: string;
}

export interface CollapsedMetricPage {
  left: CollapsedMetricSlot;
  right: CollapsedMetricSlot;
}

/**
 * Returns the swipeable metric pages for the collapsed pill.
 * Time is always visible — these define the two companion metrics per page.
 */
export function getCollapsedMetricPages(
  isRun: boolean,
  hasCadence: boolean,
): CollapsedMetricPage[] {
  const pages: CollapsedMetricPage[] = [
    {
      left: { id: 'distance', label: 'Distance', unit: 'km' },
      right: isRun
        ? { id: 'pace', label: 'Pace', unit: '/km' }
        : { id: 'speed', label: 'Speed', unit: 'km/h' },
    },
    {
      left: isRun
        ? { id: 'avg_pace', label: 'Avg Pace', unit: '/km' }
        : { id: 'avg_speed', label: 'Avg Speed', unit: 'km/h' },
      right: { id: 'heart_rate', label: 'HR', unit: 'bpm' },
    },
  ];

  if (hasCadence) {
    pages.push({
      left: { id: 'cadence', label: 'Cadence', unit: 'spm' },
      right: { id: 'elevation', label: 'Elevation', unit: 'm' },
    });
  } else {
    pages.push({
      left: { id: 'elevation', label: 'Elevation', unit: 'm' },
      right: { id: 'lap', label: 'Lap' },
    });
  }

  return pages;
}
