import { buildGPX, buildTCX, canExportWorkout, workoutHasGPS } from '../services/workoutExport';
import { parseGPXFile } from '../services/gpxParser';
import { parseTCXFile } from '../services/parsers/tcxParser';
import type { WorkoutResponse } from '../services/api';

// ── Fixtures ───────────────────────────────────────────────────────────────────

const T0 = Date.UTC(2024, 5, 1, 8, 0, 0); // 2024-06-01T08:00:00Z

function makeGPSWorkout(opts: Partial<{
  withHR: boolean;
  withCadence: boolean;
  withLaps: boolean;
  activityType: string;
}> = {}): WorkoutResponse {
  const points = [
    { lat: 51.5074, lng: -0.1278, altitude: 10, accuracy: 5, speed: 2.5, timestamp: T0, distance_from_prev: 0 },
    { lat: 51.5080, lng: -0.1270, altitude: 12, accuracy: 5, speed: 2.7, timestamp: T0 + 60_000, distance_from_prev: 92.3 },
    { lat: 51.5090, lng: -0.1260, altitude: 15, accuracy: 5, speed: 3.0, timestamp: T0 + 120_000, distance_from_prev: 135.8 },
  ];
  const route: any = {
    sport: 'run',
    distance_km: 0.228,
    duration_sec: 120,
    avg_pace_sec_per_km: 526,
    avg_speed_kph: 6.8,
    elevation_gain_m: 5,
    points,
    laps: [],
  };
  if (opts.withLaps) {
    route.laps = [
      { lap_number: 1, start_time: T0, end_time: T0 + 60_000, distance_m: 92.3, duration_sec: 60, avg_pace_sec_per_km: 650, avg_speed_kph: 5.5, elevation_gain_m: 2 },
      { lap_number: 2, start_time: T0 + 60_001, end_time: T0 + 120_000, distance_m: 135.8, duration_sec: 60, avg_pace_sec_per_km: 442, avg_speed_kph: 8.1, elevation_gain_m: 3 },
    ];
  }

  let heart_rate_data: any = undefined;
  if (opts.withHR || opts.withCadence) {
    heart_rate_data = { readings: [] };
    if (opts.withHR) {
      heart_rate_data.readings = [
        { bpm: 140, timestamp: T0 },
        { bpm: 152, timestamp: T0 + 60_000 },
        { bpm: 168, timestamp: T0 + 120_000 },
      ];
    }
    if (opts.withCadence) {
      heart_rate_data.cadence_readings = [
        { spm: 165, timestamp: T0 },
        { spm: 172, timestamp: T0 + 60_000 },
        { spm: 178, timestamp: T0 + 120_000 },
      ];
    }
  }

  return {
    id: 'w1',
    user_id: 'u1',
    activity_type: opts.activityType ?? 'run',
    recorded_data: {},
    source: 'gps',
    started_at: new Date(T0).toISOString(),
    finished_at: new Date(T0 + 120_000).toISOString(),
    gps_route: route,
    heart_rate_data,
    created_at: '',
    updated_at: '',
  };
}

function makeHROnlyWorkout(): WorkoutResponse {
  return {
    id: 'w-hr',
    user_id: 'u1',
    activity_type: 'strength',
    recorded_data: {},
    source: 'manual',
    started_at: new Date(T0).toISOString(),
    finished_at: new Date(T0 + 1800_000).toISOString(),
    heart_rate_data: {
      readings: [
        { bpm: 110, timestamp: T0 },
        { bpm: 135, timestamp: T0 + 600_000 },
        { bpm: 150, timestamp: T0 + 1200_000 },
        { bpm: 142, timestamp: T0 + 1800_000 },
      ],
    },
    created_at: '',
    updated_at: '',
  };
}

function makeStrengthOnlyWorkout(): WorkoutResponse {
  return {
    id: 'w-strength',
    user_id: 'u1',
    activity_type: 'strength',
    recorded_data: { exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }] }] },
    source: 'manual',
    started_at: new Date(T0).toISOString(),
    finished_at: new Date(T0 + 1800_000).toISOString(),
    created_at: '',
    updated_at: '',
  };
}

// ── canExportWorkout ───────────────────────────────────────────────────────────

describe('canExportWorkout', () => {
  it('returns true for GPS workouts', () => {
    expect(canExportWorkout(makeGPSWorkout())).toBe(true);
  });

  it('returns true for HR-only workouts', () => {
    expect(canExportWorkout(makeHROnlyWorkout())).toBe(true);
  });

  it('returns false for workouts without GPS or HR', () => {
    expect(canExportWorkout(makeStrengthOnlyWorkout())).toBe(false);
  });

  it('workoutHasGPS detects GPS presence correctly', () => {
    expect(workoutHasGPS(makeGPSWorkout())).toBe(true);
    expect(workoutHasGPS(makeHROnlyWorkout())).toBe(false);
  });
});

// ── buildGPX ───────────────────────────────────────────────────────────────────

