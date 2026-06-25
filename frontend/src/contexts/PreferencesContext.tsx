import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Device-local user preferences that aren't tied to the server account, persisted with
 * expo-secure-store (same pattern as ThemeContext). Currently just GPS auto-pause.
 */
interface PreferencesContextType {
  // When on, GPS recording auto-pauses after a run of near-stationary fixes (e.g. a red
  // light) and auto-resumes once you're moving again.
  autoPauseEnabled: boolean;
  setAutoPauseEnabled: (enabled: boolean) => void;
}

const AUTO_PAUSE_KEY = 'gps_auto_pause_enabled';

const PreferencesContext = createContext<PreferencesContextType>({
  autoPauseEnabled: true,
  setAutoPauseEnabled: () => {},
});

let _secureStore: typeof import('expo-secure-store') | null = null;
async function getSecureStore() {
  if (!_secureStore) _secureStore = await import('expo-secure-store');
  return _secureStore;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [autoPauseEnabled, setAutoPauseState] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const store = await getSecureStore();
        const stored = await store.getItemAsync(AUTO_PAUSE_KEY);
        if (stored === 'false') setAutoPauseState(false);
      } catch {
        // ignore — default to enabled
      }
    })();
  }, []);

  const setAutoPauseEnabled = useCallback((enabled: boolean) => {
    setAutoPauseState(enabled);
    getSecureStore()
      .then((store) => store.setItemAsync(AUTO_PAUSE_KEY, enabled ? 'true' : 'false'))
      .catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ autoPauseEnabled, setAutoPauseEnabled }),
    [autoPauseEnabled, setAutoPauseEnabled],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextType {
  return useContext(PreferencesContext);
}
