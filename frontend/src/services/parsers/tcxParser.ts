import { XMLParser } from 'fast-xml-parser';
import type { GPSPoint, HRReading, CadenceReading, Lap } from '../../types/gps';
import type { WorkoutFileParseResult } from '../workoutFileTypes';
import { emptyParseResult } from '../workoutFileTypes';
import { haversineMetres, computeElevationGain, avgPaceSecPerKm, avgSpeedKph } from '../gpsUtils';

const SPORT_MAP: Record<string, string> = {
  running: 'run',
  biking: 'cycling',
  other: '',
};

/** Parse TCX XML string into WorkoutFileParseResult */
export function parseTCXFile(xmlString: string): WorkoutFileParseResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
  });

  const parsed = parser.parse(xmlString);
  const db = parsed?.TrainingCenterDatabase;
  if (!db) return emptyParseResult('TCX Import', '', 'tcx');

  const activities = db.Activities;
  if (!activities) return emptyParseResult('TCX Import', '', 'tcx');

  const activityList = activities.Activity
    ? Array.isArray(activities.Activity) ? activities.Activity : [activities.Activity]
    : [];

  if (activityList.length === 0) return emptyParseResult('TCX Import', '', 'tcx');

  const activity = activityList[0];
  const sport = String(activity['@_Sport'] ?? '').toLowerCase();
  const type = SPORT_MAP[sport] ?? sport;

  const tcxLaps = activity.Lap
    ? Array.isArray(activity.Lap) ? activity.Lap : [activity.Lap]
    : [];

  const points: GPSPoint[] = [];
  const hrReadings: HRReading[] = [];
  const cadenceReadings: CadenceReading[] = [];
  const laps: Lap[] = [];
  let totalDistanceM = 0;

  for (let lapIdx = 0; lapIdx < tcxLaps.length; lapIdx++) {
    const tcxLap = tcxLaps[lapIdx];
    const lapStartIndex = points.length;

    // Extract trackpoints from this lap's tracks
    const tracks = tcxLap.Track
      ? Array.isArray(tcxLap.Track) ? tcxLap.Track : [tcxLap.Track]
      : [];

    for (const track of tracks) {
      const trackpoints = track.Trackpoint
        ? Array.isArray(track.Trackpoint) ? track.Trackpoint : [track.Trackpoint]
        : [];

      for (const tp of trackpoints) {
        const timestamp = tp.Time ? new Date(tp.Time).getTime() : 0;

        // HR
        const hrVal = tp.HeartRateBpm?.Value;
        if (hrVal != null && timestamp > 0) {
          const bpm = Math.round(parseFloat(String(hrVal)));
          if (bpm > 0) hrReadings.push({ bpm, timestamp });
        }

        // Cadence
        if (tp.Cadence != null && timestamp > 0) {
          const spm = Math.round(parseFloat(String(tp.Cadence)));
          if (spm > 0) cadenceReadings.push({ spm, timestamp });
        }

        // Position
        const pos = tp.Position;
        if (!pos) continue;

        const lat = parseFloat(String(pos.LatitudeDegrees));
        const lng = parseFloat(String(pos.LongitudeDegrees));
        if (isNaN(lat) || isNaN(lng)) continue;

        const altitude = tp.AltitudeMeters != null
          ? parseFloat(String(tp.AltitudeMeters))
          : null;

        const point: GPSPoint = {
          lat,
          lng,
          altitude: altitude != null && !isNaN(altitude) ? altitude : null,
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
      }
    }

    // Build structured lap from TCX lap metadata
    if (points.length > lapStartIndex) {
      const lapDistM = parseFloat(String(tcxLap.DistanceMeters ?? 0));
      const lapDurSec = parseFloat(String(tcxLap.TotalTimeSeconds ?? 0));

      const avgHR = tcxLap.AverageHeartRateBpm?.Value
        ? Math.round(parseFloat(String(tcxLap.AverageHeartRateBpm.Value)))
        : undefined;

      laps.push({
        lap_number: lapIdx + 1,
        start_time: points[lapStartIndex].timestamp,
        end_time: points[points.length - 1].timestamp,
        distance_m: lapDistM,
        duration_sec: lapDurSec,
        avg_pace_sec_per_km: avgPaceSecPerKm(lapDistM, lapDurSec),
        avg_speed_kph: avgSpeedKph(lapDistM, lapDurSec),
        avg_hr: avgHR,
        elevation_gain_m: computeElevationGain(points.slice(lapStartIndex)),
      });
    }
  }

  if (points.length === 0 && hrReadings.length === 0) {
    return emptyParseResult('TCX Import', type, 'tcx');
  }

  const firstTs = points[0]?.timestamp || hrReadings[0]?.timestamp || 0;
  const lastTs = (points.length > 1 ? points[points.length - 1].timestamp : 0)
    || (hrReadings.length > 1 ? hrReadings[hrReadings.length - 1].timestamp : 0)
    || 0;

  const startTime = firstTs ? new Date(firstTs) : null;
  const endTime = lastTs && lastTs !== firstTs ? new Date(lastTs) : null;

  const durationSec = startTime && endTime
    ? (endTime.getTime() - startTime.getTime()) / 1000
    : 0;

  const name = `${sport.charAt(0).toUpperCase() + sport.slice(1)} - TCX Import`;

  return {
    name,
    type,
    sourceFormat: 'tcx',
    points,
    hrReadings,
    cadenceReadings,
    powerReadings: [],
    laps,
    startTime,
    endTime,
    totalDistanceM,
    durationSec,
    elevationGainM: computeElevationGain(points),
  };
}
