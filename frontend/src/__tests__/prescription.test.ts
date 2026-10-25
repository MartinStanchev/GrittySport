import {
  describeProgression,
  describeProgressionRange,
  fieldLabel,
  formatDeload,
  formatDistanceM,
  formatDurationSec,
  formatPrescriptionField,
  formatPrescriptionSummary,
  formatRange,
  INPUT_CODECS,
  parseMinSec,
  prescriptionPrimaryStats,
  withField,
} from '../utils/prescription';

describe('formatters', () => {
  it('formats distances in m below 1 km and km above', () => {
    expect(formatDistanceM(400)).toBe('400 m');
    expect(formatDistanceM(12100)).toBe('12.1 km');
  });

  it('formats durations by magnitude', () => {
    expect(formatDurationSec(90)).toBe('90 s');
    expect(formatDurationSec(150)).toBe('2:30 min');
    expect(formatDurationSec(1800)).toBe('30 min');
    expect(formatDurationSec(3600)).toBe('1 h');
    expect(formatDurationSec(3900)).toBe('1 h 5 min');
  });

  it('labels keys without their unit suffix', () => {
    expect(fieldLabel('weight_kg')).toBe('Weight');
    expect(fieldLabel('heart_rate_zone')).toBe('Heart Rate Zone');
  });

  it('formats known numeric fields with units and passes others through', () => {
    expect(formatPrescriptionField({ weight_kg: 82.5 }, 'weight_kg')).toBe('82.5 kg');
    expect(formatPrescriptionField({ pace_sec_per_km: 330 }, 'pace_sec_per_km')).toBe('5:30/km');
    expect(formatPrescriptionField({ pace_sec_per_100m: 105 }, 'pace_sec_per_100m')).toBe('1:45/100m');
    expect(formatPrescriptionField({ intensity: 'Zone 2' }, 'intensity')).toBe('Zone 2');
    expect(formatPrescriptionField({}, 'distance_m')).toBeUndefined();
  });
});

describe('prescription summaries', () => {
  it('summarizes distance with pace', () => {
    expect(formatPrescriptionSummary({ distance_m: 8000, pace_sec_per_km: 330 })).toBe('8 km at 5:30/km');
  });

  it('summarizes intervals, exercises and duration-only sessions', () => {
    expect(formatPrescriptionSummary({ sets: [{ reps: 6, distance_m: 800 }] })).toBe('6 × 800 m');
    expect(formatPrescriptionSummary({ exercises: [{}, {}] })).toBe('2 exercises');
    expect(formatPrescriptionSummary({ duration_sec: 2700 })).toBe('45 min');
    expect(formatPrescriptionSummary(undefined)).toBe('');
  });

  it('lists primary stats, falling back to total distance', () => {
    expect(prescriptionPrimaryStats({ duration_sec: 3600, total_distance_m: 2500 })).toEqual(['1 h', '2.5 km']);
    expect(prescriptionPrimaryStats({ intensity: 'easy' })).toEqual([]);
  });
});

describe('progression labels', () => {
  it('describes percent and step rules', () => {
    expect(describeProgression({ field: 'distance_m', percent: 10 })).toBe('+10%/wk');
    expect(describeProgression({ field: 'weight_kg', exercise: 'Squat', step: 2.5 })).toBe('Squat +2.5 kg/wk');
    expect(describeProgression({ field: 'reps', set_index: 0, step: 1 })).toBe('Set 1 +1 rep/wk');
  });

  it('shows the start-to-peak range, ignoring deload dips', () => {
    expect(describeProgressionRange({ field: 'distance_m', percent: 10 }, [10000, 11000, 12100, 8600]))
      .toBe('10 km → 12.1 km · +10%/wk');
    expect(describeProgressionRange({ field: 'weight_kg', exercise: 'Squat', step: 2.5 }, [60, 62.5, 65]))
      .toBe('Squat 60 kg → 65 kg · +2.5 kg/wk');
  });

  it('falls back to the plain rule without values', () => {
    expect(describeProgressionRange({ field: 'duration_sec', step: 300 }, undefined)).toBe('+5 min/wk');
  });

  it('formats deload weeks', () => {
    expect(formatDeload([4, 8], 35)).toBe('Deload wk 4, 8 · −35% volume');
    expect(formatDeload([], 40)).toBe('');
  });

  it('formats a first-to-peak range', () => {
    expect(formatRange([15000, 16000, 17100, 11900], formatDistanceM)).toBe('15 km → 17.1 km');
    expect(formatRange([3600, 3600], formatDurationSec)).toBe('1 h');
  });
});

describe('input codecs', () => {
  it('parses m:ss and plain minutes', () => {
    expect(parseMinSec('5:30')).toBe(330);
    expect(parseMinSec('5')).toBe(300);
    expect(parseMinSec('5:3')).toBe(303);
    expect(parseMinSec('abc')).toBeUndefined();
  });

  it('round-trips scaled units', () => {
    expect(INPUT_CODECS.km.fromInput('5.5')).toBe(5500);
    expect(INPUT_CODECS.km.fromInput('5,5')).toBe(5500);
    expect(INPUT_CODECS.km.toInput(5500)).toBe('5.5');
    expect(INPUT_CODECS.minutes.fromInput('45')).toBe(2700);
    expect(INPUT_CODECS.minutes.toInput(2700)).toBe('45');
    expect(INPUT_CODECS.pacePerKm.toInput(330)).toBe('5:30');
  });

  it('rejects empty and negative input and rounds counts', () => {
    expect(INPUT_CODECS.kg.fromInput('')).toBeUndefined();
    expect(INPUT_CODECS.kg.fromInput('-5')).toBeUndefined();
    expect(INPUT_CODECS.count.fromInput('3.6')).toBe(4);
  });

  it('withField sets and removes keys without mutating', () => {
    const base = { distance_m: 5000, pace_sec_per_km: 330 };
    expect(withField(base, 'distance_m', 6000)).toEqual({ distance_m: 6000, pace_sec_per_km: 330 });
    expect(withField(base, 'pace_sec_per_km', undefined)).toEqual({ distance_m: 5000 });
    expect(base).toEqual({ distance_m: 5000, pace_sec_per_km: 330 });
  });
});
