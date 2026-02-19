import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type WorkoutType = 'strength' | 'mobility' | 'drill';

export interface SetLog {
  reps: string;
  weight: string;
  rpe: string;
  completed: boolean;
}

export interface ExerciseLog {
  name: string;
  targetSets?: number;
  targetReps?: string;
  targetWeight?: string;
  targetRpe?: string;
  restSeconds?: number;
  sets: SetLog[];
}

export interface MobilityExerciseLog {
  name: string;
  targetDurationSeconds: number;
  remainingSeconds: number;
  timerActive: boolean;
  completed: boolean;
}

export interface ActiveWorkout {
  workoutType: WorkoutType;
  activityDisplayType: string;
  scheduledActivityId?: string;
  startedAt: Date;
  finishedAt?: Date;
  phase: 'recording' | 'summary';
  strengthExercises: ExerciseLog[];
  mobilityExercises: MobilityExerciseLog[];
  drillName: string;
  drillDescription: string;
  drillNotes: string;
  workoutNotes: string;
}

interface WorkoutContextType {
  activeWorkout: ActiveWorkout | null;
  startWorkout: (workout: Omit<ActiveWorkout, 'phase' | 'workoutNotes' | 'finishedAt'>) => void;
  updateWorkout: (updates: Partial<ActiveWorkout>) => void;
  clearWorkout: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);

  const startWorkout = useCallback((workout: Omit<ActiveWorkout, 'phase' | 'workoutNotes' | 'finishedAt'>) => {
    setActiveWorkout({ ...workout, phase: 'recording', workoutNotes: '', finishedAt: undefined });
  }, []);

  const updateWorkout = useCallback((updates: Partial<ActiveWorkout>) => {
    setActiveWorkout((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const clearWorkout = useCallback(() => {
    setActiveWorkout(null);
  }, []);

  return (
    <WorkoutContext.Provider value={{ activeWorkout, startWorkout, updateWorkout, clearWorkout }}>
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout(): WorkoutContextType {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}
