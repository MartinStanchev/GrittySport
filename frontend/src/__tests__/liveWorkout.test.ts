import {
  buildNorthUpCamera,
  formatLiveWorkoutType,
  getCollapsedMetricPages,
  getGPSQualityState,
  getLiveMapPadding,
  getRecordingStatusLabel,
} from '../utils/liveWorkout';

describe('liveWorkout helpers', () => {
  test('formats activity type labels for the live tracker', () => {
    expect(formatLiveWorkoutType('open_water_swim')).toBe('Open Water Swim');
    expect(formatLiveWorkoutType('run')).toBe('Run');
  });

  test('maps recording states to human-friendly labels', () => {
    expect(getRecordingStatusLabel('idle')).toBe('Ready');
    expect(getRecordingStatusLabel('recording')).toBe('Recording');
    expect(getRecordingStatusLabel('paused')).toBe('Auto-paused');
  });

  test('classifies GPS signal quality from the latest accuracy', () => {
    expect(getGPSQualityState(undefined, false)).toEqual({ label: 'Searching', tone: 'searching' });
    expect(getGPSQualityState(7, true)).toEqual({ label: 'Locked', tone: 'good' });
    expect(getGPSQualityState(18, true)).toEqual({ label: 'Tracking', tone: 'fair' });
    expect(getGPSQualityState(60, true)).toEqual({ label: 'Weak GPS', tone: 'searching' });
  });

  test('builds a north-up camera while preserving the current zoom level', () => {
    expect(
      buildNorthUpCamera(
        { latitude: 48.1351, longitude: 11.582 },
        { zoom: 16.5, altitude: 420 },
      ),
    ).toEqual({
      center: { latitude: 48.1351, longitude: 11.582 },
      heading: 0,
      pitch: 0,
      zoom: 16.5,
      altitude: 420,
    });
  });

  test('computes map padding so the user marker recenters inside the visible map area', () => {
    expect(getLiveMapPadding(44, 34, 132)).toEqual({
      top: 180,
      right: 16,
      bottom: 190,
      left: 16,
    });
  });

  describe('getCollapsedMetricPages', () => {
    test('returns distance + pace for runners, avg pace + HR, cadence + elevation', () => {
      const pages = getCollapsedMetricPages(true, true);
      expect(pages).toHaveLength(3);
      expect(pages[0].left.id).toBe('distance');
      expect(pages[0].right.id).toBe('pace');
      expect(pages[1].left.id).toBe('avg_pace');
      expect(pages[1].right.id).toBe('heart_rate');
      expect(pages[2].left.id).toBe('cadence');
      expect(pages[2].right.id).toBe('elevation');
    });

    test('returns distance + speed for non-runners with avg speed', () => {
      const pages = getCollapsedMetricPages(false, false);
      expect(pages).toHaveLength(3);
      expect(pages[0].right.id).toBe('speed');
      expect(pages[0].right.unit).toBe('km/h');
      expect(pages[1].left.id).toBe('avg_speed');
    });

    test('uses elevation + lap when cadence is not available', () => {
      const pages = getCollapsedMetricPages(true, false);
      expect(pages[2].left.id).toBe('elevation');
      expect(pages[2].right.id).toBe('lap');
    });

    test('each page has left and right slots with labels', () => {
      const pages = getCollapsedMetricPages(true, true);
      for (const page of pages) {
        expect(page.left.label).toBeTruthy();
        expect(page.right.label).toBeTruthy();
        expect(page.left.id).toBeTruthy();
        expect(page.right.id).toBeTruthy();
      }
    });
  });
});
