import type { ScheduledActivityResponse } from '../services/api';

export type ActivityStatus = 'completed' | 'today' | 'upcoming' | 'missed';

export const startOfDay = (d: Date): Date => {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const addDays = (d: Date, days: number): Date => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

export const alpha = (hex: string, opacity: number): string => {
  const a = Math.max(0, Math.min(255, Math.round(opacity * 255))).toString(16).padStart(2, '0');
  return `${hex}${a}`;
};

export function activityStatus(activity: ScheduledActivityResponse, today: Date): ActivityStatus {
  if (activity.linked_workout_id) return 'completed';
  const date = startOfDay(new Date(activity.date + 'T00:00:00'));
  if (sameDay(date, today)) return 'today';
  return date < today ? 'missed' : 'upcoming';
}
