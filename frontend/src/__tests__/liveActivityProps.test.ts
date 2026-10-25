import type { ActiveGPSWorkout, ActiveWorkout } from '../contexts/WorkoutContext';
import { buildWorkoutActivityProps } from '../utils/liveActivityProps';

const START_MS = 1_700_000_000_000;

function gpsWorkout(overrides: Partial<ActiveGPSWorkout> = {}): ActiveGPSWorkout {
  return {
    activityType: 'run',
    activityDisplayType: 'Run',
    startedAt: new Date(START_MS),
    recordingState: 'recording',
    points: [],
    hrReadings: [],
    laps: [],
    lapStartIndex: 0,
    totalDistanceM: 5234,
    elevationGainM: 0,
    currentPaceSecPerKm: 330,
    avgPaceSecPerKm: 340,
    currentSpeedKph: 10.9,
    avgSpeedKph: 10.6,
    currentHR: 152,
    avgHR: 148,
    cadenceReadings: [],
    currentCadence: null,
    avgCadence: null,
    pausedDurationSec: 0,
    lastPauseStart: null,
    pausedSecAtLastPoint: 0,
    autoPaused: false,
    slowPointCount: 0,
    movingPointCount: 0,
    workoutNotes: '',
    ...overrides,
  };
}

function manualWorkout(overrides: Partial<ActiveWorkout> = {}): ActiveWorkout {
  return {
    workoutType: 'strength',
    activityType: 'strength_training',
    activityDisplayType: 'Strength',
    startedAt: new Date(START_MS),
    phase: 'recording',
    strengthExercises: [],
    mobilityExercises: [],
    drillName: '',
    drillDescription: '',
    drillNotes: '',
    workoutNotes: '',
    hrReadings: [],
    currentHR: null,
    avgHR: null,
    pausedDurationSec: 0,
    lastPauseStart: null,
    ...overrides,
  };
}

describe('buildWorkoutActivityProps', () => {
  it('is null when nothing is recording', () => {
    expect(buildWorkoutActivityProps(null, null, 'heart_rate')).toBeNull();
    expect(buildWorkoutActivityProps(null, gpsWorkout({ recordingState: 'idle' }), 'pace')).toBeNull();
    expect(buildWorkoutActivityProps(null, gpsWorkout({ recordingState: 'stopped' }), 'pace')).toBeNull();
    expect(buildWorkoutActivityProps(manualWorkout({ phase: 'summary' }), null, 'heart_rate')).toBeNull();
  });

  it('formats GPS run stats and uses the chosen compact metric', () => {
    const props = buildWorkoutActivityProps(null, gpsWorkout(), 'distance');
    expect(props).toMatchObject({
      title: 'Run',
      icon: 'figure.run',
      statusLabel: null,
      compact: { label: 'Distance', value: '5.23', unit: 'km' },
      stats: [
        { label: 'Distance', value: '5.23', unit: 'km' },
        { label: 'Pace', value: '5:30', unit: '/km' },
        { label: 'HR', value: '152', unit: 'bpm' },
      ],
    });
    expect(buildWorkoutActivityProps(null, gpsWorkout(), 'pace')?.compact?.label).toBe('Pace');
    expect(buildWorkoutActivityProps(null, gpsWorkout(), 'heart_rate')?.compact?.label).toBe('HR');
  });

  it('shows speed instead of pace for non-run GPS sports', () => {
    const props = buildWorkoutActivityProps(
      null,
      gpsWorkout({ activityType: 'cycling', activityDisplayType: 'Cycling', currentSpeedKph: 28.456 }),
      'pace',
    );
    expect(props?.icon).toBe('figure.outdoor.cycle');
    expect(props?.compact).toEqual({ label: 'Speed', value: '28.46', unit: 'km/h' });
  });

  it('falls back to the next available metric when the chosen one is missing', () => {
    // No HR strap on a GPS run → pace.
    expect(
      buildWorkoutActivityProps(null, gpsWorkout({ currentHR: null }), 'heart_rate')?.compact?.label,
    ).toBe('Pace');
    // Manual workouts have no pace/distance → HR.
    expect(
      buildWorkoutActivityProps(manualWorkout({ currentHR: 120 }), null, 'distance')?.compact,
    ).toEqual({ label: 'HR', value: '120', unit: 'bpm' });
  });

  it('has no compact metric or stats for a manual workout without an HR strap', () => {
    const props = buildWorkoutActivityProps(manualWorkout(), null, 'heart_rate');
    expect(props).toMatchObject({ title: 'Strength', icon: 'dumbbell.fill', compact: null, stats: [] });
  });

  it('shifts the clock by closed pauses and freezes it during an open pause', () => {
    const running = buildWorkoutActivityProps(null, gpsWorkout({ pausedDurationSec: 42.5 }), 'pace');
    expect(running?.timerStartMs).toBe(START_MS + 42_500);
    expect(running?.pausedAtMs).toBeNull();

    const pauseStart = START_MS + 600_000;
    const autoPaused = buildWorkoutActivityProps(
      null,
      gpsWorkout({ recordingState: 'paused', lastPauseStart: pauseStart, autoPaused: true }),
      'pace',
    );
    expect(autoPaused).toMatchObject({ pausedAtMs: pauseStart, statusLabel: 'Auto-paused' });

    const manualPaused = buildWorkoutActivityProps(manualWorkout({ lastPauseStart: pauseStart }), null, 'heart_rate');
    expect(manualPaused).toMatchObject({ pausedAtMs: pauseStart, statusLabel: 'Paused' });
  });

  it('survives JSON serialization unchanged (props cross into the widget runtime as JSON)', () => {
    const props = buildWorkoutActivityProps(null, gpsWorkout(), 'heart_rate');
    expect(JSON.parse(JSON.stringify(props))).toEqual(props);
  });
});
