import type { Scene } from '../types';
import { makeRoute } from '../mockData';

// Live GPS recording HUD mid-run: dominant route, big timer, live pace/distance,
// a connected HR strap, and the full metric grid. The "track every session" shot.
export const appLiveRunScene: Scene = {
  id: 'app-live-run',
  title: 'App · Live run recording',
  group: 'App screens',
  device: 'iphone-15-pro',
  kind: 'live-workout',
  props: {
    activityLabel: 'Outdoor Run',
    status: 'recording',
    gpsQuality: 'Strong',
    time: '32:18',
    heroMetrics: [
      { label: 'Distance', value: '6.42', unit: 'km', accent: 'primary' },
      { label: 'Pace', value: '5:12', unit: '/km', accent: 'secondary' },
    ],
    secondaryMetrics: [
      { label: 'Avg Pace', value: '5:21', unit: '/km', accent: 'primary', support: 'Session average' },
      { label: 'Heart Rate', value: '162', unit: 'bpm', accent: 'hr', support: 'Avg 156 bpm' },
      { label: 'Cadence', value: '178', unit: 'spm', accent: 'secondary', support: 'Avg 176 spm' },
      { label: 'Elevation', value: '84', unit: 'm', accent: 'tertiary', support: 'Climbed so far' },
      { label: 'Lap', value: '7', accent: 'primary', support: '6 complete' },
      { label: 'GPS Points', value: '388', accent: 'secondary', support: 'Strong' },
    ],
    sensor: { connected: true, label: 'Connected to Polar H10' },
    routePoints: makeRoute(64, { lat: 52.514, lng: 13.35 }, 0.014),
  },
};
