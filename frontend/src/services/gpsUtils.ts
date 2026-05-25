import type { GPSPoint, HRReading, CadenceReading, PowerReading, Lap, GPSRouteData, GPSSummaryData, HRData, HRZone, HRZoneDistribution, KmSplit, EffortScoreData, SplitsAnalysis } from '../types/gps';

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
  if (kph <= 0) return '0.00';
  return kph.toFixed(2);
}

export function formatDistanceKm(distM: number): string {
  return (distM / 1000).toFixed(2);
}

// --- Max Pace / Speed ---

/** Compute the fastest pace and fastest speed from GPS points using a sliding window. O(N). */
export function computeMaxPaceAndSpeed(
  points: GPSPoint[],
  windowSize = 10,
): { maxPaceSecPerKm: number; maxSpeedKph: number } {
  let maxPace = 0;
  let maxSpeed = 0;
  if (points.length <= windowSize) return { maxPaceSecPerKm: maxPace, maxSpeedKph: maxSpeed };

  // Seed running distance for the first window
  let runningDist = 0;
  for (let j = 1; j <= windowSize; j++) {
    runningDist += points[j].distance_from_prev;
  }
  const firstDur = points[windowSize].timestamp - points[0].timestamp;
  if (runningDist > 1 && firstDur > 0) {
    maxPace = (firstDur / 1000 / runningDist) * 1000;
    maxSpeed = (runningDist / 1000) / (firstDur / 1000 / 3600);
  }

  // Slide the window
  for (let i = windowSize + 1; i < points.length; i++) {
    runningDist += points[i].distance_from_prev;
    runningDist -= points[i - windowSize].distance_from_prev;
    const durMs = points[i].timestamp - points[i - windowSize].timestamp;
    if (runningDist > 1 && durMs > 0) {
      const pace = (durMs / 1000 / runningDist) * 1000;
      const speed = (runningDist / 1000) / (durMs / 1000 / 3600);
      if (maxPace === 0 || pace < maxPace) maxPace = pace;
      if (speed > maxSpeed) maxSpeed = speed;
    }
  }

  return { maxPaceSecPerKm: maxPace, maxSpeedKph: maxSpeed };
}

// --- Calorie Estimation ---

const MET_VALUES: Record<string, number> = {
  run: 10, easy_run: 8, long_run: 9, interval: 12, trail_run: 11,
  cycling: 8, bike: 8, swim: 7, walk: 3.5, hike: 6,
};

/** Estimate calories burned using MET values. Default weight 70kg. */
export function estimateCalories(activityType: string, durationSec: number, weightKg = 70): number {
  if (durationSec <= 0) return 0;
  const met = MET_VALUES[activityType.toLowerCase()] ?? 6;
  return Math.round(met * weightKg * (durationSec / 3600));
}

// --- Sport Classification ---

const RUN_TYPES = new Set(['run', 'easy_run', 'interval', 'long_run', 'trail_run', 'tempo_run']);
const CYCLING_TYPES = new Set(['cycling', 'bike']);

export function isRunSport(activityType: string): boolean {
  return RUN_TYPES.has(activityType.toLowerCase());
}

export function isCyclingSport(activityType: string): boolean {
  return CYCLING_TYPES.has(activityType.toLowerCase());
}

/** Display unit for cadence based on activity. Cycling pedals revolve, so it's RPM. */
export function cadenceUnit(activityType: string): 'rpm' | 'spm' {
  return isCyclingSport(activityType) ? 'rpm' : 'spm';
}

