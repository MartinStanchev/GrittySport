import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** Metric the user picks for the compact iOS Dynamic Island, next to the workout clock. */
export type LiveActivityMetric = 'heart_rate' | 'pace' | 'distance';

export const LIVE_ACTIVITY_METRICS: { id: LiveActivityMetric; label: string }[] = [
  { id: 'heart_rate', label: 'Heart rate' },
  { id: 'pace', label: 'Pace' },
  { id: 'distance', label: 'Distance' },
];

/**
 * Device-local user preferences that aren't tied to the server account, persisted with
 * expo-secure-store (same pattern as ThemeContext).
 */
interface PreferencesContextType {
  // When on, GPS recording auto-pauses after a run of near-stationary fixes (e.g. a red
  // light) and auto-resumes once you're moving again.
  autoPauseEnabled: boolean;
  setAutoPauseEnabled: (enabled: boolean) => void;
  // Metric shown next to the clock in the iOS Dynamic Island while recording.
  liveActivityMetric: LiveActivityMetric;
  setLiveActivityMetric: (metric: LiveActivityMetric) => void;
}

const AUTO_PAUSE_KEY = 'gps_auto_pause_enabled';
const LIVE_ACTIVITY_METRIC_KEY = 'live_activity_metric';
const DEFAULT_LIVE_ACTIVITY_METRIC: LiveActivityMetric = 'heart_rate';

const PreferencesContext = createContext<PreferencesContextType>({
  autoPauseEnabled: true,
  setAutoPauseEnabled: () => {},
  liveActivityMetric: DEFAULT_LIVE_ACTIVITY_METRIC,
  setLiveActivityMetric: () => {},
});

function isLiveActivityMetric(value: string | null): value is LiveActivityMetric {
  return LIVE_ACTIVITY_METRICS.some((m) => m.id === value);
}

let _secureStore: typeof import('expo-secure-store') | null = null;
async function getSecureStore() {
  if (!_secureStore) _secureStore = await import('expo-secure-store');
  return _secureStore;
}

function persist(key: string, value: string) {
  getSecureStore()
    .then((store) => store.setItemAsync(key, value))
    .catch(() => {});
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [autoPauseEnabled, setAutoPauseState] = useState(true);
  const [liveActivityMetric, setLiveActivityMetricState] = useState(DEFAULT_LIVE_ACTIVITY_METRIC);

  useEffect(() => {
    (async () => {
      try {
        const store = await getSecureStore();
        const [autoPause, metric] = await Promise.all([
          store.getItemAsync(AUTO_PAUSE_KEY),
          store.getItemAsync(LIVE_ACTIVITY_METRIC_KEY),
        ]);
        if (autoPause === 'false') setAutoPauseState(false);
        if (isLiveActivityMetric(metric)) setLiveActivityMetricState(metric);
      } catch {
        // ignore — keep defaults
      }
    })();
  }, []);

  const setAutoPauseEnabled = useCallback((enabled: boolean) => {
    setAutoPauseState(enabled);
    persist(AUTO_PAUSE_KEY, enabled ? 'true' : 'false');
  }, []);

  const setLiveActivityMetric = useCallback((metric: LiveActivityMetric) => {
    setLiveActivityMetricState(metric);
    persist(LIVE_ACTIVITY_METRIC_KEY, metric);
  }, []);

  const value = useMemo(
    () => ({ autoPauseEnabled, setAutoPauseEnabled, liveActivityMetric, setLiveActivityMetric }),
    [autoPauseEnabled, setAutoPauseEnabled, liveActivityMetric, setLiveActivityMetric],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextType {
  return useContext(PreferencesContext);
}
