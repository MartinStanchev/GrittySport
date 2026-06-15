import { computeAdherence } from '../utils/adherence';
import type { ScheduledActivityResponse } from '../services/api';

function act(partial: Partial<ScheduledActivityResponse>): ScheduledActivityResponse {
  return {
    id: Math.random().toString(),
    day_of_week: 1,
    date: '2026-01-01',
    activity_type: 'run',
    prescription: {},
    order_index: 0,
    ...partial,
  };
}

describe('computeAdherence', () => {
  const now = new Date('2026-06-15T12:00:00'); // a Monday

  it('returns all zeros for no activities', () => {
    expect(computeAdherence([], now)).toEqual({ done: 0, skipped: 0, upcoming: 0, total: 0 });
  });

  it('counts a linked activity as done regardless of date', () => {
    const activities = [
      act({ date: '2026-06-10', linked_workout_id: 'w1' }), // past + linked
      act({ date: '2026-06-20', linked_workout_id: 'w2' }), // future + linked
    ];
    expect(computeAdherence(activities, now)).toMatchObject({ done: 2, skipped: 0, upcoming: 0 });
  });

  it('counts a past unlinked activity as skipped', () => {
    expect(computeAdherence([act({ date: '2026-06-10' })], now)).toMatchObject({ skipped: 1, done: 0, upcoming: 0 });
  });

  it('counts today and future unlinked activities as upcoming', () => {
    const activities = [
      act({ date: '2026-06-15' }), // today
      act({ date: '2026-06-18' }), // future
    ];
    expect(computeAdherence(activities, now)).toMatchObject({ upcoming: 2, done: 0, skipped: 0 });
  });

  it('excludes passive activity types from all tallies', () => {
    const activities = [
      act({ date: '2026-06-10', activity_type: 'rest' }),
      act({ date: '2026-06-10', activity_type: 'recovery' }),
      act({ date: '2026-06-10', activity_type: 'mobility' }),
      act({ date: '2026-06-10', activity_type: 'yoga' }),
      act({ date: '2026-06-10', activity_type: 'run' }), // the only counted one
    ];
    expect(computeAdherence(activities, now)).toEqual({ done: 0, skipped: 1, upcoming: 0, total: 1 });
  });

  it('combines done, skipped and upcoming into total', () => {
    const activities = [
      act({ date: '2026-06-09', linked_workout_id: 'w1' }),
      act({ date: '2026-06-10' }),
      act({ date: '2026-06-12' }),
      act({ date: '2026-06-20' }),
    ];
    expect(computeAdherence(activities, now)).toEqual({ done: 1, skipped: 2, upcoming: 1, total: 4 });
  });
});
