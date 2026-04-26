import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExerciseLog } from '../contexts/WorkoutContext';
import type { HRReading } from '../types/gps';

// ─── Tunable constants ───────────────────────────────────────────────────────

export const RISE_THRESHOLD_BPM = 12;
export const RISE_SUSTAIN_SEC = 5;
export const PEAK_HOLD_MIN_SEC = 3;
export const RECOVERY_DROP_BPM = 5;
export const RECOVERY_CONFIRM_SEC = 4;
export const MIN_TIME_BETWEEN_DETECTIONS_SEC = 30;
export const MIN_READINGS_FOR_BASELINE = 30;
export const MAX_BASELINE_SAMPLES = 60;
export const SESSION_LIGHTWORK_CHECK_SEC = 300;
export const LIGHT_WORK_FALLBACK_RISE_BPM = 8;
export const HIGHLIGHT_TTL_MS = 25_000;

// ─── State + pure stepper ────────────────────────────────────────────────────

export type DetectionPhase = 'IDLE' | 'RISING' | 'PEAK' | 'RECOVERING';

export interface DetectionState {
  phase: DetectionPhase;
  idleSamples: HRReading[]; // FIFO of recent IDLE-phase samples (baseline source)
  sessionStartedAt: number | null;
  maxObservedRise: number;
  lightWorkMode: boolean;
  riseStartedAt: number | null;
  peak: number;
  peakStartedAt: number | null;
  recoveryStartedAt: number | null;
  lastDetectionAt: number;
}

export function initialDetectionState(): DetectionState {
  return {
    phase: 'IDLE',
    idleSamples: [],
    sessionStartedAt: null,
    maxObservedRise: 0,
    lightWorkMode: false,
    riseStartedAt: null,
    peak: 0,
    peakStartedAt: null,
    recoveryStartedAt: null,
    lastDetectionAt: 0,
  };
}

export interface StepResult {
  state: DetectionState;
  fired: boolean;
}

export function stepDetection(state: DetectionState, reading: HRReading): StepResult {
  const tNow = reading.timestamp;
  const bpm = reading.bpm;
  const sessionStartedAt = state.sessionStartedAt ?? tNow;

  // Update idle FIFO only when phase is IDLE — preserves a clean baseline of
  // pre-set HR. During RISING/PEAK/RECOVERING idleSamples is frozen, so when we
  // return to IDLE the baseline still reflects "rest", not "exercising".
  let idleSamples = state.idleSamples;
  if (state.phase === 'IDLE') {
    idleSamples = [...idleSamples, reading];
    if (idleSamples.length > MAX_BASELINE_SAMPLES) {
      idleSamples = idleSamples.slice(idleSamples.length - MAX_BASELINE_SAMPLES);
    }
  }

  if (idleSamples.length < MIN_READINGS_FOR_BASELINE) {
    return {
      state: { ...state, idleSamples, sessionStartedAt },
      fired: false,
    };
  }

  const baseline = idleSamples.reduce((s, r) => s + r.bpm, 0) / idleSamples.length;
  const rise = bpm - baseline;
  const newMaxRise = Math.max(state.maxObservedRise, rise);

  let lightWorkMode = state.lightWorkMode;
  const sessionAgeSec = (tNow - sessionStartedAt) / 1000;
  if (!lightWorkMode && sessionAgeSec >= SESSION_LIGHTWORK_CHECK_SEC && newMaxRise < RISE_THRESHOLD_BPM) {
    lightWorkMode = true;
  }
  const effectiveRise = lightWorkMode ? LIGHT_WORK_FALLBACK_RISE_BPM : RISE_THRESHOLD_BPM;

  let next: DetectionState = {
    ...state,
    idleSamples,
    sessionStartedAt,
    lightWorkMode,
    maxObservedRise: newMaxRise,
  };
  let fired = false;

  switch (state.phase) {
    case 'IDLE': {
      if (rise >= effectiveRise) {
        next = { ...next, phase: 'RISING', riseStartedAt: tNow, peak: bpm };
      }
      break;
    }
    case 'RISING': {
      if (rise < effectiveRise / 2) {
        next = { ...next, phase: 'IDLE', riseStartedAt: null, peak: 0 };
        break;
      }
      const newPeak = Math.max(state.peak, bpm);
      const sustainedMs = tNow - (state.riseStartedAt ?? tNow);
      if (sustainedMs >= RISE_SUSTAIN_SEC * 1000 && bpm >= baseline + effectiveRise) {
        next = { ...next, phase: 'PEAK', peak: newPeak, peakStartedAt: tNow };
      } else {
        next = { ...next, peak: newPeak };
      }
      break;
    }
    case 'PEAK': {
      const newPeak = Math.max(state.peak, bpm);
      const peakAgeMs = tNow - (state.peakStartedAt ?? tNow);
      if (peakAgeMs >= PEAK_HOLD_MIN_SEC * 1000 && bpm <= newPeak - RECOVERY_DROP_BPM) {
        next = { ...next, phase: 'RECOVERING', peak: newPeak, recoveryStartedAt: tNow };
      } else {
        next = { ...next, peak: newPeak };
      }
      break;
    }
    case 'RECOVERING': {
      const peak = state.peak;
      if (bpm > peak - RECOVERY_DROP_BPM / 2) {
        // bounced back into the set — re-enter PEAK
        next = {
          ...next,
          phase: 'PEAK',
          peak: Math.max(peak, bpm),
          peakStartedAt: tNow,
          recoveryStartedAt: null,
        };
        break;
      }
      const recoveryAgeMs = tNow - (state.recoveryStartedAt ?? tNow);
      if (recoveryAgeMs >= RECOVERY_CONFIRM_SEC * 1000) {
        const sinceLastDetect = tNow - state.lastDetectionAt;
        if (sinceLastDetect >= MIN_TIME_BETWEEN_DETECTIONS_SEC * 1000) {
          fired = true;
        }
        next = {
          ...next,
          phase: 'IDLE',
          riseStartedAt: null,
          peak: 0,
          peakStartedAt: null,
          recoveryStartedAt: null,
          lastDetectionAt: fired ? tNow : state.lastDetectionAt,
        };
      }
      break;
    }
  }

  return { state: next, fired };
}