describe('buildGPX', () => {
  it('produces valid GPX XML for a basic GPS workout', () => {
    const xml = buildGPX(makeGPSWorkout());
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<gpx');
    expect(xml).toContain('creator="Gritty Fitness"');
    expect(xml).toContain('<trkseg>');
    expect(xml).toContain('</gpx>');
  });

  it('round-trips through our own GPX parser', () => {
    const xml = buildGPX(makeGPSWorkout());
    const parsed = parseGPXFile(xml);
    expect(parsed.points).toHaveLength(3);
    expect(parsed.points[0].lat).toBeCloseTo(51.5074, 4);
    expect(parsed.points[0].lng).toBeCloseTo(-0.1278, 4);
    expect(parsed.points[0].altitude).toBeCloseTo(10, 1);
    expect(parsed.durationSec).toBe(120);
  });

  it('embeds HR readings via TrackPointExtension', () => {
    const xml = buildGPX(makeGPSWorkout({ withHR: true }));
    expect(xml).toContain('<gpxtpx:hr>140</gpxtpx:hr>');
    expect(xml).toContain('<gpxtpx:hr>152</gpxtpx:hr>');
    expect(xml).toContain('<gpxtpx:hr>168</gpxtpx:hr>');

    const parsed = parseGPXFile(xml);
    expect(parsed.hrReadings).toHaveLength(3);
    expect(parsed.hrReadings[0].bpm).toBe(140);
  });

  it('embeds cadence when available', () => {
    const xml = buildGPX(makeGPSWorkout({ withCadence: true }));
    expect(xml).toContain('<gpxtpx:cad>165</gpxtpx:cad>');
  });

  it('omits altitude when null', () => {
    const w = makeGPSWorkout();
    (w.gps_route as any).points[0].altitude = null;
    const xml = buildGPX(w);
    const firstTrkpt = xml.match(/<trkpt[^>]*>[^<]*<[^]*?<\/trkpt>/);
    expect(firstTrkpt).toBeTruthy();
    expect(firstTrkpt![0]).not.toContain('<ele>');
  });

  it('escapes special characters in activity_type', () => {
    const w = makeGPSWorkout({ activityType: 'trail & run' });
    const xml = buildGPX(w);
    expect(xml).toContain('trail &amp; run');
    expect(xml).not.toMatch(/<type>[^<]*&[^a]/); // no raw &
  });

  it('throws if workout has no GPS points', () => {
    expect(() => buildGPX(makeHROnlyWorkout())).toThrow(/GPS/);
  });
});

// ── buildTCX ───────────────────────────────────────────────────────────────────

describe('buildTCX', () => {
  it('produces a valid TCX document', () => {
    const xml = buildTCX(makeGPSWorkout());
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<TrainingCenterDatabase');
    expect(xml).toContain('<Activity Sport="Running">');
    expect(xml).toContain('<Creator');
    expect(xml).toContain('<Name>Gritty Fitness</Name>');
  });

  it('maps run → Running, cycling → Biking, swim → Other', () => {
    expect(buildTCX(makeGPSWorkout({ activityType: 'run' }))).toContain('Sport="Running"');
    expect(buildTCX(makeGPSWorkout({ activityType: 'cycling' }))).toContain('Sport="Biking"');
    expect(buildTCX(makeGPSWorkout({ activityType: 'swim' }))).toContain('Sport="Other"');
  });

  it('writes one Lap when no laps recorded', () => {
    const xml = buildTCX(makeGPSWorkout({ withHR: true }));
    const lapMatches = xml.match(/<Lap StartTime/g);
    expect(lapMatches).toHaveLength(1);
    expect(xml).toContain('<TotalTimeSeconds>120.0</TotalTimeSeconds>');
  });

  it('writes one Lap per recorded GPS lap', () => {
    const xml = buildTCX(makeGPSWorkout({ withLaps: true, withHR: true }));
    const lapMatches = xml.match(/<Lap StartTime/g);
    expect(lapMatches).toHaveLength(2);
  });

  it('cumulative DistanceMeters increases across trackpoints', () => {
    const xml = buildTCX(makeGPSWorkout());
    const distances = [...xml.matchAll(/<DistanceMeters>([\d.]+)<\/DistanceMeters>/g)]
      .map((m) => parseFloat(m[1]));
    // First is the Lap.DistanceMeters total, then per-Trackpoint cumulative
    const trackpointDistances = distances.slice(1);
    expect(trackpointDistances[0]).toBe(0);
    expect(trackpointDistances[1]).toBeGreaterThan(trackpointDistances[0]);
    expect(trackpointDistances[2]).toBeGreaterThan(trackpointDistances[1]);
  });

  it('embeds HR per Trackpoint', () => {
    const xml = buildTCX(makeGPSWorkout({ withHR: true }));
    expect(xml).toContain('<HeartRateBpm><Value>140</Value></HeartRateBpm>');
    expect(xml).toContain('<AverageHeartRateBpm><Value>153</Value></AverageHeartRateBpm>'); // avg of 140/152/168 = 153.3
    expect(xml).toContain('<MaximumHeartRateBpm><Value>168</Value></MaximumHeartRateBpm>');
  });

  it('embeds Cadence per Trackpoint', () => {
    const xml = buildTCX(makeGPSWorkout({ withCadence: true }));
    expect(xml).toContain('<Cadence>165</Cadence>');
    expect(xml).toContain('<Cadence>172</Cadence>');
  });

  it('round-trips through our own TCX parser (GPS + HR)', () => {
    const xml = buildTCX(makeGPSWorkout({ withHR: true }));
    const parsed = parseTCXFile(xml);
    expect(parsed.points.length).toBeGreaterThan(0);
    expect(parsed.hrReadings.length).toBeGreaterThan(0);
    expect(parsed.hrReadings[0].bpm).toBe(140);
  });

  it('exports HR-only workouts (no Position elements)', () => {
    const xml = buildTCX(makeHROnlyWorkout());
    expect(xml).toContain('Sport="Other"');
    expect(xml).toContain('<HeartRateBpm><Value>110</Value></HeartRateBpm>');
    expect(xml).not.toContain('<Position>');
    expect(xml).toContain('<TotalTimeSeconds>1800.0</TotalTimeSeconds>');
  });

  it('throws when there is no GPS and no HR data', () => {
    expect(() => buildTCX(makeStrengthOnlyWorkout())).toThrow(/GPS or HR/);
  });
});
