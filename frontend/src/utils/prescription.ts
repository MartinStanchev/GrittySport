import { formatPaceSecPerKm } from '../services/gpsUtils';

// Prescriptions store measurable values as numbers in metric base units
// (distance_m, duration_sec, pace_sec_per_km, pace_sec_per_100m, weight_kg,
// rest_sec). These helpers turn them into display strings.

export type Rx = Record<string, any>;

export type ProgressionField = 'distance_m' | 'duration_sec' | 'reps' | 'sets' | 'weight_kg';

/** Week-over-week progression rule of a recurring activity (see backend models.ProgressionRule). */
export interface ProgressionRule {
  field: ProgressionField;
  exercise?: string;
  set_index?: number;
  percent?: number;
  step?: number;
  max?: number;
  round?: number;
}

function trimNumber(n: number, decimals = 2): string {
  return String(Number(n.toFixed(decimals)));
}

function isPositive(v: unknown): v is number {
  return typeof v === 'number' && v > 0;
}

export function formatDistanceM(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${trimNumber(meters / 1000)} km`;
}

export function formatDurationSec(seconds: number): string {
  const total = Math.round(seconds);
  if (total < 120) return `${total} s`;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return s > 0 ? `${m}:${String(s).padStart(2, '0')} min` : `${m} min`;
}

function formatPacePerKm(secPerKm: number): string {
  return `${formatPaceSecPerKm(secPerKm)}/km`;
}

function formatPacePer100m(secPer100m: number): string {
  return `${formatPaceSecPerKm(secPer100m)}/100m`;
}

function formatWeightKg(kg: number): string {
  return `${trimNumber(kg)} kg`;
}

function plural(n: number, word: string): string {
  return `${trimNumber(n)} ${word}${n === 1 ? '' : 's'}`;
}

/** Formats a value of a progressable field, e.g. distance_m 12000 → "12 km". */
function formatProgressionValue(field: ProgressionField, value: number): string {
  switch (field) {
    case 'distance_m':
      return formatDistanceM(value);
    case 'duration_sec':
      return formatDurationSec(value);
    case 'weight_kg':
      return formatWeightKg(value);
    case 'reps':
      return plural(value, 'rep');
    case 'sets':
      return plural(value, 'set');
  }
}

function progressionTarget(rule: ProgressionRule): string {
  const target = rule.exercise ?? (rule.set_index !== undefined ? `Set ${rule.set_index + 1}` : '');
  return target ? `${target} ` : '';
}

function progressionRate(rule: ProgressionRule): string {
  const amount = isPositive(rule.percent)
    ? `${trimNumber(rule.percent)}%`
    : formatProgressionValue(rule.field, rule.step ?? 0);
  return `+${amount}/wk`;
}

/** Short label for a rule, e.g. "+10%/wk", "Squat +2.5 kg/wk". */
export function describeProgression(rule: ProgressionRule): string {
  return `${progressionTarget(rule)}${progressionRate(rule)}`;
}

/**
 * First-week-to-peak range of weekly values, e.g. "10 km → 13.3 km", or the
 * single value when there's no growth. Deload dips don't hide the ramp.
 */
export function formatRange(values: number[], format: (v: number) => string): string {
  const start = values[0];
  const peak = Math.max(...values);
  return peak > start ? `${format(start)} → ${format(peak)}` : format(start);
}

/** Label for a rule with its planned values, e.g. "10 km → 13.3 km · +10%/wk". */
export function describeProgressionRange(rule: ProgressionRule, values: number[] | undefined): string {
  if (!values || values.length === 0) return describeProgression(rule);
  const range = formatRange(values, (v) => formatProgressionValue(rule.field, v));
  return `${progressionTarget(rule)}${range} · ${progressionRate(rule)}`;
}

/** e.g. "Deload wk 4, 8 · −35% volume"; empty when the phase has no deload weeks. */
export function formatDeload(weeks: number[] | undefined, pct: number | undefined): string {
  if (!weeks || weeks.length === 0 || !pct) return '';
  return `Deload wk ${weeks.join(', ')} · −${pct}% volume`;
}

export function hasSets(rx: Rx): boolean {
  return Array.isArray(rx.sets) && rx.sets.length > 0;
}

/** Human label for a prescription key, unit suffix dropped: "pace_sec_per_km" → "Pace Sec Per Km", "weight_kg" → "Weight". */
export function fieldLabel(key: string): string {
  return key.replace(/_(m|sec|kg|w)$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Planned session distance in meters (distance_m, then total_distance_m), or null. */
export function prescriptionDistanceM(prescription: Rx | undefined): number | null {
  if (!prescription) return null;
  if (isPositive(prescription.distance_m)) return prescription.distance_m;
  if (isPositive(prescription.total_distance_m)) return prescription.total_distance_m;
  return null;
}

/** Short duration / distance strings for a row subtitle; empty when the prescription has neither. */
export function prescriptionPrimaryStats(prescription: Rx | undefined): string[] {
  if (!prescription) return [];
  const stats: string[] = [];
  if (isPositive(prescription.duration_sec)) stats.push(formatDurationSec(prescription.duration_sec));
  const distance = prescriptionDistanceM(prescription);
  if (distance !== null) stats.push(formatDistanceM(distance));
  return stats;
}

/** One-line summary, e.g. "8 km at 5:30/km", "6 × 800 m", "4 exercises". */
export function formatPrescriptionSummary(prescription: Rx | undefined): string {
  if (!prescription) return '';
  const distance = prescriptionDistanceM(prescription);
  if (distance !== null && isPositive(prescription.pace_sec_per_km)) {
    return `${formatDistanceM(distance)} at ${formatPacePerKm(prescription.pace_sec_per_km)}`;
  }
  if (distance !== null) return formatDistanceM(distance);
  if (Array.isArray(prescription.exercises)) return plural(prescription.exercises.length, 'exercise');
  if (Array.isArray(prescription.sets) && prescription.sets.length > 0) {
    const first = prescription.sets[0] ?? {};
    const size = isPositive(first.distance_m)
      ? formatDistanceM(first.distance_m)
      : isPositive(first.duration_sec)
        ? formatDurationSec(first.duration_sec)
        : '';
    if (size) return first.reps ? `${first.reps} × ${size}` : size;
  }
  if (isPositive(prescription.duration_sec)) return formatDurationSec(prescription.duration_sec);
  return '';
}

// ─── Editor input codecs ────────────────────────────────────────────
// Convert between a stored base-unit number and what the user types.

export interface InputCodec {
  unit: string;
  keyboard: 'numeric' | 'decimal-pad' | 'numbers-and-punctuation';
  toInput: (value: number) => string;
  fromInput: (text: string) => number | undefined;
}

function parseNumber(text: string): number | undefined {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** Parses "m:ss" (or plain minutes) into seconds. */
export function parseMinSec(text: string): number | undefined {
  const [minPart, secPart] = text.trim().split(':');
  const min = parseNumber(minPart ?? '');
  if (min === undefined) return undefined;
  const sec = secPart ? parseNumber(secPart) ?? 0 : 0;
  return Math.round(min * 60 + sec);
}

function scaled(unit: string, factor: number, keyboard: InputCodec['keyboard'] = 'decimal-pad'): InputCodec {
  return {
    unit,
    keyboard,
    toInput: (v) => trimNumber(v / factor, 3),
    fromInput: (t) => {
      const n = parseNumber(t);
      return n === undefined ? undefined : Math.round(n * factor * 100) / 100;
    },
  };
}

function minSec(unit: string): InputCodec {
  return { unit, keyboard: 'numbers-and-punctuation', toInput: formatPaceSecPerKm, fromInput: parseMinSec };
}

export const INPUT_CODECS = {
  km: scaled('km', 1000),
  meters: scaled('m', 1, 'numeric'),
  minutes: scaled('min', 60),
  seconds: scaled('s', 1, 'numeric'),
  kg: scaled('kg', 1),
  watts: scaled('W', 1, 'numeric'),
  count: { ...scaled('', 1, 'numeric'), fromInput: (t: string) => { const n = parseNumber(t); return n === undefined ? undefined : Math.round(n); } },
  rpe: scaled('', 1),
  pacePerKm: minSec('/km'),
  pacePer100m: minSec('/100m'),
} satisfies Record<string, InputCodec>;

/** Returns a copy of obj with key set to value, or removed when value is undefined. */
export function withField<T extends Rx>(obj: T, key: string, value: unknown): T {
  const next: Rx = { ...obj };
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next as T;
}

// ─── Field registry ─────────────────────────────────────────────────
// Every canonical numeric prescription key with its display formatter and
// default editor codec (editors may pick another unit, e.g. meters for set
// distances).

interface FieldSpec {
  format: (value: number) => string;
  codec: InputCodec;
}

export const PRESCRIPTION_FIELDS: Record<string, FieldSpec> = {
  distance_m: { format: formatDistanceM, codec: INPUT_CODECS.km },
  total_distance_m: { format: formatDistanceM, codec: INPUT_CODECS.km },
  duration_sec: { format: formatDurationSec, codec: INPUT_CODECS.minutes },
  rest_sec: { format: formatDurationSec, codec: INPUT_CODECS.seconds },
  pace_sec_per_km: { format: formatPacePerKm, codec: INPUT_CODECS.pacePerKm },
  pace_sec_per_100m: { format: formatPacePer100m, codec: INPUT_CODECS.pacePer100m },
  weight_kg: { format: formatWeightKg, codec: INPUT_CODECS.kg },
  power_w: { format: (w) => `${Math.round(w)} W`, codec: INPUT_CODECS.watts },
};

/** Display string for one prescription field, or undefined when absent. Numeric metric keys get units. */
export function formatPrescriptionField(obj: Rx | undefined, key: string): string | undefined {
  const value = obj?.[key];
  if (value === undefined || value === null || value === '') return undefined;
  const spec = PRESCRIPTION_FIELDS[key];
  if (spec && typeof value === 'number') return spec.format(value);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}
