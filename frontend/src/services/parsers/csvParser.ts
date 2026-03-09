import type { GPSPoint, HRReading, CadenceReading, PowerReading } from '../../types/gps';
import type { WorkoutFileParseResult } from '../workoutFileParser';
import { emptyParseResult } from '../workoutFileParser';
import { haversineMetres, computeElevationGain } from '../gpsUtils';

// Column name aliases (case-insensitive)
const LAT_NAMES = new Set(['lat', 'latitude', 'position_lat']);
const LNG_NAMES = new Set(['lng', 'lon', 'longitude', 'position_long', 'position_lng']);
const ALT_NAMES = new Set(['altitude', 'ele', 'elevation', 'alt', 'altitude (m)']);
const HR_NAMES = new Set(['heart_rate', 'hr', 'bpm', 'heartrate', 'hr (bpm)']);
const CAD_NAMES = new Set(['cadence', 'cad', 'spm']);
const TIME_NAMES = new Set(['timestamp', 'time', 'datetime', 'date']);
const SPEED_NAMES = new Set(['speed', 'velocity', 'speed (km/h)']);
const POWER_NAMES = new Set(['power', 'watts', 'power (w)']);
const DIST_NAMES = new Set(['distance', 'dist', 'distance_m', 'distance_in_meters', 'distances (m)']);

interface ColumnMap {
  lat: number;
  lng: number;
  alt: number;
  hr: number;
  cad: number;
  time: number;
  speed: number;
  power: number;
  dist: number;
}

function detectDelimiter(headerLine: string): string {
  const counts = {
    ',': (headerLine.match(/,/g) ?? []).length,
    ';': (headerLine.match(/;/g) ?? []).length,
    '\t': (headerLine.match(/\t/g) ?? []).length,
  };
  if (counts['\t'] >= counts[','] && counts['\t'] >= counts[';']) return '\t';
  if (counts[';'] > counts[',']) return ';';
  return ',';
}

function splitCSVLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function findColumn(headers: string[], names: Set<string>): number {
  return headers.findIndex((h) => names.has(h.toLowerCase().trim()));
}

function mapColumns(headers: string[]): ColumnMap {
  return {
    lat: findColumn(headers, LAT_NAMES),
    lng: findColumn(headers, LNG_NAMES),
    alt: findColumn(headers, ALT_NAMES),
    hr: findColumn(headers, HR_NAMES),
    cad: findColumn(headers, CAD_NAMES),
    time: findColumn(headers, TIME_NAMES),
    speed: findColumn(headers, SPEED_NAMES),
    power: findColumn(headers, POWER_NAMES),
    dist: findColumn(headers, DIST_NAMES),
  };
}

function parseTimestamp(value: string, baseTs: number = 0): number {
  if (!value) return 0;

  // Try elapsed time format (HH:MM:SS or MM:SS) — used by Polar Beat
  const elapsedMatch = value.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
  if (elapsedMatch && baseTs > 0) {
    const h = parseInt(elapsedMatch[1], 10);
    const m = parseInt(elapsedMatch[2], 10);
    const s = parseInt(elapsedMatch[3], 10);
    return baseTs + (h * 3600 + m * 60 + s) * 1000;
  }

  // Try ISO date
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.getTime();
  // Try numeric (seconds or ms)
  const num = parseFloat(value);
  if (!isNaN(num)) {
    return num > 1e12 ? num : num * 1000; // assume seconds if small
  }
  return 0;
}

/** Detect Polar Beat CSV: summary header on line 0, data on line 1, second header on line 2 */
function detectPolarFormat(lines: string[], delimiter: string): { dataStart: number; headers: string[] } | null {
  if (lines.length < 4) return null;
  const firstHeaders = splitCSVLine(lines[0], delimiter);
  // Polar CSVs have "Name" and "Sport" in the first header row
  const hasName = firstHeaders.some((h) => h.toLowerCase() === 'name');
  const hasSport = firstHeaders.some((h) => h.toLowerCase() === 'sport');
  if (!hasName || !hasSport) return null;

  // Line 2 (index 2) should be the per-second data header with "HR" or "Time"
  const secondHeaders = splitCSVLine(lines[2], delimiter);
  const secondCols = mapColumns(secondHeaders);
  if (secondCols.hr >= 0 || secondCols.time >= 0) {
    return { dataStart: 3, headers: secondHeaders };
  }
  return null;
}

