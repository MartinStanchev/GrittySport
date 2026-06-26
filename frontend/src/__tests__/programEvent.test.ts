import { findProgramEvent, countdownLabel } from '../utils/programEvent';
import type { ProgramDetail } from '../services/api';

function programWith(activities: any[]): ProgramDetail {
  return {
    id: 'p1',
    name: 'Test',
    start_date: '2026-01-01',
    status: 'active',
    created_by: 'grit',
    created_at: '',
    updated_at: '',
    criteria: [],
    phases: [
      {
        id: 'ph1',
        name: 'Peak',
        order_index: 0,
        weeks: [{ id: 'w1', week_number: 1, start_date: '2026-01-01', activities }],
      },
    ],
  } as ProgramDetail;
}

function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

describe('findProgramEvent', () => {
  it('returns null when there is no event activity', () => {
    const program = programWith([
      { id: 'a1', day_of_week: 1, date: '2026-01-05', activity_type: 'run', prescription: {}, order_index: 0 },
    ]);
    expect(findProgramEvent(program)).toBeNull();
  });

  it('extracts event details and prefers prescription.date', () => {
    const program = programWith([
      {
        id: 'e1',
        day_of_week: 0,
        date: '2026-01-04',
        activity_type: 'event',
        prescription: { date: '2026-06-30', event_name: 'Berlin Marathon', location: 'Berlin', goal: 'sub-3:30' },
        order_index: 0,
      },
    ]);
    const event = findProgramEvent(program);
    expect(event?.name).toBe('Berlin Marathon');
    expect(event?.date).toBe('2026-06-30');
    expect(event?.location).toBe('Berlin');
    expect(event?.completed).toBe(false);
  });

  it('marks the event completed when a workout is linked', () => {
    const program = programWith([
      {
        id: 'e1',
        day_of_week: 0,
        date: '2026-01-04',
        activity_type: 'event',
        prescription: { date: '2026-06-30', event_name: 'Race' },
        order_index: 0,
        linked_workout_id: 'w-123',
      },
    ]);
    expect(findProgramEvent(program)?.completed).toBe(true);
  });

  it('computes daysUntil relative to today', () => {
    const program = programWith([
      {
        id: 'e1',
        day_of_week: 0,
        date: isoDaysFromToday(10),
        activity_type: 'event',
        prescription: { event_name: 'Race' },
        order_index: 0,
      },
    ]);
    expect(findProgramEvent(program)?.daysUntil).toBe(10);
  });
});

describe('countdownLabel', () => {
  it('formats past, today, tomorrow, and future', () => {
    expect(countdownLabel(-1)).toBe('Completed');
    expect(countdownLabel(0)).toBe('Today!');
    expect(countdownLabel(1)).toBe('Tomorrow');
    expect(countdownLabel(18)).toBe('18 days to go');
  });
});
