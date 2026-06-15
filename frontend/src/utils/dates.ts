/** Return a copy of `d` with the time set to local midnight. */
export function startOfDay(d: Date): Date {
  const next = new Date(d);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Return a copy of `d` offset by `days` (may be negative). */
export function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** True when `a` and `b` fall on the same calendar day. */
export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Local midnight of the Monday that starts the week containing `d`. */
export function mondayOf(d: Date): Date {
  const dayOfWeek = d.getDay(); // 0=Sun
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  return startOfDay(addDays(d, offset));
}

/**
 * Format a duration between two ISO timestamps as a human-readable string.
 * Returns "Xh Ym", "Xm Ys", or "Xs".
 */
export function formatDuration(startedAt: string, finishedAt?: string): string {
  if (!finishedAt) return '—';
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Format a short date like "Mon, Jan 5".
 */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Format a full date like "Monday, January 5, 2026".
 */
export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format a date relative to today: "Today", "Yesterday", "X days ago", or "Jan 5".
 */
export function formatRelativeDate(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a YYYY-MM-DD date relative to a reference day (defaults to today).
 * Returns "Today", "Yesterday", "Tomorrow", "In X days", "X days ago", or a
 * short weekday/month/day fallback.
 */
export function formatRelativeDay(dateStr: string, reference?: Date): string {
  const ref = reference ?? new Date();
  const refMidnight = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((d.getTime() - refMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays <= 6) return `In ${diffDays} days`;
  if (diffDays < -1 && diffDays >= -6) return `${-diffDays} days ago`;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateRange(start: string, end?: string): string {
  const s = new Date(start + 'T00:00:00');
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!end) return `${startStr} — ongoing`;
  const e = new Date(end + 'T00:00:00');
  const endStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} — ${endStr}`;
}
