import { Buffer } from 'buffer';
import FitParser from 'fit-file-parser';
import type { GPSPoint, HRReading, CadenceReading, Lap, PowerReading } from '../../types/gps';
import type { WorkoutFileParseResult } from '../workoutFileTypes';
import { emptyParseResult } from '../workoutFileTypes';
import { haversineMetres, computeElevationGain, avgPaceSecPerKm, avgSpeedKph } from '../gpsUtils';

// Ensure Buffer polyfill is globally available for fit-file-parser
if (typeof globalThis.Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

const SEMICIRCLE_TO_DEG = 180 / Math.pow(2, 31);

const FIT_SPORT_MAP: Record<string, string> = {
  generic: '',
  running: 'run',
  cycling: 'cycling',
  transition: '',
  fitness_equipment: '',
  swimming: 'swim',
  basketball: '',
  walking: 'walk',
  hiking: 'walk',
  multisport: '',
  training: '',
};

/** Parse FIT file from base64-encoded data */
export async function parseFITFile(base64Data: string): Promise<WorkoutFileParseResult> {
  const buffer = Buffer.from(base64Data, 'base64');

  const fitParser = new FitParser({
    force: true,
    speedUnit: 'm/s',
    lengthUnit: 'm',
    elapsedRecordField: true,
  });

  const data = await fitParser.parseAsync(buffer);
  if (!data) return emptyParseResult('FIT Import', '', 'fit');

  // Extract sport
  const sessions = data.sessions ?? [];
  const session = sessions[0];
  const sportStr = String(session?.sport ?? '').toLowerCase();
  const type = FIT_SPORT_MAP[sportStr] ?? sportStr;
  const sportName = type || sportStr || 'workout';

  // Extract records (GPS trackpoints)
  const records = data.records ?? [];
  const points: GPSPoint[] = [];
  const hrReadings: HRReading[] = [];
  const cadenceReadings: CadenceReading[] = [];
  const powerReadings: PowerReading[] = [];
  let totalDistanceM = 0;

  for (const rec of records) {
    const timestamp = rec.timestamp ? new Date(rec.timestamp).getTime() : 0;

    // HR
    if (rec.heart_rate != null && timestamp > 0) {
      const bpm = Math.round(rec.heart_rate);
      if (bpm > 0) hrReadings.push({ bpm, timestamp });
    }

    // Cadence
    if (rec.cadence != null && timestamp > 0) {
      const spm = Math.round(rec.cadence);
      if (spm > 0) cadenceReadings.push({ spm, timestamp });
    }

    // Power
    if (rec.power != null && timestamp > 0) {
      const watts = Math.round(rec.power);
      if (watts > 0) powerReadings.push({ watts, timestamp });
    }

    // Position — FIT uses semicircles or already-converted degrees
    let lat: number | null = null;
    let lng: number | null = null;

    if (rec.position_lat != null && rec.position_long != null) {
      lat = typeof rec.position_lat === 'number' && Math.abs(rec.position_lat) > 180
        ? rec.position_lat * SEMICIRCLE_TO_DEG
        : rec.position_lat;
      lng = typeof rec.position_long === 'number' && Math.abs(rec.position_long) > 180
        ? rec.position_long * SEMICIRCLE_TO_DEG
        : rec.position_long;
    }

    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) continue;

    const altitude = rec.altitude != null ? rec.altitude : (rec.enhanced_altitude ?? null);
    const speed = rec.speed != null ? rec.speed : (rec.enhanced_speed ?? null);

    const point: GPSPoint = {
      lat,
      lng,
      altitude: altitude != null && !isNaN(altitude) ? altitude : null,
      accuracy: 0,
      speed: speed != null && !isNaN(speed) ? speed : null,
      timestamp,
      distance_from_prev: 0,
    };

    if (points.length > 0) {
      const prev = points[points.length - 1];
      point.distance_from_prev = haversineMetres(prev, point);
      totalDistanceM += point.distance_from_prev;
    }

    points.push(point);
  }

  // Extract laps
  const fitLaps = data.laps ?? [];
  const laps: Lap[] = fitLaps.map((lap: any, idx: number) => {
    const startTime = lap.start_time ? new Date(lap.start_time).getTime() : 0;
    const durSec = lap.total_elapsed_time ?? lap.total_timer_time ?? 0;
    const distM = lap.total_distance ?? 0;

    return {
      lap_number: idx + 1,
      start_time: startTime,
      end_time: startTime + durSec * 1000,
      distance_m: distM,
      duration_sec: durSec,
      avg_pace_sec_per_km: avgPaceSecPerKm(distM, durSec),
      avg_speed_kph: avgSpeedKph(distM, durSec),
      avg_hr: lap.avg_heart_rate ? Math.round(lap.avg_heart_rate) : undefined,
      elevation_gain_m: lap.total_ascent ?? 0,
    };
  });

  if (points.length === 0 && hrReadings.length === 0) {
    return emptyParseResult('FIT Import', type, 'fit');
  }

  const startTime = points[0]?.timestamp ? new Date(points[0].timestamp) : null;
  const endTime = points.length > 1 && points[points.length - 1].timestamp
    ? new Date(points[points.length - 1].timestamp)
    : null;

  const durationSec = startTime && endTime
    ? (endTime.getTime() - startTime.getTime()) / 1000
    : 0;

  const name = `${sportName.charAt(0).toUpperCase() + sportName.slice(1)} - FIT Import`;

  return {
    name,
    type,
    sourceFormat: 'fit',
    points,
    hrReadings,
    cadenceReadings,
    powerReadings,
    laps,
    startTime,
    endTime,
    totalDistanceM,
    durationSec,
    elevationGainM: computeElevationGain(points),
  };
}
