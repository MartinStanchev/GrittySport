import type { Scene } from '../types';
import { makeRoute } from '../mockData';

// Live GPS recording HUD on a ride, auto-paused at a junction: shows speed/power
// metrics and the paused controls (Finish / Resume / Discard).
export const appLiveRideScene: Scene = {
  id: 'app-live-ride',
  title: 'App · Live ride (paused)',
  group: 'App screens',
  device: 'iphone-15-pro',
  kind: 'live-workout',
  props: {
    activityLabel: 'Outdoor Ride',
    status: 'paused',
    gpsQuality: 'Strong',
    time: '48:05',
    heroMetrics: [
      { label: 'Distance', value: '21.3', unit: 'km', accent: 'primary' },
      { label: 'Speed', value: '0.0', unit: 'km/h', accent: 'secondary' },
    ],
    secondaryMetrics: [
      { label: 'Avg Speed', value: '28.4', unit: 'km/h', accent: 'primary', support: 'Session average' },
      { label: 'Heart Rate', value: '138', unit: 'bpm', accent: 'hr', support: 'Avg 144 bpm' },
      { label: 'Power', value: '212', unit: 'W', accent: 'secondary', support: 'Avg 198 W' },
      { label: 'Elevation', value: '264', unit: 'm', accent: 'tertiary', support: 'Climbed so far' },
      { label: 'Lap', value: '22', accent: 'primary', support: '21 complete' },
      { label: 'GPS Points', value: '612', accent: 'secondary', support: 'Strong' },
    ],
    sensor: { connected: true, label: 'Connected to Wahoo TICKR' },
    routePoints: makeRoute(80, { lat: 52.49, lng: 13.42 }, 0.03),
  },
};
