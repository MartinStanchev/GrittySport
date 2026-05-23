import { File, Paths } from 'expo-file-system';
import type { WorkoutResponse } from './api';
import type { GPSPoint, HRReading, CadenceReading, Lap } from '../types/gps';

// Lazy-load expo-sharing so a missing native module (e.g. on a stale dev client
// built before this package was added) doesn't crash the app at startup. The
// import only resolves when the user actually taps the share button.
type SharingModule = typeof import('expo-sharing');
function loadSharing(): SharingModule {
  return require('expo-sharing') as SharingModule;
}

export type ExportFormat = 'gpx' | 'tcx';

interface ExportInputs {
  points: GPSPoint[];
  hrReadings: HRReading[];
  cadenceReadings: CadenceReading[];
  laps: Lap[];
  startedAtMs: number;
  finishedAtMs: number;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function workoutHasGPS(workout: WorkoutResponse): boolean {
  const route = workout.gps_route as any;
  return Array.isArray(route?.points) && route.points.length > 0;
}

export function workoutHasHR(workout: WorkoutResponse): boolean {
  const hr = workout.heart_rate_data as any;
  return Array.isArray(hr?.readings) && hr.readings.length > 0;
}

export function canExportWorkout(workout: WorkoutResponse): boolean {
  return workoutHasGPS(workout) || workoutHasHR(workout);
}

export function buildGPX(workout: WorkoutResponse): string {
  const inputs = collectInputs(workout);
  if (inputs.points.length === 0) {
    throw new Error('GPX export requires GPS data');
  }

  const hrIndex = buildTimeIndex(inputs.hrReadings.map((r) => ({ t: r.timestamp, v: r.bpm })));
  const cadIndex = buildTimeIndex(inputs.cadenceReadings.map((r) => ({ t: r.timestamp, v: r.spm })));

  const trackName = escapeXML(makeTrackName(workout));
  const trackType = escapeXML(workout.activity_type);
  const metaTime = isoTime(inputs.startedAtMs);

  const trkpts = inputs.points
    .map((p) => renderGPXTrackpoint(p, hrIndex, cadIndex))
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Gritty Fitness"',
    '  xmlns="http://www.topografix.com/GPX/1/1"',
    '  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
    `  <metadata><time>${metaTime}</time></metadata>`,
    '  <trk>',
    `    <name>${trackName}</name>`,
    `    <type>${trackType}</type>`,
    '    <trkseg>',
    indent(trkpts, 6),
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
  ].join('\n');
}

export function buildTCX(workout: WorkoutResponse): string {
  const inputs = collectInputs(workout);
  if (inputs.points.length === 0 && inputs.hrReadings.length === 0) {
    throw new Error('TCX export requires GPS or HR data');
  }

  const sport = tcxSport(workout.activity_type);
  const startISO = isoTime(inputs.startedAtMs);
  const lapsXML = renderTCXLaps(inputs);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<TrainingCenterDatabase',
    '  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">',
    '  <Activities>',
    `    <Activity Sport="${sport}">`,
    `      <Id>${startISO}</Id>`,
    indent(lapsXML, 6),
    '      <Creator xsi:type="Application_t">',
    '        <Name>Gritty Fitness</Name>',
    '      </Creator>',
    '    </Activity>',
    '  </Activities>',
    '</TrainingCenterDatabase>',
  ].join('\n');
}

export async function shareWorkoutExport(
  workout: WorkoutResponse,
  format: ExportFormat,
): Promise<void> {
  const Sharing = loadSharing();
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device');
  }

  const content = format === 'gpx' ? buildGPX(workout) : buildTCX(workout);
  const fileName = makeFileName(workout, format);
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);

  const mime = format === 'gpx' ? 'application/gpx+xml' : 'application/vnd.garmin.tcx+xml';
  const uti = format === 'gpx' ? 'com.topografix.gpx' : 'com.garmin.tcx';

  await Sharing.shareAsync(file.uri, {
    mimeType: mime,
    UTI: uti,
    dialogTitle: 'Share workout',
  });
}

// ── Input extraction ───────────────────────────────────────────────────────────

function collectInputs(workout: WorkoutResponse): ExportInputs {
  const route = (workout.gps_route ?? {}) as any;
  const hr = (workout.heart_rate_data ?? {}) as any;

  const points: GPSPoint[] = Array.isArray(route.points) ? route.points : [];
  const laps: Lap[] = Array.isArray(route.laps) ? route.laps : [];
  const hrReadings: HRReading[] = Array.isArray(hr.readings) ? hr.readings : [];
  const cadenceReadings: CadenceReading[] = Array.isArray(hr.cadence_readings) ? hr.cadence_readings : [];

  const startedAtMs = workout.started_at ? new Date(workout.started_at).getTime() : 0;
  const finishedAtMs = workout.finished_at
    ? new Date(workout.finished_at).getTime()
    : startedAtMs + (route.duration_sec ?? 0) * 1000;

  return { points, hrReadings, cadenceReadings, laps, startedAtMs, finishedAtMs };
}

