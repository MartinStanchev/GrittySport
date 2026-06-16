import { applyGPSPoint, AUTO_PAUSE_POINT_COUNT, MAX_ACCURACY_METRES } from '../services/gpsReducer';
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
    slowPointCount: 0,
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
  it('ignores readings when not recording', () => {
    const paused = baseWorkout({ recordingState: 'paused' });
    expect(applyGPSPoint(paused, reading(0))).toBe(paused);
  });

  it('drops readings with poor accuracy', () => {
    const w = baseWorkout();
    const bad = reading(1, { accuracy: MAX_ACCURACY_METRES + 1 });
    expect(applyGPSPoint(w, bad)).toBe(w);
  });

  it('accumulates points and distance across readings', () => {
    const readings = [reading(0), reading(1), reading(2)];
    const result = readings.reduce(applyGPSPoint, baseWorkout());

    expect(result.points).toHaveLength(3);
    expect(result.totalDistanceM).toBeGreaterThan(10);
    // First point has no predecessor, the next two add distance.
    expect(result.points[0].distance_from_prev).toBe(0);
    expect(result.points[1].distance_from_prev).toBeGreaterThan(0);
  });

  it('replaying a buffered batch matches feeding readings one at a time', () => {
    const readings = [reading(0), reading(1), reading(2), reading(3)];

    const batched = readings.reduce(applyGPSPoint, baseWorkout());
    let oneByOne = baseWorkout();
    for (const r of readings) oneByOne = applyGPSPoint(oneByOne, r);

    expect(batched.totalDistanceM).toBeCloseTo(oneByOne.totalDistanceM, 6);
    expect(batched.points).toHaveLength(oneByOne.points.length);
  });

  it('auto-pauses after a run of near-stationary readings', () => {
    // All readings at the same coordinate → ~0 m/s.
    const still = (i: number): RawLocation => ({
      coords: { latitude: 40, longitude: -74, altitude: 100, accuracy: 5, speed: 0 },
      timestamp: START_MS + i * 1000,
    });

    let w = baseWorkout();
    w = applyGPSPoint(w, still(0)); // seeds first point
    for (let i = 1; i <= AUTO_PAUSE_POINT_COUNT; i++) {
      w = applyGPSPoint(w, still(i));
    }

    expect(w.recordingState).toBe('paused');
    expect(w.slowPointCount).toBe(0);
  });
});
