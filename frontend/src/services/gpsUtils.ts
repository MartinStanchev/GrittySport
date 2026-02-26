import type { GPSPoint, HRReading, CadenceReading, Lap, GPSRouteData, GPSSummaryData, HRData, HRZone, HRZoneDistribution } from '../types/gps';

// --- Distance ---

export function haversineMetres(p1: GPSPoint, p2: GPSPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLng = toRad(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(p1.lat)) * Math.cos(toRad(p2.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Pace & Speed ---

export function rollingPaceSecPerKm(points: GPSPoint[], windowSize = 10): number {
  if (points.length < 2) return 0;
  const window = points.slice(-windowSize);
  const distM = window.reduce((s, p) => s + p.distance_from_prev, 0);
  const durMs = window[window.length - 1].timestamp - window[0].timestamp;
  if (distM < 1 || durMs <= 0) return 0;
  return (durMs / 1000 / distM) * 1000; // sec/km
}

export function currentSpeedKph(points: GPSPoint[], windowSize = 5): number {
  if (points.length < 2) return 0;
  const window = points.slice(-windowSize);
  const distM = window.reduce((s, p) => s + p.distance_from_prev, 0);
  const durMs = window[window.length - 1].timestamp - window[0].timestamp;
  if (distM < 1 || durMs <= 0) return 0;
  return (distM / 1000) / (durMs / 1000 / 3600); // km/h
}

export function avgPaceSecPerKm(totalDistanceM: number, durationSec: number): number {
  if (totalDistanceM < 1 || durationSec <= 0) return 0;
  return (durationSec / totalDistanceM) * 1000;
}

export function avgSpeedKph(totalDistanceM: number, durationSec: number): number {
  if (totalDistanceM < 1 || durationSec <= 0) return 0;
  return (totalDistanceM / 1000) / (durationSec / 3600);
}

// --- Elevation ---

export function smoothAltitudes(points: GPSPoint[], halfWindow = 2): number[] {
  return points.map((_, i) => {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(points.length - 1, i + halfWindow);
    const slice = points
      .slice(start, end + 1)
      .map((p) => p.altitude ?? 0)
      .sort((a, b) => a - b);
    return slice[Math.floor(slice.length / 2)];
  });
}

export function computeElevationGain(points: GPSPoint[]): number {
  if (points.length < 2) return 0;
  const smoothed = smoothAltitudes(points);
  let gain = 0;
  for (let i = 1; i < smoothed.length; i++) {
    const delta = smoothed[i] - smoothed[i - 1];
    if (delta > 1.0) gain += delta; // 1m threshold to filter GPS noise
  }
  return Math.round(gain);
}

// --- Laps ---

export function triggerLap(
  points: GPSPoint[],
  lapStartIndex: number,
  existingLaps: Lap[],
  hrReadings: HRReading[]
): Lap {
  const lapPoints = points.slice(lapStartIndex);
  const distM = lapPoints.reduce((s, p) => s + p.distance_from_prev, 0);
  const startTime = lapPoints[0]?.timestamp ?? Date.now();
  const endTime = lapPoints[lapPoints.length - 1]?.timestamp ?? Date.now();
  const durSec = (endTime - startTime) / 1000;
  const pace = distM > 0 && durSec > 0 ? (durSec / distM) * 1000 : 0;
  const speed = distM > 0 && durSec > 0 ? (distM / 1000) / (durSec / 3600) : 0;
  const elevGain = computeElevationGain(lapPoints);

  const lapHR = hrReadings.filter((r) => r.timestamp >= startTime && r.timestamp <= endTime);
  const avgHR =
    lapHR.length > 0
      ? Math.round(lapHR.reduce((s, r) => s + r.bpm, 0) / lapHR.length)
      : undefined;

  return {
    lap_number: existingLaps.length + 1,
    start_time: startTime,
    end_time: endTime,
    distance_m: distM,
    duration_sec: durSec,
    avg_pace_sec_per_km: pace,
    avg_speed_kph: speed,
    avg_hr: avgHR,
    elevation_gain_m: elevGain,
  };
}

// --- HR Zones ---

export const HR_ZONE_COLORS: Record<HRZone, string> = {
  1: '#6CABDD',
  2: '#4CAF50',
  3: '#FFC107',
  4: '#FF9800',
  5: '#F44336',
};

// 5-zone model based on % of estimated max HR
export function getHRZone(bpm: number, maxHR: number): HRZone {
  const pct = bpm / maxHR;
  if (pct < 0.6) return 1;
  if (pct < 0.7) return 2;
  if (pct < 0.8) return 3;
  if (pct < 0.9) return 4;
  return 5;
}

export function getHRZoneColor(bpm: number, maxHR: number): string {
  return HR_ZONE_COLORS[getHRZone(bpm, maxHR)];
}

export function computeHRZoneDistribution(
  readings: HRReading[],
  maxHR: number
): HRZoneDistribution {
  const dist: HRZoneDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (let i = 1; i < readings.length; i++) {
    const durSec = (readings[i].timestamp - readings[i - 1].timestamp) / 1000;
    const zone = getHRZone(readings[i - 1].bpm, maxHR);
    dist[zone] += durSec;
  }
  return dist;
}

// --- Formatting ---

export function formatPaceSecPerKm(secPerKm: number): string {
  if (secPerKm <= 0) return '--:--';
  const min = Math.floor(secPerKm / 60);
  const sec = Math.floor(secPerKm % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

export function formatSpeedKph(kph: number): string {
  if (kph <= 0) return '0.0';
  return kph.toFixed(1);
}

export function formatDistanceKm(distM: number): string {
  return (distM / 1000).toFixed(2);
}

// --- Sport Classification ---

const RUN_TYPES = new Set(['run', 'easy_run', 'interval', 'long_run', 'trail_run']);
const CYCLING_TYPES = new Set(['cycling', 'bike']);

export function isRunSport(activityType: string): boolean {
  return RUN_TYPES.has(activityType.toLowerCase());
}

export function isCyclingSport(activityType: string): boolean {
  return CYCLING_TYPES.has(activityType.toLowerCase());
}

// --- Downsampling ---

/** Downsample an array to at most maxPoints entries via uniform index sampling */
export function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  const step = items.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(Math.floor(i * step), items.length - 1);
    result.push(items[idx]);
  }
  return result;
}

// --- Time series for charts ---

export interface PaceTimePoint {
  elapsedMin: number;
  paceSecPerKm: number;
}

export interface SpeedTimePoint {
  elapsedMin: number;
  speedKph: number;
}

/** Compute pace time series from GPS points using a rolling window */
export function computePaceTimeSeries(points: GPSPoint[], windowSize = 10): PaceTimePoint[] {
  if (points.length < 2) return [];
  const startTime = points[0].timestamp;
  const result: PaceTimePoint[] = [];
  // Sample every 10th point to keep chart manageable
  const step = Math.max(1, Math.floor(points.length / 200));
  for (let i = windowSize; i < points.length; i += step) {
    const window = points.slice(Math.max(0, i - windowSize), i + 1);
    const distM = window.reduce((s, p) => s + p.distance_from_prev, 0);
    const durMs = window[window.length - 1].timestamp - window[0].timestamp;
    if (distM > 1 && durMs > 0) {
      result.push({
        elapsedMin: (points[i].timestamp - startTime) / 60000,
        paceSecPerKm: (durMs / 1000 / distM) * 1000,
      });
    }
  }
  return result;
}

/** Compute speed time series from GPS points using a rolling window */
export function computeSpeedTimeSeries(points: GPSPoint[], windowSize = 10): SpeedTimePoint[] {
  if (points.length < 2) return [];
  const startTime = points[0].timestamp;
  const result: SpeedTimePoint[] = [];
  const step = Math.max(1, Math.floor(points.length / 200));
  for (let i = windowSize; i < points.length; i += step) {
    const window = points.slice(Math.max(0, i - windowSize), i + 1);
    const distM = window.reduce((s, p) => s + p.distance_from_prev, 0);
    const durMs = window[window.length - 1].timestamp - window[0].timestamp;
    if (distM > 1 && durMs > 0) {
      result.push({
        elapsedMin: (points[i].timestamp - startTime) / 60000,
        speedKph: (distM / 1000) / (durMs / 1000 / 3600),
      });
    }
  }
  return result;
}

// --- Final payload builder ---

interface FinalGPSPayload {
  routeData: GPSRouteData;
  summaryData: GPSSummaryData;
  hrData: HRData | null;
}

export function buildFinalGPSPayload(params: {
  activityType: string;
  points: GPSPoint[];
  laps: Lap[];
  hrReadings: HRReading[];
  cadenceReadings?: CadenceReading[];
  totalDistanceM: number;
  autoPausedDurationSec: number;
  startedAt: Date;
  finishedAt: Date;
  hrDeviceName?: string;
}): FinalGPSPayload {
  const {
    activityType, points, laps, hrReadings, cadenceReadings,
    totalDistanceM, autoPausedDurationSec, startedAt, finishedAt, hrDeviceName,
  } = params;

  const totalSec = (finishedAt.getTime() - startedAt.getTime()) / 1000 - autoPausedDurationSec;
  const elevGain = computeElevationGain(points);
  const pace = avgPaceSecPerKm(totalDistanceM, totalSec);
  const speed = avgSpeedKph(totalDistanceM, totalSec);

  const avgHR =
    hrReadings.length > 0
      ? Math.round(hrReadings.reduce((s, r) => s + r.bpm, 0) / hrReadings.length)
      : undefined;
  const maxHR = hrReadings.length > 0 ? Math.max(...hrReadings.map((r) => r.bpm)) : undefined;

  const avgCad =
    cadenceReadings && cadenceReadings.length > 0
      ? Math.round(cadenceReadings.reduce((s, r) => s + r.spm, 0) / cadenceReadings.length)
      : undefined;
  const maxCad =
    cadenceReadings && cadenceReadings.length > 0
      ? Math.max(...cadenceReadings.map((r) => r.spm))
      : undefined;

  // Best lap = fastest pace (run) or fastest speed (cycling)
  const bestLapPace =
    laps.length > 0
      ? Math.min(...laps.filter((l) => l.avg_pace_sec_per_km > 0).map((l) => l.avg_pace_sec_per_km))
      : 0;
  const bestLapSpeed =
    laps.length > 0
      ? Math.max(...laps.map((l) => l.avg_speed_kph))
      : 0;

  let sport: string;
  if (isRunSport(activityType)) {
    sport = 'run';
  } else if (isCyclingSport(activityType)) {
    sport = 'cycling';
  } else {
    sport = activityType;
  }

  const routeData: GPSRouteData = {
    sport,
    distance_km: totalDistanceM / 1000,
    duration_sec: totalSec,
    avg_pace_sec_per_km: pace,
    avg_speed_kph: speed,
    elevation_gain_m: elevGain,
    avg_hr: avgHR,
    max_hr: maxHR,
    avg_cadence: avgCad,
    max_cadence: maxCad,
    points,
    laps,
    auto_paused_duration_sec: autoPausedDurationSec,
  };

  const summaryData: GPSSummaryData = {
    distance_km: totalDistanceM / 1000,
    avg_pace_sec_per_km: isRunSport(activityType) ? pace : bestLapPace,
    avg_speed_kph: isCyclingSport(activityType) ? speed : bestLapSpeed,
    elevation_gain_m: elevGain,
    avg_hr: avgHR,
    max_hr: maxHR,
    avg_cadence: avgCad,
    max_cadence: maxCad,
  };

  const hasSensorData = hrReadings.length > 0 || (cadenceReadings && cadenceReadings.length > 0);

  return {
    routeData,
    summaryData,
    hrData: hasSensorData
      ? {
          readings: hrReadings,
          cadence_readings: cadenceReadings,
          device_name: hrDeviceName,
        }
      : null,
  };
}
