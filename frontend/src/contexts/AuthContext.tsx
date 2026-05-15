import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../services/api';
import type { UserResponse } from '../services/api';
import { CacheKeys, clearAllLocalData, clearCached, getCached, setCached } from '../services/offlineStorage';

interface AuthContextType {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requestOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  updateUser: (input: api.UpdateUserInput) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();

    const unsubscribe = api.onAuthLost(() => {
      setUser(null);
    });

    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap effect; checkAuthState identity is intentionally ignored
  }, []);

  async function fetchAndSetUser() {
    let profile = await api.getMe();

    if (!profile.timezone) {
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detectedTz) {
        profile = await api.updateMe({ timezone: detectedTz });
      }
    }

    setUser(profile);
    void setCached(CacheKeys.userProfile, profile);
  }

  async function restoreFromCacheIfOffline() {
    // Only restore when tokens are still on disk: a missing token means either a
    // fresh install or a genuine auth failure (refresh got 401), in which case
    // the user really is logged out.
    if (!(await api.getAccessToken())) return;
    const cached = await getCached<UserResponse>(CacheKeys.userProfile);
    if (cached) {
      setUser(cached);
      if (__DEV__) console.warn('[Auth] Offline boot, using cached profile');
    }
  }

  async function checkAuthState() {
    try {
      const validToken = await api.getValidAccessToken();
      if (!validToken) {
        await restoreFromCacheIfOffline();
        return;
      }

      try {
        await fetchAndSetUser();
      } catch (e) {
        if (api.isNetworkError(e)) {
          await restoreFromCacheIfOffline();
          return;
        }
        if (__DEV__) console.error('[Auth] Session invalid:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function requestOtp(email: string) {
    await api.requestOtp(email);
  }

  async function verifyOtp(email: string, code: string) {
    await api.verifyOtp(email, code);
    await fetchAndSetUser();
  }

  async function signOut() {
    await api.clearTokens();
    await clearCached(CacheKeys.userProfile);
    setUser(null);
  }

  async function deleteAccount() {
    await api.deleteMe();
    await api.clearTokens();
    await clearAllLocalData();
    setUser(null);
  }

  async function updateUser(input: api.UpdateUserInput) {
    const updated = await api.updateMe(input);
    setUser(updated);
    void setCached(CacheKeys.userProfile, updated);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        requestOtp,
        verifyOtp,
        signOut,
        deleteAccount,
        updateUser,
        refreshUser: fetchAndSetUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
