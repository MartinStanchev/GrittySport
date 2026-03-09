import { Ionicons } from '@expo/vector-icons';

export const ACTIVITY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  run: 'walk-outline',
  easy_run: 'walk-outline',
  interval: 'speedometer-outline',
  walk: 'walk-outline',
  trail_run: 'walk-outline',
  swim: 'water-outline',
  strength: 'barbell-outline',
  rest: 'bed-outline',
  recovery: 'bed-outline',
  mobility: 'body-outline',
  yoga: 'body-outline',
  cycling: 'bicycle-outline',
  bike: 'bicycle-outline',
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

const MANUAL_ACTIVITY_TYPES = ['strength', 'mobility', 'drill', 'yoga', 'recovery', 'indoor_run', 'indoor_cycling'];
export const GPS_ACTIVITY_TYPES = ['run', 'easy_run', 'interval', 'long_run', 'trail_run', 'walk', 'swim', 'cycling', 'bike'];

export function isManualActivity(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return MANUAL_ACTIVITY_TYPES.some((t) => normalized.includes(t));
}

export function isGPSActivity(type: string): boolean {
  const normalized = type.toLowerCase().replace(/\s+/g, '_');
  return GPS_ACTIVITY_TYPES.some((t) => normalized.includes(t));
}
