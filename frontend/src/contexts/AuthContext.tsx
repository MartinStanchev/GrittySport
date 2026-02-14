import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../services/api';
import type { UserResponse } from '../services/api';

interface AuthContextType {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (input: api.UpdateUserInput) => Promise<void>;
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
  }

  async function checkAuthState() {
    try {
      const accessToken = await api.getAccessToken();
      if (!accessToken) return;

      const parts = accessToken.split('.');
      if (parts.length !== 3) {
        await api.clearTokens();
        return;
      }

      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const decoded = JSON.parse(atob(payload));
      const expiresAt = ((decoded.exp as number) ?? 0) * 1000;

      if (expiresAt <= Date.now()) {
        const refreshToken = await api.getRefreshToken();
        if (!refreshToken) return;

        const response = await fetch(`${api.API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (response.ok) {
          const data = await response.json();
          await api.setTokens(data.access_token, data.refresh_token);
        } else {
          await api.clearTokens();
          return;
        }
      }

      await fetchAndSetUser();
    } catch (e) {
      if (__DEV__) {
        console.error('[Auth] Failed to restore session:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    await api.login(email, password);
    await fetchAndSetUser();
  }

  async function signUp(email: string, password: string, name: string) {
    await api.register(email, password, name);
    await fetchAndSetUser();
  }

  async function signOut() {
    await api.clearTokens();
    setUser(null);
  }

  async function updateUser(input: api.UpdateUserInput) {
    const updated = await api.updateMe(input);
    setUser(updated);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        updateUser,
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
