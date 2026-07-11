import {
  applyGPSPoint,
  AUTO_PAUSE_POINT_COUNT,
  AUTO_RESUME_POINT_COUNT,
  MAX_ACCURACY_METRES,
  RESUME_MAX_ACCURACY_METRES,
} from '../services/gpsReducer';
import type { RawLocation } from '../services/gpsReducer';
import type { ActiveGPSWorkout } from '../contexts/WorkoutContext';

const START_MS = 1_700_000_000_000;

function baseWorkout(overrides: Partial<ActiveGPSWorkout> = {}): ActiveGPSWorkout {
  return {
    activityType: 'run',
    activityDisplayType: 'Run',
    startedAt: new Date(START_MS),
    recordingState: 'recording',
    points: [],
    hrReadings: [],
    laps: [],
    lapStartIndex: 0,
    lapStartDistanceM: 0,
    totalDistanceM: 0,
    elevationGainM: 0,
    currentPaceSecPerKm: 0,
    avgPaceSecPerKm: 0,
    currentSpeedKph: 0,
    avgSpeedKph: 0,
    currentHR: null,
    avgHR: null,
    cadenceReadings: [],
    currentCadence: null,
    avgCadence: null,
    autoPausedDurationSec: 0,
    lastAutoPauseStart: null,
    autoPaused: false,
    slowPointCount: 0,
    movingPointCount: 0,
    workoutNotes: '',
    ...overrides,
  };
}

// A reading ~7 m north of the previous one each second → ~7 m/s (above the auto-pause
// threshold), so a sequence of these keeps recording.
function reading(index: number, opts: Partial<RawLocation['coords']> = {}): RawLocation {
  return {
    coords: {
      latitude: 40 + index * 0.0000628, // ~7 m per step
      longitude: -74,
      altitude: opts.altitude ?? 100,
      accuracy: opts.accuracy ?? 5,
      speed: opts.speed ?? 7,
    },
    timestamp: START_MS + index * 1000,
  };
}

