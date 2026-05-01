import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

// `null` means "not yet known" — callers should treat unknown as online so the
// offline banner doesn't flash during the first paint.
export function useNetworkStatus(): boolean | null {
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  useEffect(() => {
    NetInfo.fetch().then((state) => setIsOnline(!!state.isConnected));
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  return isOnline;
}
