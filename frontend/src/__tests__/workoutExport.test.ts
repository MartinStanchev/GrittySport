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

// ── buildTCX: lap boundary handling ─────────────────────────────────────────────
//
// Stored `gps_route.laps` only cover recording-time auto/manual laps, and each lap's
// start_time is set to the previous lap's end_time (the trigger point is shared). Two
// regressions this guards against:
//   1. Trackpoints after the last stored lap's end were silently dropped.
//   2. The shared boundary point between two adjacent laps was emitted (and its
//      distance double-counted) in both laps' <Track>.

function makeLappedWorkout(opts: {
  tailPoints?: { timestamp: number; distance_from_prev: number }[];
  finishedAtMs?: number;
} = {}): WorkoutResponse {
  // Two laps sharing an exact boundary at T0+60_000, matching real triggerLap output
  // (lap2.start_time === lap1.end_time).
  const basePoints = [
    { lat: 51.5074, lng: -0.1278, altitude: 10, accuracy: 5, speed: 2.5, timestamp: T0, distance_from_prev: 0 },
    { lat: 51.5080, lng: -0.1270, altitude: 12, accuracy: 5, speed: 2.7, timestamp: T0 + 30_000, distance_from_prev: 80 },
    { lat: 51.5085, lng: -0.1265, altitude: 13, accuracy: 5, speed: 2.8, timestamp: T0 + 60_000, distance_from_prev: 80 }, // lap boundary
    { lat: 51.5090, lng: -0.1260, altitude: 15, accuracy: 5, speed: 3.0, timestamp: T0 + 90_000, distance_from_prev: 70 },
    { lat: 51.5095, lng: -0.1255, altitude: 16, accuracy: 5, speed: 3.0, timestamp: T0 + 120_000, distance_from_prev: 70 },
  ];
  const tail = (opts.tailPoints ?? []).map((p, i) => ({
    lat: 51.51 + i * 0.001,
    lng: -0.125 + i * 0.001,
    altitude: 17,
    accuracy: 5,
    speed: 3.0,
    timestamp: p.timestamp,
    distance_from_prev: p.distance_from_prev,
  }));
  const points = [...basePoints, ...tail];
  const finishedAtMs = opts.finishedAtMs ?? points[points.length - 1].timestamp;

  const route: any = {
    sport: 'run',
    distance_km: 0.3,
    duration_sec: (finishedAtMs - T0) / 1000,
    avg_pace_sec_per_km: 500,
    avg_speed_kph: 7,
    elevation_gain_m: 6,
    points,
    laps: [
      { lap_number: 1, start_time: T0, end_time: T0 + 60_000, distance_m: 160, duration_sec: 60, avg_pace_sec_per_km: 375, avg_speed_kph: 9.6, elevation_gain_m: 2 },
      { lap_number: 2, start_time: T0 + 60_000, end_time: T0 + 120_000, distance_m: 140, duration_sec: 60, avg_pace_sec_per_km: 429, avg_speed_kph: 8.4, elevation_gain_m: 2 },
    ],
  };

  return {
    id: 'w-lapped',
    user_id: 'u1',
    activity_type: 'run',
    recorded_data: {},
    source: 'gps',
    started_at: new Date(T0).toISOString(),
    finished_at: new Date(finishedAtMs).toISOString(),
    gps_route: route,
    heart_rate_data: undefined,
    created_at: '',
    updated_at: '',
  };
}

describe('buildTCX lap boundary handling', () => {
  it('includes tail trackpoints after the last stored lap in a synthetic final lap', () => {
    const tailPoints = [
      { timestamp: T0 + 150_000, distance_from_prev: 60 },
      { timestamp: T0 + 180_000, distance_from_prev: 55 },
    ];
    const workout = makeLappedWorkout({ tailPoints });
    const xml = buildTCX(workout);

    // 2 stored laps + 1 synthetic tail lap.
    const lapMatches = [...xml.matchAll(/<Lap StartTime="([^"]+)">/g)];
    expect(lapMatches).toHaveLength(3);

    // The tail lap's StartTime must equal the last stored lap's end time.
    const tailLapStart = lapMatches[2][1];
    expect(tailLapStart).toBe(new Date(T0 + 120_000).toISOString());

    // Tail points must be present in the output.
    expect(xml).toContain(isoTimeOf(T0 + 150_000));
    expect(xml).toContain(isoTimeOf(T0 + 180_000));

    // Total trackpoints across the whole document = total points (5 base + 2 tail).
    const trackpointCount = (xml.match(/<Trackpoint>/g) ?? []).length;
    expect(trackpointCount).toBe(7);
  });

  it('does not add an empty tail lap when the last stored lap already ends at the final point', () => {
    const workout = makeLappedWorkout(); // no tail points, finishedAtMs === last point timestamp
    const xml = buildTCX(workout);

    const lapMatches = xml.match(/<Lap StartTime/g);
    expect(lapMatches).toHaveLength(2);

    // No boundary duplication either: 5 points in, 5 trackpoints out.
    const trackpointCount = (xml.match(/<Trackpoint>/g) ?? []).length;
    expect(trackpointCount).toBe(5);
  });

  it('emits the shared lap-boundary point exactly once', () => {
    const workout = makeLappedWorkout();
    const xml = buildTCX(workout);

    // The boundary timestamp legitimately also appears once more as lap 2's
    // <Lap StartTime> attribute (unchanged, per spec) — so scope the count to
    // <Time> elements inside <Trackpoint>s specifically.
    const boundaryTimeTag = `<Time>${isoTimeOf(T0 + 60_000)}</Time>`;
    const occurrences = xml.split(boundaryTimeTag).length - 1;
    expect(occurrences).toBe(1);
  });

  it('does not double-count the boundary point distance across laps', () => {
    const workout = makeLappedWorkout();
    const xml = buildTCX(workout);

    // Extract each lap's <Track> block and its last cumulative <DistanceMeters> value —
    // that's the lap's total rendered trackpoint distance, which must not include the
    // other lap's share of the boundary point's leg.
    const lapBlocks = [...xml.matchAll(/<Track>([\s\S]*?)<\/Track>/g)].map((m) => m[1]);
    expect(lapBlocks).toHaveLength(2);
    const lastDistanceOf = (block: string) => {
      const matches = [...block.matchAll(/<DistanceMeters>([\d.]+)<\/DistanceMeters>/g)];
      return parseFloat(matches[matches.length - 1][1]);
    };
    // Lap 1 track: points at T0, T0+30s, T0+60s (boundary) → cumulative distance 0+80+80=160.
    expect(lastDistanceOf(lapBlocks[0])).toBeCloseTo(160, 1);
    // Lap 2 track: points at T0+90s, T0+120s only (boundary point excluded here, kept in
    // lap 1 above) → cumulative 70+70=140.
    expect(lastDistanceOf(lapBlocks[1])).toBeCloseTo(140, 1);
  });

  it('fallback single-lap export (no stored laps) remains unchanged — all points emitted once', () => {
    const workout = makeGPSWorkout(); // withLaps: false by default
    const xml = buildTCX(workout);

    const lapMatches = xml.match(/<Lap StartTime/g);
    expect(lapMatches).toHaveLength(1);
    const trackpointCount = (xml.match(/<Trackpoint>/g) ?? []).length;
    expect(trackpointCount).toBe(3); // makeGPSWorkout has 3 points
  });
});

function isoTimeOf(ms: number): string {
  return new Date(ms).toISOString();
}
