// Shared types and helpers for workout-file parsing. Lives in its own module
// so parser implementations (gpxParser, parsers/*) can depend on these without
// pulling in `workoutFileParser.ts` itself — which would create an import cycle
// since `workoutFileParser` is the router that imports every parser.

import type { GPSPoint, HRReading, CadenceReading, Lap, PowerReading } from '../types/gps';

export type SourceFormat = 'gpx' | 'tcx' | 'fit' | 'csv' | 'apple_health' | 'health_connect';

export interface WorkoutFileParseResult {
  name: string;
  type: string;
  sourceFormat: SourceFormat;
  points: GPSPoint[];
  hrReadings: HRReading[];
  cadenceReadings: CadenceReading[];
  powerReadings: PowerReading[];
  laps: Lap[];
  startTime: Date | null;
  endTime: Date | null;
  totalDistanceM: number;
  durationSec: number;
  elevationGainM: number;
  caloriesKcal?: number;
  sourceDevice?: string;
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

export function emptyParseResult(
  name: string = 'Imported Workout',
  type: string = '',
  sourceFormat: SourceFormat = 'gpx',
): WorkoutFileParseResult {
  return {
    name,
    type,
    sourceFormat,
    points: [],
    hrReadings: [],
    cadenceReadings: [],
    powerReadings: [],
    laps: [],
    startTime: null,
    endTime: null,
    totalDistanceM: 0,
    durationSec: 0,
    elevationGainM: 0,
  };
}
