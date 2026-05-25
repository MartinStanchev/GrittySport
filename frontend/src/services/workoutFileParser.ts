import { Alert } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import type { SaveWorkoutInput } from './api';
import { buildFinalGPSPayload } from './gpsUtils';
import { parseGPXFile } from './gpxParser';
import { parseTCXFile } from './parsers/tcxParser';
import { parseFITFile } from './parsers/fitParser';
import { parseCSVFile } from './parsers/csvParser';
import { parseZIPFile } from './parsers/zipHandler';
import { getExtension, type WorkoutFileParseResult } from './workoutFileTypes';

export type { ZipParseResult } from './parsers/zipHandler';
export { emptyParseResult, getExtension } from './workoutFileTypes';
export type { SourceFormat, WorkoutFileParseResult } from './workoutFileTypes';

export type ParseResult =
  | { kind: 'single'; workout: WorkoutFileParseResult }
  | { kind: 'zip'; data: import('./parsers/zipHandler').ZipParseResult };

const SUPPORTED_EXTENSIONS = ['.gpx', '.tcx', '.fit', '.csv', '.zip'];

/** Open file picker for workout files; returns { uri, fileName } or null */
export async function pickWorkoutFile(): Promise<{ uri: string; fileName: string } | null> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return null;

    const file = result.assets[0];
    const ext = getExtension(file.name ?? '');

    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      Alert.alert('Unsupported File', 'Please select a GPX, TCX, FIT, CSV, or ZIP file.');
      return null;
    }

    return { uri: file.uri, fileName: file.name ?? 'workout' + ext };
  } catch (e: any) {
    console.warn('Workout file picker error:', e);
    return null;
  }
}

/** Read a file URI as UTF-8 text (React Native fetch supports file:// URIs) */
async function readFileAsText(uri: string): Promise<string> {
  const response = await fetch(uri);
  return response.text();
}

/** Read a file URI as base64 string */
async function readFileAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Strip data URL prefix (e.g. "data:application/octet-stream;base64,")
      const base64 = dataUrl.split(',')[1] ?? '';
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file as base64'));
    reader.readAsDataURL(blob);
  });
}

/** Parse a workout file by extension, returns single result or ZIP multi-result */
export async function parseWorkoutFile(uri: string, fileName: string): Promise<ParseResult> {
  const ext = getExtension(fileName);

  if (ext === '.zip') {
    const base64 = await readFileAsBase64(uri);
    const zipResult = await parseZIPFile(base64);
    return { kind: 'zip', data: zipResult };
  }

  const workout = await parseSingleFile(uri, ext);
  return { kind: 'single', workout };
}

/** Parse a single (non-ZIP) workout file */
async function parseSingleFile(uri: string, ext: string): Promise<WorkoutFileParseResult> {
  if (ext === '.fit') {
    const base64 = await readFileAsBase64(uri);
    return parseFITFile(base64);
  }

  const text = await readFileAsText(uri);

  switch (ext) {
    case '.gpx':
      return parseGPXFile(text);
    case '.tcx':
      return parseTCXFile(text);
    case '.csv':
      return parseCSVFile(text);
    default:
      throw new Error(`Unsupported file format: ${ext}`);
  }
}

/** Map activity type string to app type, with speed-based fallback */
export function detectActivityType(result: WorkoutFileParseResult): string {
  const rawType = result.type.toLowerCase().trim();

  const typeMap: Record<string, string> = {
    running: 'run',
    run: 'run',
    trail_running: 'trail_run',
    trail_run: 'trail_run',
    cycling: 'cycling',
    biking: 'cycling',
    bike: 'cycling',
    riding: 'cycling',
    walking: 'walk',
    walk: 'walk',
    hiking: 'walk',
    hike: 'walk',
    swimming: 'swim',
    swim: 'swim',
  };

  if (typeMap[rawType]) return typeMap[rawType];

  // Speed-based heuristic fallback
  if (result.durationSec > 0 && result.totalDistanceM > 0) {
    const speedKph = (result.totalDistanceM / 1000) / (result.durationSec / 3600);
    if (speedKph < 6) return 'walk';
    if (speedKph <= 16) return 'run';
    return 'cycling';
  }

  return 'run';
}

/** Build the save payload from any parsed workout file */
export function buildFileSavePayload(
  result: WorkoutFileParseResult,
  activityType: string,
  notes?: string,
  scheduledActivityId?: string,
): SaveWorkoutInput {
  const startedAt = result.startTime ?? new Date();
  const finishedAt = result.endTime ?? startedAt;

  const { routeData, summaryData, hrData } = buildFinalGPSPayload({
    activityType,
    points: result.points,
    laps: result.laps,
    hrReadings: result.hrReadings,
    cadenceReadings: result.cadenceReadings.length > 0 ? result.cadenceReadings : undefined,
    powerReadings: result.powerReadings.length > 0 ? result.powerReadings : undefined,
    totalDistanceM: result.totalDistanceM,
    autoPausedDurationSec: 0,
    startedAt,
    finishedAt,
  });

  const recordedData = summaryData as Record<string, any>;
  if (result.caloriesKcal != null) recordedData.calories = Math.round(result.caloriesKcal);
  if (result.sourceDevice) recordedData.source_device = result.sourceDevice;

  return {
    scheduled_activity_id: scheduledActivityId,
    activity_type: activityType,
    recorded_data: recordedData,
    source: result.sourceFormat,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    gps_route: routeData as Record<string, any>,
    heart_rate_data: hrData as Record<string, any> | undefined,
    notes: notes?.trim() || undefined,
  };
}

