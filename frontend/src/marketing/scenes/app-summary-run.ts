import type { Scene } from '../types';
import type { SplitsAnalysis } from '../../types/gps';
import { makeRoute, makeHRSeries } from '../mockData';

// Post-run summary: route, the stat grid, HR-zone distribution, the HR-over-time
// chart, per-km splits, a PR badge and the effort score. The "see everything
// after you finish" metrics story.
const splits: SplitsAnalysis = {
  splits: [
    { km: 1, durationSec: 318, paceSecPerKm: 318, avgHR: 148, elevationGain: 12 },
    { km: 2, durationSec: 311, paceSecPerKm: 311, avgHR: 154, elevationGain: 8 },
    { km: 3, durationSec: 309, paceSecPerKm: 309, avgHR: 158, elevationGain: 18 },
    { km: 4, durationSec: 305, paceSecPerKm: 305, avgHR: 161, elevationGain: 6 },
    { km: 5, durationSec: 301, paceSecPerKm: 301, avgHR: 164, elevationGain: 4 },
    { km: 6, durationSec: 297, paceSecPerKm: 297, avgHR: 168, elevationGain: 10 },
  ],
  fastestSplitKm: 6,
  slowestSplitKm: 1,
  fadePct: -6.6,
  isNegativeSplit: true,
};

export const appSummaryRunScene: Scene = {
  id: 'app-summary-run',
  title: 'App · Run summary metrics',
  group: 'App screens',
  device: 'iphone-15-pro',
  kind: 'workout-summary',
  props: {
    activityTitle: 'Tempo Run',
    dateLabel: 'Saturday, June 20',
    routePoints: makeRoute(64, { lat: 52.514, lng: 13.35 }, 0.014),
    stats: [
      { label: 'Distance', value: '8.42', unit: 'km' },
      { label: 'Time', value: '42:41' },
      { label: 'Avg Pace', value: '5:04', unit: '/km' },
      { label: 'Elev Gain', value: '+96', unit: 'm' },
      { label: 'Avg HR', value: '159', unit: 'bpm' },
      { label: 'Max HR', value: '178', unit: 'bpm' },
      { label: 'Best Lap', value: '4:57', unit: '/km' },
      { label: 'Laps', value: '8' },
    ],
    hrZones: [
      { zone: 1, pct: 0.05 },
      { zone: 2, pct: 0.22 },
      { zone: 3, pct: 0.41 },
      { zone: 4, pct: 0.26 },
      { zone: 5, pct: 0.06 },
    ],
    hrReadings: makeHRSeries({ durationSec: 42 * 60 + 41, base: 138, peak: 176 }),
    maxHR: 188,
    effort: { score: 78, label: 'Hard' },
    splits,
    personalRecords: [
      { category: 'Fastest 5K', value: 1505, formatted_value: '25:05', improvement_pct: 3.2 },
      { category: 'Fastest 1K', value: 297, formatted_value: '4:57', improvement_pct: 1.4 },
    ],
    trendText: 'Your pace was 30% faster than your last 2 runs at the same heart rate — a clear aerobic gain.',
    weeklyTrend: {
      volume_trend: {
        this_week_km: 38.6,
        last_week_km: 31.2,
        this_week_sessions: 5,
        last_week_sessions: 4,
        change_km_pct: 23.7,
        change_session_pct: 25.0,
      },
      effort_trend: {
        this_week_avg_effort: 71,
        last_4_weeks_avg_effort: 66,
        change_pct: 7.6,
      },
      hr_trend: {
        avg_hr_at_pace_this_week: 152,
        avg_hr_at_pace_last_4_wks: 159,
        delta_hr: -7,
        trend: 'improving',
      },
    },
    isPremium: true,
  },
};
