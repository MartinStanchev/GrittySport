import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { LightColors, DarkColors } from '../constants/colors';
import type { ThemeColors } from '../constants/colors';

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: LightColors,
  isDark: false,
  toggleTheme: () => {},
});

let _secureStore: typeof import('expo-secure-store') | null = null;
async function getSecureStore() {
  if (!_secureStore) _secureStore = await import('expo-secure-store');
  return _secureStore;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const store = await getSecureStore();
        const stored = await store.getItemAsync('theme_mode');
        if (stored === 'dark') setIsDark(true);
      } catch {
        // ignore — default to light
      }
    })();
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      getSecureStore()
        .then((store) => store.setItemAsync('theme_mode', next ? 'dark' : 'light'))
        .catch(() => {});
      return next;
    });
  }, []);

  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo(() => ({ colors, isDark, toggleTheme }), [colors, isDark, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
