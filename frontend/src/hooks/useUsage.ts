import { useCallback, useEffect, useState } from 'react';
import { UsageSummary, getUsage } from '../services/usageService';

export function useUsage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getUsage();
      setUsage(data);
    } catch (err) {
      if (__DEV__) console.error('[useUsage] Failed to fetch usage:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { usage, loading, refresh };
}