describe('applyGPSPoint', () => {
  it('ignores readings while manually paused', () => {
    // A manual pause (autoPaused: false) is never auto-resumed.
    const paused = baseWorkout({ recordingState: 'paused', autoPaused: false });
    expect(applyGPSPoint(paused, reading(0))).toBe(paused);
  });

  it('drops readings with poor accuracy', () => {
    const w = baseWorkout();
    const bad = reading(1, { accuracy: MAX_ACCURACY_METRES + 1 });
    expect(applyGPSPoint(w, bad)).toBe(w);
  });

  it('accumulates points and distance across readings', () => {
    const readings = [reading(0), reading(1), reading(2)];
    const result = readings.reduce((w, r) => applyGPSPoint(w, r), baseWorkout());

    expect(result.points).toHaveLength(3);
    expect(result.totalDistanceM).toBeGreaterThan(10);
    // First point has no predecessor, the next two add distance.
    expect(result.points[0].distance_from_prev).toBe(0);
    expect(result.points[1].distance_from_prev).toBeGreaterThan(0);
  });

  it('replaying a buffered batch matches feeding readings one at a time', () => {
    const readings = [reading(0), reading(1), reading(2), reading(3)];

    const batched = readings.reduce((w, r) => applyGPSPoint(w, r), baseWorkout());
    let oneByOne = baseWorkout();
    for (const r of readings) oneByOne = applyGPSPoint(oneByOne, r);

    expect(batched.totalDistanceM).toBeCloseTo(oneByOne.totalDistanceM, 6);
    expect(batched.points).toHaveLength(oneByOne.points.length);
  });

  // All readings at the same coordinate → ~0 m/s.
  const still = (i: number): RawLocation => ({
    coords: { latitude: 40, longitude: -74, altitude: 100, accuracy: 5, speed: 0 },
    timestamp: START_MS + i * 1000,
  });

  // A reading `distanceM` due north of the pause spot (40, -74 — where `stationaryUntilPaused`
  // leaves the track), with a configurable accuracy, `idx` steps after the pause began.
  const DEG_PER_METRE = 1 / 111_194.9;
  function awayReading(distanceM: number, accuracy: number, idx: number): RawLocation {
    return {
      coords: {
        latitude: 40 + distanceM * DEG_PER_METRE,
        longitude: -74,
        altitude: 100,
        accuracy,
        speed: 3,
      },
      timestamp: START_MS + (AUTO_PAUSE_POINT_COUNT + idx) * 1000,
    };
  }

  function stationaryUntilPaused(): ReturnType<typeof baseWorkout> {
    let w = baseWorkout();
    w = applyGPSPoint(w, still(0)); // seeds first point
    for (let i = 1; i <= AUTO_PAUSE_POINT_COUNT; i++) {
      w = applyGPSPoint(w, still(i));
    }
    return w;
  }

  it('auto-pauses after a run of near-stationary readings', () => {
    const w = stationaryUntilPaused();

    expect(w.recordingState).toBe('paused');
    expect(w.autoPaused).toBe(true);
    expect(w.slowPointCount).toBe(0);
  });

  it('does not auto-pause when the setting is off', () => {
    let w = baseWorkout();
    for (let i = 0; i <= AUTO_PAUSE_POINT_COUNT + 2; i++) {
      w = applyGPSPoint(w, still(i), false);
    }

    expect(w.recordingState).toBe('recording');
  });

  it('auto-resumes after sustained movement away from the pause spot', () => {
    let w = stationaryUntilPaused();
    expect(w.recordingState).toBe('paused');

    // Each reading walks ~7 m/index further north — quickly clears the resume distance.
    for (let i = 1; i <= AUTO_RESUME_POINT_COUNT; i++) {
      w = applyGPSPoint(w, reading(i + AUTO_PAUSE_POINT_COUNT));
    }

    expect(w.recordingState).toBe('recording');
    expect(w.autoPaused).toBe(false);
    expect(w.movingPointCount).toBe(0);
  });

  it('does not auto-resume when the setting is off', () => {
    const paused = stationaryUntilPaused();
    const next = applyGPSPoint(paused, reading(AUTO_PAUSE_POINT_COUNT + 5), false);

    expect(next).toBe(paused);
  });

  it('auto-resumes on degraded-accuracy (60-90 m) fixes moving steadily away from the pause spot', () => {
    // Regression test for the deadlock bug: accuracy above MAX_ACCURACY_METRES (50) but
    // below RESUME_MAX_ACCURACY_METRES (100) must still be considered while paused, and
    // each fix clears its own accuracy-based threshold as it moves further away.
    let w = stationaryUntilPaused();
    expect(w.recordingState).toBe('paused');

    w = applyGPSPoint(w, awayReading(90, 60, 1));
    expect(w.recordingState).toBe('paused');
    w = applyGPSPoint(w, awayReading(150, 75, 2));
    expect(w.recordingState).toBe('paused');
    w = applyGPSPoint(w, awayReading(210, 90, 3));

    expect(w.recordingState).toBe('recording');
    expect(w.autoPaused).toBe(false);
  });

  it('ignores fixes worse than RESUME_MAX_ACCURACY_METRES while auto-paused, stays paused', () => {
    let w = stationaryUntilPaused();
    expect(w.recordingState).toBe('paused');

    for (let i = 1; i <= AUTO_RESUME_POINT_COUNT + 2; i++) {
      w = applyGPSPoint(w, awayReading(500, RESUME_MAX_ACCURACY_METRES + 1, i));
    }

    expect(w.recordingState).toBe('paused');
    expect(w.autoPaused).toBe(true);
  });

  it('stays paused when manually paused even with good, moving fixes', () => {
    const paused = baseWorkout({
      recordingState: 'paused',
      autoPaused: false,
      points: [
        { lat: 40, lng: -74, altitude: 100, accuracy: 5, speed: 0, timestamp: START_MS, distance_from_prev: 0 },
      ],
    });

    let w = paused;
    for (let i = 1; i <= AUTO_RESUME_POINT_COUNT; i++) {
      w = applyGPSPoint(w, awayReading(500, 5, i));
    }

    expect(w).toBe(paused);
    expect(w.recordingState).toBe('paused');
  });

  it('still drops fixes with accuracy > MAX_ACCURACY_METRES while recording (even within resume tolerance)', () => {
    const w = baseWorkout();
    const degraded = reading(1, { accuracy: RESUME_MAX_ACCURACY_METRES - 10 });
    expect(applyGPSPoint(w, degraded)).toBe(w);
  });

  it('does not auto-resume on noisy fixes jittering within the accuracy-scaled threshold', () => {
    // accuracy 80 m → resume threshold is max(AUTO_RESUME_DISTANCE_M, 80) = 80 m; fixes
    // 50 m from the pause spot never clear it, however many arrive.
    let w = stationaryUntilPaused();
    expect(w.recordingState).toBe('paused');

    for (let i = 1; i <= AUTO_RESUME_POINT_COUNT + 3; i++) {
      w = applyGPSPoint(w, awayReading(50, 80, i));
    }

    expect(w.recordingState).toBe('paused');
    expect(w.autoPaused).toBe(true);
    expect(w.movingPointCount).toBe(0);
  });
});
