import { useCallback, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Runs a fetch callback on mount and every time the screen gains focus.
 * Silently catches errors to avoid unhandled rejections.
 */
export function useFetchOnFocus(fetchFn: () => Promise<void>): void {
  const stableFetch = useCallback(() => {
    fetchFn().catch(() => {});
  }, [fetchFn]);

  useEffect(() => {
    stableFetch();
  }, [stableFetch]);

  useFocusEffect(
    useCallback(() => {
      stableFetch();
    }, [stableFetch]),
  );
}
