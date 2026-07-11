import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { GPSPoint, HRReading, CadenceReading, Lap } from '../types/gps';
import { bleService } from '../services/bleService';
import { usePauseNotification } from '../hooks/usePauseNotification';

// ---- Manual workout types (unchanged) ----

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
  activityType: string;
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
  // HR sensor (optional throughout the workout)
  hrReadings: HRReading[];
  currentHR: number | null;
  avgHR: number | null;
  hrDeviceName?: string;
  // Pause tracking — total paused seconds and timestamp (ms) of the current pause if any
  pausedDurationSec: number;
  lastPauseStart: number | null;
}

type ManualWorkoutInitFields =
  | 'phase' | 'workoutNotes' | 'finishedAt'
  | 'hrReadings' | 'currentHR' | 'avgHR' | 'hrDeviceName'
  | 'pausedDurationSec' | 'lastPauseStart';

// ---- GPS workout types ----

export type GPSRecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface ActiveGPSWorkout {
  activityType: string;
  activityDisplayType: string;
  scheduledActivityId?: string;
  startedAt: Date;
  finishedAt?: Date;
  recordingState: GPSRecordingState;
  // Collected data
  points: GPSPoint[];
  hrReadings: HRReading[];
  laps: Lap[];
  // Current lap tracking
  lapStartIndex: number;
  lapStartDistanceM: number;
  // Live metrics
  totalDistanceM: number;
  elevationGainM: number;
  currentPaceSecPerKm: number;
  avgPaceSecPerKm: number;
  currentSpeedKph: number;
  avgSpeedKph: number;
  currentHR: number | null;
  avgHR: number | null;
  // Cadence
  cadenceReadings: CadenceReading[];
  currentCadence: number | null;
  avgCadence: number | null;
  // Pause tracking
  autoPausedDurationSec: number;
  lastAutoPauseStart: number | null;
  // True when the current pause was triggered automatically (vs. a manual Pause tap);
  // only auto-pauses are eligible for auto-resume.
  autoPaused: boolean;
  // Consecutive below-threshold points, drives auto-pause (folded by the GPS reducer)
  slowPointCount: number;
  // Consecutive moving readings while auto-paused, drives auto-resume
  movingPointCount: number;
  // BLE
  hrDeviceName?: string;
  // Notes (filled in summary screen)
  workoutNotes: string;
}

export type WorkoutMode = 'manual' | 'gps';

// Fields that are initialised automatically when a GPS workout is started
type GPSWorkoutInitFields =
  | 'recordingState' | 'points' | 'hrReadings' | 'laps'
  | 'lapStartIndex' | 'lapStartDistanceM'
  | 'totalDistanceM' | 'elevationGainM'
  | 'currentPaceSecPerKm' | 'avgPaceSecPerKm'
  | 'currentSpeedKph' | 'avgSpeedKph'
  | 'currentHR' | 'avgHR'
  | 'cadenceReadings' | 'currentCadence' | 'avgCadence'
  | 'autoPausedDurationSec' | 'lastAutoPauseStart' | 'autoPaused'
  | 'slowPointCount' | 'movingPointCount'
  | 'hrDeviceName' | 'workoutNotes';

export type StartGPSWorkoutOpts = Omit<ActiveGPSWorkout, GPSWorkoutInitFields>;

// ---- Context ----

interface WorkoutContextType {
  // Manual
  activeWorkout: ActiveWorkout | null;
  startWorkout: (workout: Omit<ActiveWorkout, ManualWorkoutInitFields>) => void;
  updateWorkout: (updates: Partial<ActiveWorkout>) => void;
  clearWorkout: () => void;
  // GPS
  activeGPSWorkout: ActiveGPSWorkout | null;
  startGPSWorkout: (opts: StartGPSWorkoutOpts) => void;
  updateGPSWorkout: (updates: Partial<ActiveGPSWorkout>) => void;
  clearGPSWorkout: () => void;
  // Derived
  workoutMode: WorkoutMode | null;
}

// Name of the HR monitor connected before the workout started, if any (e.g. an
// auto-reconnect that completed while the recording screen was open).
function connectedHRDeviceName(): string | undefined {
  return bleService.isConnected() ? bleService.getDeviceName() ?? undefined : undefined;
}

const WorkoutContext = createContext<WorkoutContextType | null>(null);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [activeGPSWorkout, setActiveGPSWorkout] = useState<ActiveGPSWorkout | null>(null);

  // Refs for reading latest state inside stable callbacks
  const activeWorkoutRef = useRef<ActiveWorkout | null>(null);
  const activeGPSWorkoutRef = useRef<ActiveGPSWorkout | null>(null);
  activeWorkoutRef.current = activeWorkout;
  activeGPSWorkoutRef.current = activeGPSWorkout;

  // Lives at the provider so the "workout paused" notification survives navigating away
  // from the recording screen — its whole point is alerting a user who isn't looking at it.
  usePauseNotification(activeGPSWorkout?.recordingState ?? 'idle', activeGPSWorkout?.autoPaused ?? false);

  // Manual
  const startWorkout = useCallback((workout: Omit<ActiveWorkout, ManualWorkoutInitFields>) => {
    if (activeGPSWorkoutRef.current !== null) return; // GPS session in progress
    setActiveWorkout({
      ...workout,
      phase: 'recording',
      workoutNotes: '',
      finishedAt: undefined,
      hrReadings: [],
      currentHR: null,
      avgHR: null,
      // Carry over an HR monitor already connected before start (e.g. auto-reconnect).
      hrDeviceName: connectedHRDeviceName(),
      pausedDurationSec: 0,
      lastPauseStart: null,
    });
  }, []);

  const updateWorkout = useCallback((updates: Partial<ActiveWorkout>) => {
    setActiveWorkout((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const clearWorkout = useCallback(() => {
    setActiveWorkout(null);
  }, []);

  // GPS
  const startGPSWorkout = useCallback((opts: StartGPSWorkoutOpts) => {
    if (activeWorkoutRef.current !== null) return; // manual session in progress
    setActiveGPSWorkout({
      ...opts,
      recordingState: 'idle',
      points: [],
      hrReadings: [],
      laps: [],
      lapStartIndex: 0,
      lapStartDistanceM: 0,
      totalDistanceM: 0,
      elevationGainM: 0,
      currentPaceSecPerKm: 0,
      avgPaceSecPerKm: 0,
      currentSpeedKph: 0,
      avgSpeedKph: 0,
      currentHR: null,
      avgHR: null,
      cadenceReadings: [],
      currentCadence: null,
      avgCadence: null,
      autoPausedDurationSec: 0,
      lastAutoPauseStart: null,
      autoPaused: false,
      slowPointCount: 0,
      movingPointCount: 0,
      // Carry over an HR monitor already connected before start (e.g. auto-reconnect).
      hrDeviceName: connectedHRDeviceName(),
      workoutNotes: '',
    });
  }, []);

  const updateGPSWorkout = useCallback((updates: Partial<ActiveGPSWorkout>) => {
    setActiveGPSWorkout((prev) => (prev ? { ...prev, ...updates } : prev));
  }, []);

  const clearGPSWorkout = useCallback(() => {
    setActiveGPSWorkout(null);
  }, []);

  const workoutMode: WorkoutMode | null =
    activeWorkout !== null ? 'manual' : activeGPSWorkout !== null ? 'gps' : null;

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout, startWorkout, updateWorkout, clearWorkout,
        activeGPSWorkout, startGPSWorkout, updateGPSWorkout, clearGPSWorkout,
        workoutMode,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout(): WorkoutContextType {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within WorkoutProvider');
  return ctx;
}