/** Parse CSV workout file */
export function parseCSVFile(csvText: string, fileName: string = 'workout.csv'): WorkoutFileParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return emptyParseResult(fileName, '', 'csv');

  const delimiter = detectDelimiter(lines[0]);

  // Check for Polar Beat two-header format
  const polar = detectPolarFormat(lines, delimiter);

  let headers: string[];
  let dataStartLine: number;
  let polarMeta: { sport: string; date: string; startTime: string; duration: string } | null = null;

  if (polar) {
    headers = polar.headers;
    dataStartLine = polar.dataStart;
    // Extract metadata from the summary row (line 1)
    const summaryHeaders = splitCSVLine(lines[0], delimiter);
    const summaryValues = splitCSVLine(lines[1], delimiter);
    const sportIdx = summaryHeaders.findIndex((h) => h.toLowerCase() === 'sport');
    const dateIdx = summaryHeaders.findIndex((h) => h.toLowerCase() === 'date');
    const startIdx = summaryHeaders.findIndex((h) => h.toLowerCase() === 'start time');
    const durIdx = summaryHeaders.findIndex((h) => h.toLowerCase() === 'duration');
    polarMeta = {
      sport: sportIdx >= 0 ? summaryValues[sportIdx] ?? '' : '',
      date: dateIdx >= 0 ? summaryValues[dateIdx] ?? '' : '',
      startTime: startIdx >= 0 ? summaryValues[startIdx] ?? '' : '',
      duration: durIdx >= 0 ? summaryValues[durIdx] ?? '' : '',
    };
  } else {
    headers = splitCSVLine(lines[0], delimiter);
    dataStartLine = 1;
  }

  const cols = mapColumns(headers);

  const hasGPS = cols.lat >= 0 && cols.lng >= 0;
  const hasHR = cols.hr >= 0;
  const hasTime = cols.time >= 0;

  // Detect summary-only CSV (has no lat/lng and no HR — likely Strava/Garmin export summary)
  if (!hasGPS && !hasHR) {
    throw new Error(
      'This CSV contains summary data only. Try exporting as TCX or FIT for full workout details.',
    );
  }

  // For Polar format, compute base timestamp from date + start time
  let polarBaseTs = 0;
  if (polarMeta && polarMeta.date && polarMeta.startTime) {
    const d = new Date(`${polarMeta.date}T${polarMeta.startTime}`);
    if (!isNaN(d.getTime())) polarBaseTs = d.getTime();
  }

  const points: GPSPoint[] = [];
  const hrReadings: HRReading[] = [];
  const cadenceReadings: CadenceReading[] = [];
  const powerReadings: PowerReading[] = [];
  let totalDistanceM = 0;

  for (let i = dataStartLine; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i], delimiter);

    const timestamp = hasTime ? parseTimestamp(fields[cols.time], polarBaseTs) : 0;

    // HR
    if (cols.hr >= 0 && fields[cols.hr]) {
      const bpm = Math.round(parseFloat(fields[cols.hr]));
      if (bpm > 0 && timestamp > 0) {
        hrReadings.push({ bpm, timestamp });
      }
    }

    // Cadence
    if (cols.cad >= 0 && fields[cols.cad]) {
      const spm = Math.round(parseFloat(fields[cols.cad]));
      if (spm > 0 && timestamp > 0) {
        cadenceReadings.push({ spm, timestamp });
      }
    }

    // Power
    if (cols.power >= 0 && fields[cols.power]) {
      const watts = Math.round(parseFloat(fields[cols.power]));
      if (watts > 0 && timestamp > 0) {
        powerReadings.push({ watts, timestamp });
      }
    }

    // GPS point
    if (!hasGPS) continue;
    const lat = parseFloat(fields[cols.lat]);
    const lng = parseFloat(fields[cols.lng]);
    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

    const altitude = cols.alt >= 0 ? parseFloat(fields[cols.alt]) : NaN;
    const speed = cols.speed >= 0 ? parseFloat(fields[cols.speed]) : NaN;

    const point: GPSPoint = {
      lat,
      lng,
      altitude: !isNaN(altitude) ? altitude : null,
      accuracy: 0,
      speed: !isNaN(speed) ? speed : null,
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

  if (points.length === 0 && hrReadings.length === 0) {
    return emptyParseResult(fileName, '', 'csv');
  }

  const startTime = points[0]?.timestamp
    ? new Date(points[0].timestamp)
    : hrReadings[0]?.timestamp
      ? new Date(hrReadings[0].timestamp)
      : null;

  const lastPoint = points[points.length - 1];
  const lastHR = hrReadings[hrReadings.length - 1];
  const endTime = lastPoint?.timestamp
    ? new Date(lastPoint.timestamp)
    : lastHR?.timestamp
      ? new Date(lastHR.timestamp)
      : null;

  const durationSec = startTime && endTime
    ? (endTime.getTime() - startTime.getTime()) / 1000
    : 0;

  return {
    name: fileName.replace(/\.[^.]+$/, ''),
    type: polarMeta?.sport ? polarMeta.sport.toLowerCase() : '',
    sourceFormat: 'csv',
    points,
    hrReadings,
    cadenceReadings,
    powerReadings,
    laps: [],
    startTime,
    endTime,
    totalDistanceM,
    durationSec,
    elevationGainM: computeElevationGain(points),
  };
}
