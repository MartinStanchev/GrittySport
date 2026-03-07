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

export function formatDateRange(start: string, end?: string): string {
  const s = new Date(start + 'T00:00:00');
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!end) return `${startStr} — ongoing`;
  const e = new Date(end + 'T00:00:00');
  const endStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} — ${endStr}`;
}
