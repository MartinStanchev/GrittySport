import { Ionicons } from '@expo/vector-icons';

// Canonical activity types — snake_case, used by both frontend and backend.
// Run/cycle/swim sub-flavors (easy/long/tempo/interval/trail) are encoded in
// the activity's notes + prescription, not as separate types.
export const ACTIVITY_TYPES = [
  'run',
  'walk',
  'cycling',
  'swim',
  'open_water_swim',
  'indoor_run',
  'indoor_cycling',
  'strength_training',
  'mobility',
  'yoga',
  'recovery',
  'rest',
  'drill',
  'cross_training',
  'outdoor_activity',
  'indoor_activity',
] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  run: 'walk-outline',
  walk: 'walk-outline',
  cycling: 'bicycle-outline',
  swim: 'water-outline',
  open_water_swim: 'water-outline',
  indoor_run: 'walk-outline',
  indoor_cycling: 'bicycle-outline',
  strength_training: 'barbell-outline',
  mobility: 'body-outline',
  yoga: 'body-outline',
  recovery: 'bed-outline',
  rest: 'bed-outline',
  drill: 'flag-outline',
  cross_training: 'fitness-outline',
  outdoor_activity: 'sunny-outline',
  indoor_activity: 'home-outline',
};

export function getActivityIcon(type: string): keyof typeof Ionicons.glyphMap {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  for (const [key, icon] of Object.entries(ACTIVITY_ICONS)) {
    if (normalized.includes(key)) return icon;
  }
  return 'fitness-outline';
}

