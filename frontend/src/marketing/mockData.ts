import type { HRReading } from '../types/gps';

// Deterministic mock generators for marketing scenes (live-workout / summary),
// so scene files stay declarative instead of hand-listing hundreds of points.

// A believable looping route around a center point. `spread` is in degrees.
export function makeRoute(
  count = 60,
  center: { lat: number; lng: number } = { lat: 52.52, lng: 13.405 },
  spread = 0.012,
): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * Math.PI * 2;
    // wobble so it reads like a real GPS trace, not a clean ellipse
    const wob = Math.sin(t * 5) * 0.18 + Math.sin(t * 2.3) * 0.12;
    pts.push({
      lat: center.lat + Math.sin(t) * spread * (1 + wob) * 0.7,
      lng: center.lng + Math.cos(t) * spread * (1 + wob),
    });
  }
  return pts;
}

// A HR series that ramps up, holds with drift, and dips at the end.
export function makeHRSeries({
  durationSec = 32 * 60,
  count = 120,
  base = 132,
  peak = 168,
  start = Date.UTC(2026, 5, 16, 7, 12),
}: {
  durationSec?: number;
  count?: number;
  base?: number;
  peak?: number;
  start?: number;
} = {}): HRReading[] {
  const readings: HRReading[] = [];
  for (let i = 0; i < count; i++) {
    const f = i / (count - 1);
    // ramp in first 15%, drift up in the middle, cool down last 10%
    const rampUp = Math.min(f / 0.15, 1);
    const coolDown = f > 0.9 ? 1 - (f - 0.9) / 0.1 : 1;
    const drift = f * 8;
    const wob = Math.sin(f * Math.PI * 9) * 3;
    const bpm = Math.round(base + (peak - base) * rampUp * coolDown + drift + wob);
    readings.push({ bpm, timestamp: start + Math.round(f * durationSec * 1000) });
  }
  return readings;
}
