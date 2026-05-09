import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { WorkoutAnalytics } from '../types/gps';

function resolveBaseUrl(): string {
  if (!__DEV__) return 'https://gritty-fitness-k9cj7.ondigitalocean.app';

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

// True when an error is *not* a server-originated response (likely offline / DNS / TLS).
export function isNetworkError(e: unknown): boolean {
  return !(e instanceof ApiError || e instanceof AuthError);
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

function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(payload));
    const expiresAt = ((decoded.exp as number) ?? 0) * 1000;
    // Consider expired if less than 30s remaining
    return expiresAt <= Date.now() + 30_000;
  } catch {
    return true;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  if (!isTokenExpired(token)) return token;

  try {
    const refreshed = await attemptRefresh();
    if (refreshed) return getAccessToken();
    await clearTokens();
    notifyAuthLost();
    return null;
  } catch {
    // Network error — keep tokens so the user stays signed in for the next attempt.
    return null;
  }
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

// Returns true on success, false when the server explicitly rejects the refresh
// token (genuine auth failure). Throws on network errors so callers don't
// confuse "offline" with "logged out".
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

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  }).catch((err) => {
    if (__DEV__) console.error(`[API] Network error for ${url}:`, err);
    throw err;
  });

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
      const logFn = response.status === 403 ? console.warn : console.error;
      logFn(`[API] ${response.status} response:`, error);
    }
    throw new ApiError(response.status, error.error || error.message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  timezone?: string;
  units_preference: string;
  max_heart_rate: number;
  weekly_effort_goal: number;
  birth_year?: number;
  height_cm?: number;
  weight_kg?: number;
  profile_completed: boolean;
  consents_completed_at?: string;
  subscription_tier: string;
  subscription_expires_at?: string;
}

interface AuthResponse {
  user: UserResponse;
  access_token: string;
  refresh_token: string;
  is_new_user: boolean;
}

export interface ConsentInput {
  type: 'terms' | 'privacy' | 'health_data' | 'age_16_plus' | 'marketing';
  version: string;
}

export async function recordConsents(
  consents: ConsentInput[],
  birthYear: number,
): Promise<void> {
  await apiFetch<void>('/api/v1/consents', {
    method: 'POST',
    body: JSON.stringify({ consents, birth_year: birthYear }),
  });
}

export async function requestOtp(email: string): Promise<void> {
  await apiFetch<void>('/api/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(
  email: string,
  code: string,
): Promise<AuthResponse> {
  const resp = await apiFetch<AuthResponse>('/api/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
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
  max_heart_rate?: number;
  weekly_effort_goal?: number;
  birth_year?: number;
  height_cm?: number;
  weight_kg?: number;
  profile_completed?: boolean;
}

export async function updateMe(input: UpdateUserInput): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/v1/users/me', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteMe(): Promise<void> {
  await apiFetch<void>('/api/v1/users/me', { method: 'DELETE' });
}

export async function revokeAllSessions(): Promise<void> {
  await apiFetch<void>('/api/v1/auth/revoke-all', { method: 'POST' });
}

// exportMyData fetches the GDPR Art. 15/20 archive as a JSON object. The
// server returns a Content-Disposition attachment but RN's fetch reads it as
// JSON; the caller decides how to surface it (Share, save, etc.).
export async function exportMyData(): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>('/api/v1/users/me/export');
}

export interface ChatMessageResponse {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  program_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ChatSegmentHeader {
  label: string;
  subtitle?: string;
  ref_type?: string;
  ref_id?: string;
}

export interface ChatSegmentResponse {
  id: string;
  segment_type: string;
  status: string;
  start_message_id?: string;
  end_message_id?: string;
  header?: ChatSegmentHeader;
  started_at: string;
  completed_at?: string;
}

interface ChatHistoryResponse {
  messages: ChatMessageResponse[];
  segments: ChatSegmentResponse[];
  has_more: boolean;
}

export async function getChatHistory(
  limit?: number,
  before?: string,
): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (before) params.set('before', before);
  const query = params.toString();
  return apiFetch<ChatHistoryResponse>(`/api/v1/chat/history${query ? `?${query}` : ''}`);
}

type ChatClearedListener = () => void;
const chatClearedListeners: ChatClearedListener[] = [];

export function onChatCleared(listener: ChatClearedListener): () => void {
  chatClearedListeners.push(listener);
  return () => {
    const idx = chatClearedListeners.indexOf(listener);
    if (idx >= 0) chatClearedListeners.splice(idx, 1);
  };
}

export async function deleteChatHistory(): Promise<void> {
  await apiFetch<{ status: string }>('/api/v1/chat/history', { method: 'DELETE' });
  chatClearedListeners.forEach((fn) => fn());
}

export async function deleteGritMemory(): Promise<void> {
  await apiFetch<{ status: string }>('/api/v1/chat/memory', { method: 'DELETE' });
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
  date: string;
  activity_type: string;
  prescription: Record<string, any>;
  notes?: string;
  order_index: number;
  linked_workout_id?: string;
}