export function formatPrescriptionSummary(prescription: Record<string, any>): string {
  if (!prescription) return '';
  if (prescription.distance && prescription.pace) {
    return `${prescription.distance} at ${prescription.pace}`;
  }
  if (prescription.distance) return prescription.distance;
  if (prescription.exercises && Array.isArray(prescription.exercises)) {
    return `${prescription.exercises.length} exercises`;
  }
  if (prescription.duration) return prescription.duration;
  return '';
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Day-of-week indices ordered Monday→Sunday. Use for rendering weekly schedules. */
export const WEEK_DAYS_MON_SUN: number[] = [1, 2, 3, 4, 5, 6, 0];

export function dayAbbrev(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function dayFull(dayOfWeek: number): string {
  return DAY_NAMES_FULL[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export function formatActivityDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const ACTIVITY_DISPLAY_NAMES: Record<string, string> = {
  run: 'Run',
  walk: 'Walk',
  cycling: 'Cycling',
  swim: 'Swim',
  open_water_swim: 'Open Water Swim',
  indoor_run: 'Indoor Run',
  indoor_cycling: 'Indoor Cycling',
  strength_training: 'Strength Training',
  mobility: 'Mobility',
  yoga: 'Yoga',
  recovery: 'Recovery',
  rest: 'Rest',
  drill: 'Drill',
  cross_training: 'Cross Training',
  outdoor_activity: 'Outdoor Activity',
  indoor_activity: 'Indoor Activity',
};

export function formatActivityType(type: string): string {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  if (ACTIVITY_DISPLAY_NAMES[normalized]) return ACTIVITY_DISPLAY_NAMES[normalized];
  // Fallback: replace underscores with spaces and title-case each word
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export const IMPORT_ACTIVITY_TYPES: { type: string; label: string }[] = [
  { type: 'run', label: 'Run' },
  { type: 'walk', label: 'Walk' },
  { type: 'cycling', label: 'Cycling' },
  { type: 'indoor_run', label: 'Indoor Run' },
  { type: 'indoor_cycling', label: 'Indoor Cycling' },
  { type: 'swim', label: 'Swim' },
  { type: 'open_water_swim', label: 'Open Water Swim' },
  { type: 'strength_training', label: 'Strength Training' },
  { type: 'mobility', label: 'Mobility' },
  { type: 'drill', label: 'Drill' },
  { type: 'outdoor_activity', label: 'Outdoor Activity' },
  { type: 'indoor_activity', label: 'Indoor Activity' },
];

const GPS_ROOTS = ['run', 'walk', 'swim', 'cycling', 'open_water_swim', 'outdoor_activity'];
const MANUAL_ROOTS = ['strength_training', 'mobility', 'drill', 'yoga', 'recovery', 'indoor_run', 'indoor_cycling', 'indoor_activity'];

export function isGPSActivity(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return GPS_ROOTS.some((t) => normalized.includes(t));
}

export function isManualActivity(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return MANUAL_ROOTS.some((t) => normalized.includes(t));
}

// Sport-family colors used on program detail / month heatmap. Static across
// themes — surfaces and text adapt via theme tokens, but sport identity stays
// stable so users learn to recognize each family at a glance.
const SPORT_COLOR_MAP: Record<string, string> = {
  run: '#0EA5B0',
  walk: '#0EA5B0',
  indoor_run: '#0EA5B0',
  cycling: '#E68A2E',
  indoor_cycling: '#E68A2E',
  swim: '#3B82F6',
  open_water_swim: '#3B82F6',
  strength_training: '#7C5CFC',
  mobility: '#34C759',
  yoga: '#34C759',
  recovery: '#9E9EAE',
  rest: '#9E9EAE',
  drill: '#E68A2E',
  cross_training: '#7C5CFC',
  outdoor_activity: '#34C759',
  indoor_activity: '#7C5CFC',
};

export function getActivityColor(type: string): string {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  for (const [key, color] of Object.entries(SPORT_COLOR_MAP)) {
    if (normalized.includes(key)) return color;
  }
  return '#7C5CFC';
}

const INTENSITY_KEYWORDS: Array<[string, number]> = [
  ['recovery', 1],
  ['easy', 2],
  ['moderate', 3],
  ['steady', 3],
  ['tempo', 4],
  ['threshold', 4],
  ['hard', 4],
  ['vo2', 5],
  ['race', 5],
  ['max', 5],
];

// Map prescription intensity to a 1–5 "load" level. Numeric values are clamped;
// RPE-style 0–10 inputs are halved. Falls back to a sensible default per sport
// so the apex chart and month heatmap always have something to render.
export function getIntensityLevel(prescription: Record<string, any> | undefined, activityType: string): number {
  const raw = prescription?.intensity;
  if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
    const str = String(raw).toLowerCase();
    const numMatch = str.match(/(\d+(?:\.\d+)?)/);
    if (numMatch) {
      const num = parseFloat(numMatch[1]);
      if (!Number.isNaN(num)) {
        const scaled = num > 5 ? num / 2 : num;
        return Math.max(1, Math.min(5, Math.round(scaled)));
      }
    }
    for (const [keyword, level] of INTENSITY_KEYWORDS) {
      if (str.includes(keyword)) return level;
    }
  }
  const normalized = activityType.toLowerCase();
  if (normalized.includes('rest') || normalized.includes('recovery')) return 1;
  if (normalized.includes('mobility') || normalized.includes('yoga')) return 1;
  if (normalized.includes('walk')) return 1;
  return 3;
}

export function intensityLabel(level: number): string {
  return ['', 'Recovery', 'Easy', 'Moderate', 'Hard', 'Race'][level] || '';
}

/** Returns the activity with the highest intensity level from a non-empty list. */
export function dominantActivity(activities: { prescription?: Record<string, any>; activity_type: string }[]): { prescription?: Record<string, any>; activity_type: string } {
  return activities.reduce((a, b) =>
    getIntensityLevel(a.prescription, a.activity_type) >= getIntensityLevel(b.prescription, b.activity_type) ? a : b,
  );
}

// Pull a short duration / distance string for a row subtitle. Returns an empty
// array if the prescription has neither — caller can fall back to the type label.
export function prescriptionPrimaryStats(prescription: Record<string, any> | undefined): string[] {
  if (!prescription) return [];
  const stats: string[] = [];
  if (prescription.duration) stats.push(String(prescription.duration));
  const distance = prescription.distance || prescription.total_distance;
  if (distance) stats.push(String(distance));
  return stats;
}
