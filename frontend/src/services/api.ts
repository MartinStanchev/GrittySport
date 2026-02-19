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

export interface ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  context: string;
  program_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ChatHistoryResponse {
  messages: ChatMessageResponse[];
  has_more: boolean;
}

export async function getChatHistory(
  context?: string,
  limit?: number,
  before?: string,
): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams();
  if (context) params.set('context', context);
  if (limit) params.set('limit', String(limit));
  if (before) params.set('before', before);
  const query = params.toString();
  return apiFetch<ChatHistoryResponse>(`/api/v1/chat/history${query ? `?${query}` : ''}`);
}

export function getWsBaseUrl(): string {
  return API_BASE_URL.replace(/^http/, 'ws');
}

// Program types

export interface ProgramSummary {
  id: string;
  name: string;
  sport?: string;
  goal_description?: string;
  start_date: string;
  end_date?: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CriterionResponse {
  id: string;
  key: string;
  label: string;
  value: string;
  value_type: string;
  display_order: number;
}

export interface ScheduledActivityResponse {
  id: string;
  day_of_week: number;
  activity_type: string;
  prescription: Record<string, any>;
  notes?: string;
  order_index: number;
}

export interface WeekResponse {
  id: string;
  week_number: number;
  start_date?: string;
  activities: ScheduledActivityResponse[];
}

export interface PhaseResponse {
  id: string;
  name: string;
  order_index: number;
  start_date?: string;
  end_date?: string;
  weeks: WeekResponse[];
}

export interface ProgramDetail extends ProgramSummary {
  phases: PhaseResponse[];
  criteria: CriterionResponse[];
}

export interface UpcomingActivity {
  id: string;
  activity_type: string;
  day_of_week: number;
  prescription: Record<string, any>;
  notes?: string;
  week_number: number;
  phase_name: string;
  date: string;
}

export interface CriterionInput {
  key: string;
  label: string;
  value: string;
  value_type: string;
  display_order: number;
}

export async function getPrograms(): Promise<ProgramSummary[]> {
  return apiFetch<ProgramSummary[]>('/api/v1/programs');
}

export async function getProgram(id: string): Promise<ProgramDetail> {
  return apiFetch<ProgramDetail>(`/api/v1/programs/${id}`);
}

export async function updateProgram(
  id: string,
  input: { name?: string; status?: string },
): Promise<ProgramSummary> {
  return apiFetch<ProgramSummary>(`/api/v1/programs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteProgram(id: string): Promise<void> {
  await apiFetch<{ deleted: boolean }>(`/api/v1/programs/${id}`, { method: 'DELETE' });
}

export async function clearChatMemory(): Promise<void> {
  await apiFetch<{ cleared: boolean }>('/api/v1/chat/memory', { method: 'DELETE' });
}

export async function getProgramCriteria(id: string): Promise<CriterionResponse[]> {
  return apiFetch<CriterionResponse[]>(`/api/v1/programs/${id}/criteria`);
}

export async function updateProgramCriteria(
  id: string,
  criteria: CriterionInput[],
): Promise<CriterionResponse[]> {
  return apiFetch<CriterionResponse[]>(`/api/v1/programs/${id}/criteria`, {
    method: 'PUT',
    body: JSON.stringify(criteria),
  });
}

export async function getUpcomingActivities(): Promise<UpcomingActivity[]> {
  return apiFetch<UpcomingActivity[]>('/api/v1/activities/upcoming');
}

// Activity detail types

export interface ActivityDetail {
  id: string;
  program_id: string;
  program_name: string;
  activity_type: string;
  day_of_week: number;
  prescription: Record<string, any>;
  notes?: string;
  order_index: number;
  week_number: number;
  phase_name: string;
  date: string;
}

export interface UpdateActivityInput {
  prescription?: Record<string, any>;
  notes?: string;
  day_of_week?: number;
  activity_type?: string;
}

export async function getActivity(activityId: string): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/api/v1/activities/${activityId}`);
}

export async function updateActivity(
  programId: string,
  activityId: string,
  input: UpdateActivityInput,
): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/api/v1/programs/${programId}/activities/${activityId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export interface CreateActivityInput {
  day_of_week: number;
  activity_type: string;
  prescription?: Record<string, any>;
  notes?: string;
}

export async function createActivity(
  programId: string,
  weekId: string,
  input: CreateActivityInput,
): Promise<ActivityDetail> {
  return apiFetch<ActivityDetail>(`/api/v1/programs/${programId}/weeks/${weekId}/activities`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// Workout types

export interface WorkoutResponse {
  id: string;
  user_id: string;
  scheduled_activity_id?: string;
  activity_type: string;
  recorded_data: Record<string, any>;
  source: string;
  started_at: string;
  finished_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SaveWorkoutInput {
  scheduled_activity_id?: string;
  activity_type: string;
  recorded_data: Record<string, any>;
  source: 'manual';
  started_at: string;
  finished_at?: string;
  notes?: string;
}

export async function saveWorkout(input: SaveWorkoutInput): Promise<WorkoutResponse> {
  return apiFetch<WorkoutResponse>('/api/v1/workouts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getWorkouts(params?: {
  limit?: number;
  offset?: number;
  activity_type?: string;
}): Promise<WorkoutResponse[]> {
  const p = new URLSearchParams();
  if (params?.limit) p.set('limit', String(params.limit));
  if (params?.offset) p.set('offset', String(params.offset));
  if (params?.activity_type) p.set('activity_type', params.activity_type);
  const query = p.toString();
  return apiFetch<WorkoutResponse[]>(`/api/v1/workouts${query ? `?${query}` : ''}`);
}

export async function getWorkout(id: string): Promise<WorkoutResponse> {
  return apiFetch<WorkoutResponse>(`/api/v1/workouts/${id}`);
}
