import { Ionicons } from '@expo/vector-icons';

export const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  run: 'walk-outline',
  easy_run: 'walk-outline',
  interval: 'speedometer-outline',
  walk: 'walk-outline',
  trail_run: 'walk-outline',
  swim: 'water-outline',
  open_water_swim: 'water-outline',
  strength: 'barbell-outline',
  rest: 'bed-outline',
  recovery: 'bed-outline',
  mobility: 'body-outline',
  yoga: 'body-outline',
  cycling: 'bicycle-outline',
  indoor_cycling: 'bicycle-outline',
  indoor_run: 'walk-outline',
  drill: 'flag-outline',
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
  easy_run: 'Easy Run',
  long_run: 'Long Run',
  tempo_run: 'Tempo Run',
  interval: 'Interval',
  interval_run: 'Interval Run',
  interval_training: 'Interval Training',
  trail_run: 'Trail Run',
  indoor_run: 'Indoor Run',
  walk: 'Walk',
  swim: 'Swim',
  open_water_swim: 'Open Water Swim',
  strength: 'Strength',
  strength_training: 'Strength Training',
  cycling: 'Cycling',
  indoor_cycling: 'Indoor Cycling',
  mobility: 'Mobility',
  yoga: 'Yoga',
  recovery: 'Recovery',
  rest: 'Rest',
  drill: 'Drill',
  cross_training: 'Cross Training',
  bike: 'Cycling',
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
  { type: 'strength', label: 'Strength' },
  { type: 'mobility', label: 'Mobility' },
  { type: 'drill', label: 'Drill' },
];

const GPS_ROOTS = ['run', 'walk', 'swim', 'cycling', 'open_water_swim'];
const MANUAL_ROOTS = ['strength', 'mobility', 'drill', 'yoga', 'recovery', 'indoor_run', 'indoor_cycling'];

export function isGPSActivity(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return GPS_ROOTS.some((t) => normalized.includes(t));
}

export function isManualActivity(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return MANUAL_ROOTS.some((t) => normalized.includes(t));
}
