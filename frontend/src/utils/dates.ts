export function formatDateRange(start: string, end?: string): string {
  const s = new Date(start + 'T00:00:00');
  const startStr = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (!end) return `${startStr} — ongoing`;
  const e = new Date(end + 'T00:00:00');
  const endStr = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startStr} — ${endStr}`;
}