export interface WeekResponse {
  id: string;
  week_number: number;
  start_date: string;
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

export interface LinkableActivity extends UpcomingActivity {
  same_type: boolean;
}

export interface LinkableActivityOpts {
  referenceDate?: string; // YYYY-MM-DD; defaults to today server-side
  windowDays?: number; // 1-14, defaults to 3 server-side
}

export interface CriterionInput {
  key: string;
  label: string;
  value: string;
  value_type: string;
  display_order: number;
}

export interface CreateProgramPhaseInput {
  name: string;
  order_index: number;
  duration_weeks: number;
  template_week: {
    activities: {
      day_of_week: number;
      activity_type: string;
      prescription: Record<string, any>;
      notes?: string;
      order_index?: number;
    }[];
  };
}

export interface CreateProgramInput {
  name: string;
  sport: string;
  goal_description: string;
  start_date: string;
  end_date: string;
  phases: CreateProgramPhaseInput[];
}

export async function createProgram(input: CreateProgramInput): Promise<ProgramDetail> {
  return apiFetch<ProgramDetail>('/api/v1/programs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
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

export async function getLinkableActivities(
  activityType: string,
  opts: LinkableActivityOpts = {},
): Promise<LinkableActivity[]> {
  const params = new URLSearchParams({ activity_type: activityType });
  if (opts.referenceDate) params.set('reference_date', opts.referenceDate);
  if (opts.windowDays) params.set('window_days', String(opts.windowDays));
  return apiFetch<LinkableActivity[]>(`/api/v1/activities/linkable?${params.toString()}`);
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
  linked_workout_id?: string;
  linked_workout_recorded_at?: string;
  linked_workout_source?: string;
  linked_gps_route?: Record<string, any>;
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
  gps_route?: Record<string, any>;
  heart_rate_data?: Record<string, any>;
  notes?: string;
  effort_score?: number;
  completion_status?: 'completed' | 'met_targets' | 'below_targets';
  created_at: string;
  updated_at: string;
}

export interface SaveWorkoutInput {
  scheduled_activity_id?: string;
  activity_type: string;
  recorded_data: Record<string, any>;
  source: 'manual' | 'gps' | 'garmin' | 'apple_health' | 'gpx' | 'tcx' | 'fit' | 'csv';
  started_at: string;
  finished_at?: string;
  gps_route?: Record<string, any>;
  heart_rate_data?: Record<string, any>;
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
  start_date?: string;
  end_date?: string;
}): Promise<WorkoutResponse[]> {
  const p = new URLSearchParams();
  if (params?.limit != null) p.set('limit', String(params.limit));
  if (params?.offset != null) p.set('offset', String(params.offset));
  if (params?.activity_type) p.set('activity_type', params.activity_type);
  if (params?.start_date) p.set('start_date', params.start_date);
  if (params?.end_date) p.set('end_date', params.end_date);
  const query = p.toString();
  return apiFetch<WorkoutResponse[]>(`/api/v1/workouts${query ? `?${query}` : ''}`);
}

export async function getWorkout(id: string): Promise<WorkoutResponse> {
  return apiFetch<WorkoutResponse>(`/api/v1/workouts/${id}`);
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await apiFetch<{ status: string }>(`/api/v1/workouts/${workoutId}`, { method: 'DELETE' });
}

export async function linkWorkoutToActivity(workoutId: string, scheduledActivityId: string): Promise<void> {
  await apiFetch<{ status: string }>(`/api/v1/workouts/${workoutId}/link`, {
    method: 'PUT',
    body: JSON.stringify({ scheduled_activity_id: scheduledActivityId }),
  });
}

// Weekly effort

export interface WeeklyEffortResponse {
  total_effort: number;
  workout_count: number;
  goal: number;
}

export async function getWeeklyEffort(): Promise<WeeklyEffortResponse> {
  return apiFetch<WeeklyEffortResponse>('/api/v1/workouts/weekly-effort');
}

// Usage types

export interface ResourceUsage {
  used: number;
  limit: number;
  period: string;
  resets_at: string;
}

export interface ProgramUsage {
  current_count: number;
  limit: number;
}

export interface UsageSummary {
  tier: string;
  chat_messages: ResourceUsage;
  program_creations: ResourceUsage;
  post_workout_reviews: ResourceUsage;
  programs: ProgramUsage;
}

export async function getUsage(): Promise<UsageSummary> {
  return apiFetch<UsageSummary>('/api/v1/users/me/usage');
}

// Workout analytics (premium)

export async function getWorkoutAnalytics(workoutId: string): Promise<WorkoutAnalytics> {
  return apiFetch<WorkoutAnalytics>(`/api/v1/workouts/${workoutId}/analytics`);
}

// Post-workout review polling

export interface WorkoutReviewResponse {
  status: 'pending' | 'ready';
  message?: ChatMessageResponse;
}

export async function getWorkoutReview(workoutId: string): Promise<WorkoutReviewResponse> {
  return apiFetch<WorkoutReviewResponse>(`/api/v1/workouts/${workoutId}/review`);
}

export async function triggerWorkoutReview(workoutId: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/api/v1/workouts/${workoutId}/review/trigger`, {
    method: 'POST',
  });
}

// Push notifications

export async function registerPushToken(token: string, platform: 'ios' | 'android'): Promise<void> {
  await apiFetch<{ status: string }>('/api/v1/devices/push-token', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export async function deletePushToken(token: string): Promise<void> {
  await apiFetch<{ status: string }>('/api/v1/devices/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export interface NotificationType {
  key: string;
  label: string;
  description: string;
  requires_premium: boolean;
  enabled: boolean;
}

export async function getNotificationTypes(): Promise<NotificationType[]> {
  return apiFetch<NotificationType[]>('/api/v1/notifications/types');
}

export async function updateNotificationPreference(
  notifType: string,
  enabled: boolean,
): Promise<void> {
  await apiFetch<{ status: string }>(`/api/v1/notifications/preferences/${notifType}`, {
    method: 'PUT',
    body: JSON.stringify({ enabled }),
  });
}
