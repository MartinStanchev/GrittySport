import { hasAnalyticsContent } from '../utils/workoutAnalytics';
import type { WorkoutAnalytics } from '../types/gps';

function analytics(partial: Partial<WorkoutAnalytics> = {}): WorkoutAnalytics {
  return {
    effort_score: 0,
    effort_label: 'Easy',
    splits: [],
    fastest_split_km: 0,
    slowest_split_km: 0,
    fade_pct: 0,
    is_negative_split: false,
    ...partial,
  } as WorkoutAnalytics;
}

describe('hasAnalyticsContent', () => {
  it('is false for null/undefined', () => {
    expect(hasAnalyticsContent(null)).toBe(false);
    expect(hasAnalyticsContent(undefined)).toBe(false);
  });

  it('is false when every metric is empty (splits alone do not count)', () => {
    expect(hasAnalyticsContent(analytics({ personal_records: [] }))).toBe(false);
  });

  it.each<[string, Partial<WorkoutAnalytics>]>([
    ['effort score', { effort_score: 42 }],
    ['program alignment', { program_alignment: {} as any }],
    ['personal records', { personal_records: [{ category: '5K' } as any] }],
    ['trend', { trend: { comparison_text: 'Faster than last week' } as any }],
    ['cardiac efficiency', { cardiac_efficiency: {} as any }],
    ['weekly trend', { weekly_trend: {} as any }],
  ])('is true with %s', (_, partial) => {
    expect(hasAnalyticsContent(analytics(partial))).toBe(true);
  });
});