// ─── Highlight target lookup ─────────────────────────────────────────────────

export interface SetCoord {
  exIdx: number;
  setIdx: number;
}

export function findNextUnfilledSet(exercises: ExerciseLog[]): SetCoord | null {
  for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
    const sets = exercises[exIdx].sets;
    for (let setIdx = 0; setIdx < sets.length; setIdx++) {
      if (!sets[setIdx].completed) return { exIdx, setIdx };
    }
  }
  return null;
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface SetHighlight extends SetCoord {
  firedAt: number;
}

export interface UseSetDetectionArgs {
  hrReadings: HRReading[];
  exercises: ExerciseLog[];
  enabled: boolean;
}

export interface UseSetDetectionResult {
  highlight: SetHighlight | null;
  dismiss: () => void;
}

export function useSetDetection({
  hrReadings,
  exercises,
  enabled,
}: UseSetDetectionArgs): UseSetDetectionResult {
  const stateRef = useRef<DetectionState>(initialDetectionState());
  const lastIndexRef = useRef<number>(0);
  const exercisesRef = useRef<ExerciseLog[]>(exercises);
  exercisesRef.current = exercises;

  const [highlight, setHighlight] = useState<SetHighlight | null>(null);

  // Reset FSM when feature is disabled (e.g. workout cleared, sensor disconnected).
  useEffect(() => {
    if (!enabled) {
      stateRef.current = initialDetectionState();
      lastIndexRef.current = 0;
      setHighlight(null);
    }
  }, [enabled]);

  // Process new readings since last run.
  useEffect(() => {
    if (!enabled) return;
    const startIdx = Math.min(lastIndexRef.current, hrReadings.length);
    for (let i = startIdx; i < hrReadings.length; i++) {
      const result = stepDetection(stateRef.current, hrReadings[i]);
      stateRef.current = result.state;
      if (result.fired) {
        const target = findNextUnfilledSet(exercisesRef.current);
        if (target) {
          setHighlight({ ...target, firedAt: hrReadings[i].timestamp });
        }
      }
    }
    lastIndexRef.current = hrReadings.length;
  }, [hrReadings, enabled]);

  // Auto-fade highlight.
  useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), HIGHLIGHT_TTL_MS);
    return () => clearTimeout(t);
  }, [highlight]);

  const dismiss = useCallback(() => setHighlight(null), []);
  return { highlight, dismiss };
}