/** Derived cycling stats: moving time, VAM (m/h), energy (kJ). Returns 0s when inputs are missing. */
export function computeCyclingDerivedStats(params: {
  durationSec: number;
  autoPausedSec?: number;
  elevationGainM?: number;
  avgPower?: number;
}): { movingSec: number; vamMetersPerHour: number; energyKJ: number } {
  const { durationSec, autoPausedSec = 0, elevationGainM = 0, avgPower = 0 } = params;
  const movingSec = Math.max(0, durationSec - autoPausedSec);
  const vamMetersPerHour =
    elevationGainM > 0 && durationSec > 0
      ? Math.round((elevationGainM * 3600) / durationSec)
      : 0;
  const energyKJ =
    avgPower > 0 && durationSec > 0
      ? Math.round((avgPower * durationSec) / 1000)
      : 0;
  return { movingSec, vamMetersPerHour, energyKJ };
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

// --- Effort Score (TRIMP-based) ---

const ZONE_WEIGHTS: Record<HRZone, number> = { 1: 1, 2: 1.5, 3: 2.5, 4: 3.5, 5: 5 };
// 60min Z2 workout ≈ 50, used as normalisation anchor
const NORMALISATION_FACTOR = 60 * 1.5; // = 90

export function computeEffortScore(
  hrReadings: HRReading[],
  maxHR: number,
  durationSec: number,
): EffortScoreData {
  if (hrReadings.length < 2 || durationSec <= 0) {
    return { score: 0, label: 'Easy' };
  }

  let trimp = 0;
  for (let i = 1; i < hrReadings.length; i++) {
    const dtMin = (hrReadings[i].timestamp - hrReadings[i - 1].timestamp) / 60000;
    const zone = getHRZone(hrReadings[i - 1].bpm, maxHR);
    trimp += dtMin * ZONE_WEIGHTS[zone];
  }

  const score = Math.min(100, Math.round((trimp / NORMALISATION_FACTOR) * 50));

  let label: EffortScoreData['label'];
  if (score < 25) label = 'Easy';
  else if (score < 50) label = 'Moderate';
  else if (score < 75) label = 'Hard';
  else if (score < 90) label = 'Very Hard';
  else label = 'Max';

  return { score, label };
}

export function getEffortColor(score: number): string {
  if (score < 25) return '#4CAF50';
  if (score < 50) return '#FFC107';
  if (score < 75) return '#FF9800';
  return '#F44336';
}

// --- Per-KM Splits ---

export function computeKmSplits(
  points: GPSPoint[],
  hrReadings?: HRReading[],
): SplitsAnalysis {
  const splits: KmSplit[] = [];
  if (points.length < 2) {
    return { splits, fastestSplitKm: 0, slowestSplitKm: 0, fadePct: 0, isNegativeSplit: false };
  }

  let splitStart = 0; // index of the first point in this split
  let splitDistAccum = 0;
  let hrIdx = 0; // two-pointer index into hrReadings

  for (let i = 1; i < points.length; i++) {
    splitDistAccum += points[i].distance_from_prev;

    if (splitDistAccum >= 1000) {
      const km = splits.length + 1;
      const startTs = points[splitStart].timestamp;
      const endTs = points[i].timestamp;
      const durationSec = (endTs - startTs) / 1000;
      const paceSecPerKm = durationSec > 0 ? (durationSec / splitDistAccum) * 1000 : 0;
      const elevGain = computeElevationGain(points.slice(splitStart, i + 1));

      let avgHR: number | undefined;
      if (hrReadings && hrReadings.length > 0) {
        // Two-pointer: advance hrIdx to the start of this split, then scan to end
        let hrSum = 0;
        let hrCount = 0;
        while (hrIdx < hrReadings.length && hrReadings[hrIdx].timestamp < startTs) hrIdx++;
        for (let j = hrIdx; j < hrReadings.length && hrReadings[j].timestamp <= endTs; j++) {
          hrSum += hrReadings[j].bpm;
          hrCount++;
        }
        if (hrCount > 0) avgHR = Math.round(hrSum / hrCount);
      }

      splits.push({ km, durationSec, paceSecPerKm, avgHR, elevationGain: elevGain });
      splitStart = i;
      splitDistAccum = 0;
    }
  }

  if (splits.length === 0) {
    return { splits, fastestSplitKm: 0, slowestSplitKm: 0, fadePct: 0, isNegativeSplit: false };
  }

  let fastestKm = splits[0].km;
  let slowestKm = splits[0].km;
  let fastestPace = splits[0].paceSecPerKm;
  let slowestPace = splits[0].paceSecPerKm;
  for (const s of splits) {
    if (s.paceSecPerKm < fastestPace) { fastestPace = s.paceSecPerKm; fastestKm = s.km; }
    if (s.paceSecPerKm > slowestPace) { slowestPace = s.paceSecPerKm; slowestKm = s.km; }
  }

  const firstPace = splits[0].paceSecPerKm;
  const lastPace = splits[splits.length - 1].paceSecPerKm;
  const fadePct = firstPace > 0 ? ((lastPace - firstPace) / firstPace) * 100 : 0;

  const half = Math.floor(splits.length / 2);
  const firstHalfAvg = splits.slice(0, half).reduce((s, sp) => s + sp.paceSecPerKm, 0) / half;
  const secondHalfAvg = splits.slice(half).reduce((s, sp) => s + sp.paceSecPerKm, 0) / (splits.length - half);
  const isNegativeSplit = secondHalfAvg < firstHalfAvg;

  return { splits, fastestSplitKm: fastestKm, slowestSplitKm: slowestKm, fadePct: Math.round(fadePct * 10) / 10, isNegativeSplit };
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
  powerReadings?: PowerReading[];
  totalDistanceM: number;
  autoPausedDurationSec: number;
  startedAt: Date;
  finishedAt: Date;
  hrDeviceName?: string;
}): FinalGPSPayload {
  const {
    activityType, points, laps, hrReadings, cadenceReadings, powerReadings,
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

  const avgPow =
    powerReadings && powerReadings.length > 0
      ? Math.round(powerReadings.reduce((s, r) => s + r.watts, 0) / powerReadings.length)
      : undefined;
  const maxPow =
    powerReadings && powerReadings.length > 0
      ? Math.max(...powerReadings.map((r) => r.watts))
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
    avg_power: avgPow,
    max_power: maxPow,
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
    avg_power: avgPow,
    max_power: maxPow,
  };

  const hasSensorData =
    hrReadings.length > 0 ||
    (cadenceReadings && cadenceReadings.length > 0) ||
    (powerReadings && powerReadings.length > 0);

  return {
    routeData,
    summaryData,
    hrData: hasSensorData
      ? {
          readings: hrReadings,
          cadence_readings: cadenceReadings,
          power_readings: powerReadings,
          device_name: hrDeviceName,
        }
      : null,
  };
}
