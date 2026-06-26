import type { ProgramDetail, ScheduledActivityResponse } from '../services/api';

export interface ProgramEvent {
  activity: ScheduledActivityResponse;
  name: string;
  date: string; // YYYY-MM-DD
  location?: string;
  goal?: string;
  daysUntil: number; // negative once the event is in the past
  completed: boolean;
}

/** Midnight-aligned whole-day difference between an ISO date and today. */
function daysFromToday(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Finds the program's goal event (activity_type === 'event'), if any. */
export function findProgramEvent(program: ProgramDetail | null | undefined): ProgramEvent | null {
  if (!program) return null;
  for (const phase of program.phases) {
    for (const week of phase.weeks) {
      for (const activity of week.activities) {
        if (activity.activity_type !== 'event') continue;
        const p = activity.prescription || {};
        const date = (p.date as string) || activity.date;
        if (!date) continue;
        return {
          activity,
          name: (p.event_name as string) || 'Goal Event',
          date,
          location: p.location as string | undefined,
          goal: p.goal as string | undefined,
          daysUntil: daysFromToday(date),
          completed: !!activity.linked_workout_id,
        };
      }
    }
  }
  return null;
}

/** Short human countdown label, e.g. "18 days to go", "Tomorrow", "Today!". */
export function countdownLabel(daysUntil: number): string {
  if (daysUntil < 0) return 'Completed';
  if (daysUntil === 0) return 'Today!';
  if (daysUntil === 1) return 'Tomorrow';
  return `${daysUntil} days to go`;
}