// ── GPX trackpoint ─────────────────────────────────────────────────────────────

function renderGPXTrackpoint(
  p: GPSPoint,
  hrIndex: TimeIndex,
  cadIndex: TimeIndex,
): string {
  const time = p.timestamp > 0 ? `<time>${isoTime(p.timestamp)}</time>` : '';
  const ele = p.altitude != null ? `<ele>${fmt(p.altitude, 2)}</ele>` : '';
  const hr = lookup(hrIndex, p.timestamp);
  const cad = lookup(cadIndex, p.timestamp);

  const extParts: string[] = [];
  if (hr != null) extParts.push(`<gpxtpx:hr>${Math.round(hr)}</gpxtpx:hr>`);
  if (cad != null) extParts.push(`<gpxtpx:cad>${Math.round(cad)}</gpxtpx:cad>`);
  const ext = extParts.length > 0
    ? `<extensions><gpxtpx:TrackPointExtension>${extParts.join('')}</gpxtpx:TrackPointExtension></extensions>`
    : '';

  return `<trkpt lat="${fmt(p.lat, 7)}" lon="${fmt(p.lng, 7)}">${ele}${time}${ext}</trkpt>`;
}

// ── TCX rendering ──────────────────────────────────────────────────────────────

function renderTCXLaps(inputs: ExportInputs): string {
  const lapDefs: { startMs: number; endMs: number; distanceM: number; avgHR?: number; maxHR?: number }[] = [];

  if (inputs.laps.length > 0) {
    for (const lap of inputs.laps) {
      lapDefs.push({ startMs: lap.start_time, endMs: lap.end_time, distanceM: lap.distance_m, avgHR: lap.avg_hr });
    }
  } else {
    const distanceM = inputs.points.length > 0
      ? inputs.points.reduce((s, p) => s + (p.distance_from_prev || 0), 0)
      : 0;
    const { avg, max } = hrAverageAndMax(inputs.hrReadings);
    lapDefs.push({
      startMs: inputs.startedAtMs,
      endMs: inputs.finishedAtMs,
      distanceM,
      avgHR: avg,
      maxHR: max,
    });
  }

  const hrIndex = buildTimeIndex(inputs.hrReadings.map((r) => ({ t: r.timestamp, v: r.bpm })));
  const cadIndex = buildTimeIndex(inputs.cadenceReadings.map((r) => ({ t: r.timestamp, v: r.spm })));

  return lapDefs.map((lap) => renderTCXLap(lap, inputs, hrIndex, cadIndex)).join('\n');
}

function renderTCXLap(
  lap: { startMs: number; endMs: number; distanceM: number; avgHR?: number; maxHR?: number },
  inputs: ExportInputs,
  hrIndex: TimeIndex,
  cadIndex: TimeIndex,
): string {
  const totalTimeSec = Math.max(0, (lap.endMs - lap.startMs) / 1000);
  const lapPoints = inputs.points.filter((p) => p.timestamp >= lap.startMs && p.timestamp <= lap.endMs);
  const lapHRReadings = inputs.hrReadings.filter((r) => r.timestamp >= lap.startMs && r.timestamp <= lap.endMs);

  // If HR-only (no GPS in this lap), emit synthetic trackpoints from HR readings.
  const trackpoints = lapPoints.length > 0
    ? renderTCXTrackpointsFromGPS(lapPoints, hrIndex, cadIndex)
    : renderTCXTrackpointsFromHR(lapHRReadings);

  const { avg: avgFromReadings, max: maxFromReadings } = hrAverageAndMax(lapHRReadings);
  const avgHR = lap.avgHR ?? avgFromReadings;
  const maxHR = lap.maxHR ?? maxFromReadings;

  const lines = [
    `<Lap StartTime="${isoTime(lap.startMs)}">`,
    `  <TotalTimeSeconds>${fmt(totalTimeSec, 1)}</TotalTimeSeconds>`,
    `  <DistanceMeters>${fmt(lap.distanceM, 2)}</DistanceMeters>`,
    `  <Calories>0</Calories>`,
  ];
  if (avgHR != null) lines.push(`  <AverageHeartRateBpm><Value>${Math.round(avgHR)}</Value></AverageHeartRateBpm>`);
  if (maxHR != null) lines.push(`  <MaximumHeartRateBpm><Value>${Math.round(maxHR)}</Value></MaximumHeartRateBpm>`);
  lines.push(
    `  <Intensity>Active</Intensity>`,
    `  <TriggerMethod>Manual</TriggerMethod>`,
    `  <Track>`,
    indent(trackpoints, 4),
    `  </Track>`,
    `</Lap>`,
  );
  return lines.join('\n');
}

