import { useCallback, useEffect, useRef } from 'react';
import type { ActiveWorkout } from '../contexts/WorkoutContext';
import type { HRReading } from '../types/gps';

/**
 * Appends live HR readings to the manual workout in context, keeping a running sum so
 * the average stays O(1) per reading. The buffer re-syncs from the context whenever a
 * workout starts (or is resumed on a remounted screen). Returns the per-reading callback.
 */
export function useWorkoutHRLog(
  workout: ActiveWorkout | null,
  updateWorkout: (updates: Partial<ActiveWorkout>) => void,
): (bpm: number) => void {
  const readingsRef = useRef<HRReading[]>([]);
  const sumRef = useRef(0);

  useEffect(() => {
    const readings = workout?.hrReadings ?? [];
    readingsRef.current = readings;
    sumRef.current = readings.reduce((s, r) => s + r.bpm, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when a workout starts
  }, [workout?.startedAt]);

  return useCallback((bpm: number) => {
    readingsRef.current = [...readingsRef.current, { bpm, timestamp: Date.now() }];
    sumRef.current += bpm;
    const avg = Math.round(sumRef.current / readingsRef.current.length);
    updateWorkout({ hrReadings: readingsRef.current, currentHR: bpm, avgHR: avg });
  }, [updateWorkout]);
}
