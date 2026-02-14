import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

function resolveBaseUrl(): string {
  if (!__DEV__) return 'https://api.grittyfitness.com';

  // Web always uses localhost since it runs in the same browser
  if (Platform.OS === 'web') return 'http://localhost:8080';

  // Native devices can override via env var (e.g. LAN IP for physical devices)
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl;

  if (Platform.OS === 'android') return 'http://10.0.2.2:8080';
  
  return 'http://localhost:8080';
}

export const API_BASE_URL = resolveBaseUrl();

if (__DEV__) {
  console.log(`[API] Base URL: ${API_BASE_URL}, Platform: ${Platform.OS}`);
}

const isWeb = Platform.OS === 'web';

async function storageGet(key: string): Promise<string | null> {
  if (isWeb) return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function storageSet(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function storageDelete(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class AuthError extends Error {
  constructor(message: string = 'Session expired') {
    super(message);
  }
}

type AuthLostListener = () => void;
const authLostListeners: AuthLostListener[] = [];

export function onAuthLost(listener: AuthLostListener): () => void {
  authLostListeners.push(listener);
  return () => {
    const idx = authLostListeners.indexOf(listener);
    if (idx >= 0) authLostListeners.splice(idx, 1);
  };
}

function notifyAuthLost() {
  authLostListeners.forEach((fn) => fn());
}

export async function getAccessToken(): Promise<string | null> {
  return storageGet('access_token');
}

export async function getRefreshToken(): Promise<string | null> {
  return storageGet('refresh_token');
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await storageSet('access_token', accessToken);
  await storageSet('refresh_token', refreshToken);
}

export async function clearTokens(): Promise<void> {
  await storageDelete('access_token');
  await storageDelete('refresh_token');
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const token = await getRefreshToken();
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: token }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      await setTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  isRetry = false,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  if (__DEV__) {
    console.log(`[API] ${options?.method ?? 'GET'} ${url}`);
  }

  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options?.headers as Record<string, string>) },
    });
  } catch (err) {
    if (__DEV__) {
      console.error(`[API] Network error for ${url}:`, err);
    }
    throw err;
  }

  if (__DEV__) {
    console.log(`[API] Response ${response.status} from ${url}`);
  }

  if (response.status === 401 && accessToken && !isRetry) {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      return apiFetch<T>(path, options, true);
    }
    await clearTokens();
    notifyAuthLost();
    throw new AuthError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    if (__DEV__) {
      console.error(`[API] Error response:`, error);
    }
    throw new ApiError(response.status, error.error || error.message || 'Request failed');
  }

  return response.json();
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  timezone?: string;
  units_preference: string;
}

interface AuthResponse {
  user: UserResponse;
  access_token: string;
  refresh_token: string;
}

export async function register(
  email: string,
  password: string,
  name: string,
): Promise<AuthResponse> {
  const resp = await apiFetch<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  await setTokens(resp.access_token, resp.refresh_token);
  return resp;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const resp = await apiFetch<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  await setTokens(resp.access_token, resp.refresh_token);
  return resp;
}

export async function getMe(): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/v1/users/me');
}

export interface UpdateUserInput {
  name?: string;
  timezone?: string;
  units_preference?: string;
}

export async function updateMe(input: UpdateUserInput): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/v1/users/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
