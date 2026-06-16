// Verifies the offline-resilient read/write helpers: saveWorkoutWithFallback
// (queues offline) and the cachedReads wrappers (serve cache on network error).
import NetInfo from '@react-native-community/netinfo';

class FakeApiError extends Error {} // stands in for a server-originated error

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

jest.mock('../services/api', () => ({
  saveWorkout: jest.fn(),
  getWorkouts: jest.fn(),
  getProgram: jest.fn(),
  // network error == anything that isn't our FakeApiError marker
  isNetworkError: (e: unknown) => !(e instanceof FakeApiError),
}));

jest.mock('../services/offlineStorage', () => ({
  CacheKeys: { recentWorkouts: 'recent_workouts' },
  programDetailKey: (id: string) => `program_detail:${id}`,
  getCached: jest.fn(),
  setCached: jest.fn(),
  savePendingWorkout: jest.fn(),
  getPendingWorkouts: jest.fn(),
  markSynced: jest.fn(),
}));

import { saveWorkoutWithFallback } from '../services/syncService';
import { getProgramCached, getRecentWorkoutsCached } from '../services/cachedReads';
import * as api from '../services/api';
import * as storage from '../services/offlineStorage';

const netFetch = NetInfo.fetch as jest.Mock;

const payload = {
  activity_type: 'run',
  recorded_data: { distance_km: 5 },
  source: 'gps' as const,
  started_at: '2026-06-15T08:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('saveWorkoutWithFallback', () => {
  it('saves to the server when online and returns the workout', async () => {
    netFetch.mockResolvedValue({ isConnected: true });
    (api.saveWorkout as jest.Mock).mockResolvedValue({ id: 'srv-1' });

    const result = await saveWorkoutWithFallback(payload);

    expect(result).toEqual({ id: 'srv-1' });
    expect(storage.savePendingWorkout).not.toHaveBeenCalled();
  });

  it('queues to the pending store and returns null when offline', async () => {
    netFetch.mockResolvedValue({ isConnected: false });

    const result = await saveWorkoutWithFallback(payload);

    expect(result).toBeNull();
    expect(api.saveWorkout).not.toHaveBeenCalled();
    expect(storage.savePendingWorkout).toHaveBeenCalledTimes(1);
    const queued = (storage.savePendingWorkout as jest.Mock).mock.calls[0][0];
    expect(queued.activity_type).toBe('run');
    expect(queued.recorded_data).toBe(JSON.stringify(payload.recorded_data));
  });

  it('queues when connected but the request fails', async () => {
    netFetch.mockResolvedValue({ isConnected: true });
    (api.saveWorkout as jest.Mock).mockRejectedValue(new Error('boom'));

    const result = await saveWorkoutWithFallback(payload);

    expect(result).toBeNull();
    expect(storage.savePendingWorkout).toHaveBeenCalledTimes(1);
  });
});

describe('cachedReads', () => {
  it('returns fresh data and writes it to the cache on success', async () => {
    (api.getProgram as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Plan' });

    const result = await getProgramCached('p1');

    expect(result).toEqual({ id: 'p1', name: 'Plan' });
    expect(storage.setCached).toHaveBeenCalledWith('program_detail:p1', { id: 'p1', name: 'Plan' });
  });

  it('falls back to the cached snapshot on a network error', async () => {
    (api.getProgram as jest.Mock).mockRejectedValue(new Error('offline'));
    (storage.getCached as jest.Mock).mockResolvedValue({ id: 'p1', name: 'Cached' });

    const result = await getProgramCached('p1');

    expect(result).toEqual({ id: 'p1', name: 'Cached' });
  });

  it('rethrows non-network errors instead of using the cache', async () => {
    (api.getWorkouts as jest.Mock).mockRejectedValue(new FakeApiError('401'));

    await expect(getRecentWorkoutsCached()).rejects.toBeInstanceOf(FakeApiError);
    expect(storage.getCached).not.toHaveBeenCalled();
  });
});
