import type { Scene } from '../types';
import { makeRoute, makeHRSeries } from '../mockData';

// Post-ride summary variant: cycling stat grid (speed / power / energy), HR-zone
// distribution, HR chart and effort score. No per-km splits (cycling).
export const appSummaryRideScene: Scene = {
  id: 'app-summary-ride',
  title: 'App · Ride summary metrics',
  group: 'App screens',
  device: 'iphone-15-pro',
  kind: 'workout-summary',
  props: {
    activityTitle: 'Endurance Ride',
    dateLabel: 'Sunday, June 14',
    routePoints: makeRoute(90, { lat: 52.49, lng: 13.42 }, 0.03),
    stats: [
      { label: 'Distance', value: '41.8', unit: 'km' },
      { label: 'Time', value: '1:28:12' },
      { label: 'Avg Speed', value: '28.4', unit: 'km/h' },
      { label: 'Elev Gain', value: '+512', unit: 'm' },
      { label: 'Avg Power', value: '198', unit: 'W' },
      { label: 'Max Power', value: '486', unit: 'W' },
      { label: 'Energy', value: '1047', unit: 'kJ' },
      { label: 'Avg HR', value: '144', unit: 'bpm' },
    ],
    hrZones: [
      { zone: 1, pct: 0.12 },
      { zone: 2, pct: 0.38 },
      { zone: 3, pct: 0.34 },
      { zone: 4, pct: 0.13 },
      { zone: 5, pct: 0.03 },
    ],
    hrReadings: makeHRSeries({ durationSec: 88 * 60, base: 118, peak: 162, start: Date.UTC(2026, 5, 14, 9, 5) }),
    maxHR: 185,
    effort: { score: 64, label: 'Moderate' },
    isPremium: true,
  },
};
