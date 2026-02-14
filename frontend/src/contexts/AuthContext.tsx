import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface TokenPayload {
  user: User;
  expiresAt: number;
}

function parseToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload));
    if (!decoded.sub || !decoded.email) return null;
    return {
      user: {
        id: decoded.sub as string,
        email: decoded.email as string,
        name: (decoded.name as string) || '',
      },
      expiresAt: ((decoded.exp as number) ?? 0) * 1000,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();

    const unsubscribe = api.onAuthLost(() => {
      setUser(null);
    });

    return unsubscribe;
  }, []);

  async function checkAuthState() {
    try {
      const accessToken = await api.getAccessToken();
      if (!accessToken) return;

      const parsed = parseToken(accessToken);
      if (!parsed) {
        await api.clearTokens();
        return;
      }

      if (parsed.expiresAt > Date.now()) {
        setUser(parsed.user);
        return;
      }

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
        const refreshed = parseToken(data.access_token);
        if (refreshed) setUser(refreshed.user);
      } else {
        await api.clearTokens();
      }
    } catch (e) {
      if (__DEV__) {
        console.error('[Auth] Failed to restore session:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const resp = await api.login(email, password);
    setUser(resp.user);
  }

  async function signUp(email: string, password: string, name: string) {
    const resp = await api.register(email, password, name);
    setUser(resp.user);
  }

  async function signOut() {
    await api.clearTokens();
    setUser(null);
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
