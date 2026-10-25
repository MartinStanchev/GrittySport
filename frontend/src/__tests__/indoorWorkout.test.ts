import { buildIndoorLap, buildIndoorRecordedData, closeFinalIndoorLap, type IndoorLap } from '../utils/indoorWorkout';
import { calorieProfile, estimateCalories, summarizeHR } from '../services/gpsUtils';
import { getRecordScreen, isGPSActivity, isIndoorCardioActivity } from '../constants/activityIcons';
import type { HRReading } from '../types/gps';

const START_MS = Date.UTC(2026, 9, 25, 7, 0, 0);
const at = (sec: number) => START_MS + sec * 1000;

function session(overrides: { laps?: IndoorLap[]; hrReadings?: HRReading[]; pausedDurationSec?: number; lastPauseStart?: number | null } = {}) {
  return {
    startedAt: new Date(START_MS),
    pausedDurationSec: 0,
    lastPauseStart: null,
    laps: [],
    hrReadings: [],
    ...overrides,
  };
}

describe('buildIndoorLap', () => {
  test('first lap runs from the start and averages the HR inside it', () => {
    const hrReadings = [
      { bpm: 120, timestamp: at(10) },
      { bpm: 140, timestamp: at(100) },
      { bpm: 170, timestamp: at(400) }, // after the lap — excluded
    ];
    const lap = buildIndoorLap(session({ hrReadings }), at(300));
    expect(lap).toEqual({
      lap_number: 1,
      start_time: START_MS,
      end_time: at(300),
      duration_sec: 300,
      avg_hr: 130,
    });
  });

  test('later laps start at the previous lap end and exclude paused time', () => {
    const first = buildIndoorLap(session(), at(300))!;
    // 60 s paused during the second lap
    const lap = buildIndoorLap(session({ laps: [first], pausedDurationSec: 60 }), at(600));
    expect(lap).toMatchObject({ lap_number: 2, start_time: at(300), duration_sec: 240 });
    expect(lap?.avg_hr).toBeUndefined();
  });

  test('ignores a double tap under a second', () => {
    const first = buildIndoorLap(session(), at(300))!;
    expect(buildIndoorLap(session({ laps: [first] }), at(300.5))).toBeNull();
  });
});

describe('closeFinalIndoorLap', () => {
  test('no Lap presses means no laps', () => {
    expect(closeFinalIndoorLap(session(), at(1200))).toEqual([]);
  });

  test('closes the stretch after the last press into a final lap', () => {
    const first = buildIndoorLap(session(), at(300))!;
    const laps = closeFinalIndoorLap(session({ laps: [first] }), at(500));
    expect(laps.map((l) => [l.lap_number, l.duration_sec])).toEqual([[1, 300], [2, 200]]);
  });
});

describe('buildIndoorRecordedData', () => {
  test('includes HR summary, calories and rounded laps', () => {
    const laps: IndoorLap[] = [
      { lap_number: 1, start_time: START_MS, end_time: at(300.4), duration_sec: 300.4, avg_hr: 130 },
      { lap_number: 2, start_time: at(300.4), end_time: at(500), duration_sec: 199.6 },
    ];
    const data = buildIndoorRecordedData({
      hrReadings: [{ bpm: 120, timestamp: at(1) }, { bpm: 150, timestamp: at(2) }],
      laps,
      calories: 210,
    });
    expect(data).toEqual({
      avg_hr: 135,
      max_hr: 150,
      calories: 210,
      laps: [
        { ...laps[0], duration_sec: 300 },
        { ...laps[1], duration_sec: 200 },
      ],
    });
  });

  test('omits empty HR, zero calories and no laps', () => {
    expect(buildIndoorRecordedData({ hrReadings: [], laps: [], calories: 0 })).toEqual({});
  });
});

describe('summarizeHR', () => {
  test('returns avg and max, or nothing without readings', () => {
    expect(summarizeHR([])).toEqual({});
    expect(summarizeHR([{ bpm: 100, timestamp: 1 }, { bpm: 151, timestamp: 2 }])).toEqual({ avg_hr: 126, max_hr: 151 });
  });
});

describe('estimateCalories', () => {
  test('uses the HR equation when an average heart rate is known', () => {
    // (-37.7496 + 0.53905*150 + 0.03625*75 + 0.13785*35) / 4.184 ≈ 12.106 kcal/min
    expect(estimateCalories({
      activityType: 'indoor_run',
      durationSec: 3600,
      avgHR: 150,
      profile: { weightKg: 75, age: 35 },
    })).toBe(726);
  });

  test('falls back to the sport MET value without HR', () => {
    expect(estimateCalories({ activityType: 'indoor_cycling', durationSec: 3600, profile: { weightKg: 80 } })).toBe(560);
    expect(estimateCalories({ activityType: 'indoor_run', durationSec: 1800 })).toBe(315);
  });

  test('is zero for no duration', () => {
    expect(estimateCalories({ activityType: 'run', durationSec: 0, avgHR: 150 })).toBe(0);
  });

  test('derives age and weight from the profile', () => {
    expect(calorieProfile({ weight_kg: 68, birth_year: 1990 }, new Date(2026, 0, 1))).toEqual({ weightKg: 68, age: 36 });
    expect(calorieProfile(null)).toEqual({ weightKg: undefined, age: undefined });
  });
});

describe('indoor cardio routing', () => {
  test('indoor run and ride record on the indoor screen, not GPS', () => {
    expect(isIndoorCardioActivity('indoor_run')).toBe(true);
    expect(isIndoorCardioActivity('Indoor Cycling')).toBe(true);
    expect(isGPSActivity('indoor_run')).toBe(false);
    expect(getRecordScreen('indoor_cycling')).toBe('RecordIndoor');
    expect(getRecordScreen('run')).toBe('RecordGPS');
    expect(getRecordScreen('strength_training')).toBe('RecordManual');
  });
});