function renderTCXTrackpointsFromGPS(
  points: GPSPoint[],
  hrIndex: TimeIndex,
  cadIndex: TimeIndex,
): string {
  let cumulativeM = 0;
  return points.map((p) => {
    cumulativeM += p.distance_from_prev || 0;
    const hr = lookup(hrIndex, p.timestamp);
    const cad = lookup(cadIndex, p.timestamp);
    const parts = [
      `<Time>${isoTime(p.timestamp)}</Time>`,
      `<Position><LatitudeDegrees>${fmt(p.lat, 7)}</LatitudeDegrees><LongitudeDegrees>${fmt(p.lng, 7)}</LongitudeDegrees></Position>`,
    ];
    if (p.altitude != null) parts.push(`<AltitudeMeters>${fmt(p.altitude, 2)}</AltitudeMeters>`);
    parts.push(`<DistanceMeters>${fmt(cumulativeM, 2)}</DistanceMeters>`);
    if (hr != null) parts.push(`<HeartRateBpm><Value>${Math.round(hr)}</Value></HeartRateBpm>`);
    if (cad != null) parts.push(`<Cadence>${Math.round(Math.min(cad, 254))}</Cadence>`);
    return `<Trackpoint>${parts.join('')}</Trackpoint>`;
  }).join('\n');
}

function renderTCXTrackpointsFromHR(readings: HRReading[]): string {
  return readings.map((r) => (
    `<Trackpoint><Time>${isoTime(r.timestamp)}</Time><HeartRateBpm><Value>${Math.round(r.bpm)}</Value></HeartRateBpm></Trackpoint>`
  )).join('\n');
}

// ── Helpers ────────────────────────────────────────────────────────────────────

interface TimeIndex {
  times: number[];
  values: number[];
}

function buildTimeIndex(entries: { t: number; v: number }[]): TimeIndex {
  const filtered = entries.filter((e) => e.t > 0).sort((a, b) => a.t - b.t);
  return {
    times: filtered.map((e) => e.t),
    values: filtered.map((e) => e.v),
  };
}

/** Returns the value whose timestamp is closest to `t`, within 5s tolerance. */
function lookup(index: TimeIndex, t: number): number | null {
  if (index.times.length === 0 || t <= 0) return null;
  let lo = 0;
  let hi = index.times.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (index.times[mid] < t) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [lo - 1, lo].filter((i) => i >= 0 && i < index.times.length);
  let bestIdx = -1;
  let bestDelta = Infinity;
  for (const i of candidates) {
    const d = Math.abs(index.times[i] - t);
    if (d < bestDelta) { bestDelta = d; bestIdx = i; }
  }
  if (bestIdx < 0 || bestDelta > 5000) return null;
  return index.values[bestIdx];
}

function hrAverageAndMax(readings: HRReading[]): { avg?: number; max?: number } {
  if (readings.length === 0) return {};
  let sum = 0;
  let max = -Infinity;
  for (const r of readings) {
    sum += r.bpm;
    if (r.bpm > max) max = r.bpm;
  }
  return { avg: sum / readings.length, max };
}

function tcxSport(activityType: string): 'Running' | 'Biking' | 'Other' {
  const t = activityType.toLowerCase();
  if (t === 'run' || t.includes('run')) return 'Running';
  if (t.includes('cycl') || t.includes('bike') || t === 'biking') return 'Biking';
  return 'Other';
}

function padTwo(n: number): string {
  return n.toString().padStart(2, '0');
}

function workoutStartDate(workout: WorkoutResponse): Date {
  return new Date(workout.started_at ? workout.started_at : Date.now());
}

function makeFileName(workout: WorkoutResponse, format: ExportFormat): string {
  const d = workoutStartDate(workout);
  const stamp = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}_${padTwo(d.getHours())}${padTwo(d.getMinutes())}`;
  const safeType = workout.activity_type.replace(/[^a-z0-9_-]/gi, '_');
  return `Gritty_${safeType}_${stamp}.${format}`;
}

function makeTrackName(workout: WorkoutResponse): string {
  const d = workoutStartDate(workout);
  const date = `${d.getFullYear()}-${padTwo(d.getMonth() + 1)}-${padTwo(d.getDate())}`;
  return `${workout.activity_type} ${date}`;
}

function isoTime(ms: number): string {
  return new Date(ms).toISOString();
}

function fmt(n: number, digits: number): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '0';
}

function escapeXML(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text.split('\n').map((l) => (l.length > 0 ? pad + l : l)).join('\n');
}
