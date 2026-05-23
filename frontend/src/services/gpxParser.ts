import { XMLParser } from 'fast-xml-parser';
import type { GPSPoint, HRReading } from '../types/gps';
import type { WorkoutFileParseResult } from './workoutFileTypes';
import { emptyParseResult } from './workoutFileTypes';
import { haversineMetres, computeElevationGain } from './gpsUtils';

/** Parse GPX XML string into WorkoutFileParseResult */
export function parseGPXFile(xmlString: string): WorkoutFileParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const parsed = parser.parse(xmlString);
  const gpx = parsed?.gpx;
  if (!gpx) return emptyParseResult('GPX Import', '', 'gpx');

  const trk = gpx.trk;
  if (!trk) return emptyParseResult('GPX Import', '', 'gpx');

  const tracks = Array.isArray(trk) ? trk : [trk];
  const firstTrack = tracks[0];

  const name = String(firstTrack.name ?? 'GPX Import');
  const type = String(firstTrack.type ?? '');

  // Collect all trackpoints across all tracks and segments
  const rawPoints: any[] = [];
  for (const track of tracks) {
    const segments = track.trkseg
      ? Array.isArray(track.trkseg) ? track.trkseg : [track.trkseg]
      : [];
    for (const seg of segments) {
      const pts = seg.trkpt
        ? Array.isArray(seg.trkpt) ? seg.trkpt : [seg.trkpt]
        : [];
      rawPoints.push(...pts);
    }
  }

  if (rawPoints.length === 0) return emptyParseResult(name, type, 'gpx');

  const points: GPSPoint[] = [];
  const hrReadings: HRReading[] = [];
  let totalDistanceM = 0;

  for (let i = 0; i < rawPoints.length; i++) {
    const raw = rawPoints[i];
    const lat = parseFloat(raw['@_lat']);
    const lng = parseFloat(raw['@_lon']);

    if (isNaN(lat) || isNaN(lng)) continue;

    const altitude = raw.ele != null ? parseFloat(String(raw.ele)) : null;
    const timestamp = raw.time ? new Date(raw.time).getTime() : 0;

    const point: GPSPoint = {
      lat,
      lng,
      altitude: isNaN(altitude as number) ? null : altitude,
      accuracy: 0,
      speed: null,
      timestamp,
      distance_from_prev: 0,
    };

    if (points.length > 0) {
      const prev = points[points.length - 1];
      point.distance_from_prev = haversineMetres(prev, point);
      totalDistanceM += point.distance_from_prev;
    }

    points.push(point);

    const hr = extractHR(raw.extensions);
    if (hr != null && timestamp > 0) {
      hrReadings.push({ bpm: hr, timestamp });
    }
  }

  const startTime = points[0]?.timestamp ? new Date(points[0].timestamp) : null;
  const endTime = points.length > 1 && points[points.length - 1].timestamp
    ? new Date(points[points.length - 1].timestamp)
    : null;

  const durationSec = startTime && endTime
    ? (endTime.getTime() - startTime.getTime()) / 1000
    : 0;

  const elevationGainM = computeElevationGain(points);

  return {
    name,
    type,
    sourceFormat: 'gpx',
    points,
    hrReadings,
    cadenceReadings: [],
    powerReadings: [],
    laps: [],
    startTime,
    endTime,
    totalDistanceM,
    durationSec,
    elevationGainM,
  };
}

/** Extract heart rate from GPX extensions (handles multiple namespace styles) */
function extractHR(extensions: any): number | null {
  if (!extensions) return null;

  const tpe = extensions.TrackPointExtension;
  if (tpe) {
    const hr = tpe.hr;
    if (hr != null) return Math.round(parseFloat(String(hr)));
  }

  if (extensions.hr != null) {
    return Math.round(parseFloat(String(extensions.hr)));
  }

  if (extensions.heartrate != null) {
    return Math.round(parseFloat(String(extensions.heartrate)));
  }

  return null;
}
