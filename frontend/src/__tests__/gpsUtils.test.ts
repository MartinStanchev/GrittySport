import {
  haversineMetres,
  rollingPaceSecPerKm,
  currentSpeedKph,
  avgPaceSecPerKm,
  avgSpeedKph,
  computeElevationGain,
  triggerLap,
  formatPaceSecPerKm,
  formatSpeedKph,
  formatDistanceKm,
  buildFinalGPSPayload,
  downsample,
  computePaceTimeSeries,
  computeSpeedTimeSeries,
  getHRZone,
  getHRZoneColor,
  HR_ZONE_COLORS,
  computeEffortScore,
  getEffortColor,
  computeKmSplits,
} from '../services/gpsUtils';
import type { GPSPoint, HRReading, CadenceReading } from '../types/gps';

// Helper: build a minimal GPSPoint
function pt(lat: number, lng: number, opts: Partial<GPSPoint> = {}): GPSPoint {
  return {
    lat,
    lng,
    altitude: opts.altitude ?? null,
    accuracy: opts.accuracy ?? 5,
    speed: opts.speed ?? null,
    timestamp: opts.timestamp ?? 0,
    distance_from_prev: opts.distance_from_prev ?? 0,
  };
}

// Helper: build a straight-line route of N points, each `stepM` metres apart
// along constant latitude, spaced `stepMs` milliseconds apart.
function straightRoute(
  n: number,
  stepM: number,
  stepMs: number,
  startLat = 52.0,
  startLng = 4.0
): GPSPoint[] {
  // 1° longitude ≈ 111 320 × cos(lat) m  at lat 52° ≈ 68 600 m
  const metresToLng = stepM / 68600;
  const points: GPSPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[i - 1] ?? null;
    const p = pt(startLat, startLng + i * metresToLng, { timestamp: i * stepMs });
    if (prev) {
      p.distance_from_prev = haversineMetres(prev, p);
    }
    points.push(p);
  }
  return points;
}

// ─── haversineMetres ───────────────────────────────────────────────────────

describe('haversineMetres', () => {
  it('returns 0 for identical points', () => {
    const p = pt(52.0, 4.0);
    expect(haversineMetres(p, p)).toBeCloseTo(0, 1);
  });

  it('computes ~111 km for 1° latitude difference', () => {
    const a = pt(0, 0);
    const b = pt(1, 0);
    // Haversine at equator: 1° ≈ 111 195 m (not 111 000 — varies by latitude model)
    const dist = haversineMetres(a, b);
    expect(dist).toBeGreaterThan(110_500);
    expect(dist).toBeLessThan(112_000);
  });

  it('computes known distance between Amsterdam and Utrecht (~34 km)', () => {
    const amsterdam = pt(52.3676, 4.9041);
    const utrecht = pt(52.0907, 5.1214);
    // Straight-line haversine distance is ~34 km (road distance is longer)
    const dist = haversineMetres(amsterdam, utrecht);
    expect(dist).toBeGreaterThan(30_000);
    expect(dist).toBeLessThan(40_000);
  });
});

// ─── rollingPaceSecPerKm ───────────────────────────────────────────────────

describe('rollingPaceSecPerKm', () => {
  it('returns 0 for a single point', () => {
    expect(rollingPaceSecPerKm([pt(0, 0)])).toBe(0);
  });

  it('returns 0 when distance is too small', () => {
    // Two points at same location, 1 s apart → 0 m
    const points = [
      pt(52, 4, { timestamp: 0, distance_from_prev: 0 }),
      pt(52, 4, { timestamp: 1000, distance_from_prev: 0 }),
    ];
    expect(rollingPaceSecPerKm(points)).toBe(0);
  });

  it('computes correct pace for 100 m in 60 s → 10:00 /km', () => {
    // 100 m in 60 000 ms → 600 s/km
    const points: GPSPoint[] = [
      { lat: 52, lng: 4, altitude: null, accuracy: 5, speed: null, timestamp: 0, distance_from_prev: 0 },
      { lat: 52, lng: 4, altitude: null, accuracy: 5, speed: null, timestamp: 60000, distance_from_prev: 100 },
    ];
    expect(rollingPaceSecPerKm(points)).toBeCloseTo(600, 0);
  });

  it('uses only the last windowSize points', () => {
    // 11 points, first 10 move slowly, last 2 move fast
    // With window=10, should see mostly the fast segment
    const slow = straightRoute(9, 10, 10000); // 10 m per 10 s = 1 m/s = 1000 s/km
    // Append a fast point 1000 m from the last slow point in 100 ms
    const lastSlow = slow[slow.length - 1];
    const fastPt: GPSPoint = {
      lat: lastSlow.lat,
      lng: lastSlow.lng + 1000 / 68600,
      altitude: null,
      accuracy: 5,
      speed: null,
      timestamp: lastSlow.timestamp + 100,
      distance_from_prev: 1000,
    };
    const allPoints = [...slow, fastPt];
    // window=2: only last 2 points = 1000 m in 0.1 s → very fast
    const pace = rollingPaceSecPerKm(allPoints, 2);
    expect(pace).toBeLessThan(1); // way below 1 s/km
  });
});

// ─── currentSpeedKph ──────────────────────────────────────────────────────

describe('currentSpeedKph', () => {
  it('returns 0 for a single point', () => {
    expect(currentSpeedKph([pt(0, 0)])).toBe(0);
  });

  it('computes ~3.6 km/h for 1 m/s', () => {
    // 5 m in 5 000 ms = 1 m/s = 3.6 km/h
    const points: GPSPoint[] = [
      { lat: 52, lng: 4, altitude: null, accuracy: 5, speed: null, timestamp: 0, distance_from_prev: 0 },
      { lat: 52, lng: 4, altitude: null, accuracy: 5, speed: null, timestamp: 5000, distance_from_prev: 5 },
    ];
    expect(currentSpeedKph(points)).toBeCloseTo(3.6, 1);
  });
});

// ─── avgPaceSecPerKm / avgSpeedKph ────────────────────────────────────────

describe('avgPaceSecPerKm', () => {
  it('returns 0 when distance is 0', () => {
    expect(avgPaceSecPerKm(0, 60)).toBe(0);
  });

  it('returns 0 when duration is 0', () => {
    expect(avgPaceSecPerKm(100, 0)).toBe(0);
  });

  it('computes 500 s/km for 2 km in 1000 s', () => {
    expect(avgPaceSecPerKm(2000, 1000)).toBeCloseTo(500, 1);
  });
});

describe('avgSpeedKph', () => {
  it('returns 0 when distance is 0', () => {
    expect(avgSpeedKph(0, 3600)).toBe(0);
  });

  it('computes 10 km/h for 10 km in 3600 s', () => {
    expect(avgSpeedKph(10000, 3600)).toBeCloseTo(10, 2);
  });
});

// ─── computeElevationGain ─────────────────────────────────────────────────

describe('computeElevationGain', () => {
  it('returns 0 for fewer than 2 points', () => {
    expect(computeElevationGain([])).toBe(0);
    expect(computeElevationGain([pt(0, 0, { altitude: 10 })])).toBe(0);
  });

  it('sums ascending altitude steps above 1 m threshold', () => {
    // Use 7 strictly-ascending points with 5 m steps so the median filter
    // (halfWindow=2) cannot smooth away the gain signal.
    const altitudes = [0, 5, 10, 15, 20, 25, 30];
    const points = altitudes.map((alt, i) =>
      pt(0, i * 0.01, {
        altitude: alt,
        timestamp: i * 1000,
        distance_from_prev: i > 0 ? 1000 : 0,
      })
    );
    const gain = computeElevationGain(points);
    // After smoothing, the net ascending difference should be well above 0
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThanOrEqual(30);
  });

  it('ignores sub-threshold noise (±0.5 m oscillation)', () => {
    const points = Array.from({ length: 10 }, (_, i) =>
      pt(0, i * 0.001, {
        altitude: 100 + (i % 2 === 0 ? 0.4 : -0.4), // ±0.4 m noise
        timestamp: i * 1000,
        distance_from_prev: 100,
      })
    );
    expect(computeElevationGain(points)).toBe(0);
  });

  it('handles null altitudes gracefully (no throw)', () => {
    const points = [
      pt(0, 0, { altitude: null }),
      pt(0, 1, { altitude: null }),
    ];
    expect(() => computeElevationGain(points)).not.toThrow();
  });
});

// ─── triggerLap ───────────────────────────────────────────────────────────

describe('triggerLap', () => {
  it('assigns correct lap number', () => {
    const points = straightRoute(5, 200, 1000);
    const lap = triggerLap(points, 0, [], []);
    expect(lap.lap_number).toBe(1);

    const lap2 = triggerLap(points, 0, [lap], []);
    expect(lap2.lap_number).toBe(2);
  });

  it('computes distance from points slice', () => {
    const points = straightRoute(3, 100, 10000); // 3 points, 100 m apart
    const lap = triggerLap(points, 0, [], []);
    // Slice from index 0: 2 intervals × 100 m = 200 m
    expect(lap.distance_m).toBeCloseTo(200, 0);
  });

  it('includes average HR when readings fall within lap time window', () => {
    const points = straightRoute(3, 100, 10000);
    const startTs = points[0].timestamp;
    const endTs = points[points.length - 1].timestamp;
    const hrReadings: HRReading[] = [
      { bpm: 140, timestamp: startTs + 1000 },
      { bpm: 160, timestamp: startTs + 5000 },
      { bpm: 180, timestamp: endTs - 1000 },
    ];
    const lap = triggerLap(points, 0, [], hrReadings);
    expect(lap.avg_hr).toBeCloseTo(160, 0); // (140+160+180)/3
  });

  it('omits avg_hr when no HR readings in window', () => {
    const points = straightRoute(3, 100, 10000);
    const lap = triggerLap(points, 0, [], []);
    expect(lap.avg_hr).toBeUndefined();
  });
});

// ─── Formatting helpers ────────────────────────────────────────────────────

describe('formatPaceSecPerKm', () => {
  it('returns --:-- for 0', () => {
    expect(formatPaceSecPerKm(0)).toBe('--:--');
  });

  it('formats 300 s/km as 5:00', () => {
    expect(formatPaceSecPerKm(300)).toBe('5:00');
  });

  it('formats 65 s/km as 1:05', () => {
    expect(formatPaceSecPerKm(65)).toBe('1:05');
  });

  it('formats 3600 s/km as 60:00', () => {
    expect(formatPaceSecPerKm(3600)).toBe('60:00');
  });
});

describe('formatSpeedKph', () => {
  it('returns 0.00 for 0', () => {
    expect(formatSpeedKph(0)).toBe('0.00');
  });

  it('formats with two decimal places', () => {
    expect(formatSpeedKph(12.345)).toBe('12.35');
  });
});

describe('formatDistanceKm', () => {
  it('formats metres as km with 2 decimals', () => {
    expect(formatDistanceKm(1500)).toBe('1.50');
    expect(formatDistanceKm(250)).toBe('0.25');
  });
});

// ─── buildFinalGPSPayload ─────────────────────────────────────────────────

describe('buildFinalGPSPayload', () => {
  it('builds a valid payload from a short route', () => {
    const startedAt = new Date(0);
    const finishedAt = new Date(600_000); // 10 minutes

    const points = straightRoute(10, 100, 60000); // 10 points, 100 m apart, 1 min each
    // Compute distance
    let totalDistanceM = 0;
    for (const p of points) totalDistanceM += p.distance_from_prev;

    const hrReadings: HRReading[] = [
      { bpm: 150, timestamp: 60_000 },
      { bpm: 160, timestamp: 300_000 },
    ];

    const result = buildFinalGPSPayload({
      activityType: 'run',
      points,
      laps: [],
      hrReadings,
      totalDistanceM,
      autoPausedDurationSec: 0,
      startedAt,
      finishedAt,
    });

    expect(result.routeData.sport).toBe('run');
    expect(result.routeData.distance_km).toBeCloseTo(totalDistanceM / 1000, 2);
    expect(result.routeData.duration_sec).toBe(600);
    expect(result.routeData.avg_hr).toBe(155); // (150+160)/2
    expect(result.hrData).not.toBeNull();
    expect(result.hrData?.readings).toHaveLength(2);
  });

  it('returns null hrData when no HR readings', () => {
    const points = straightRoute(2, 100, 30000);
    const result = buildFinalGPSPayload({
      activityType: 'cycling',
      points,
      laps: [],
      hrReadings: [],
      totalDistanceM: 100,
      autoPausedDurationSec: 0,
      startedAt: new Date(0),
      finishedAt: new Date(30_000),
    });
    expect(result.hrData).toBeNull();
    expect(result.routeData.sport).toBe('cycling');
  });

  it('subtracts autoPausedDurationSec from total time', () => {
    const result = buildFinalGPSPayload({
      activityType: 'run',
      points: straightRoute(2, 500, 400_000),
      laps: [],
      hrReadings: [],
      totalDistanceM: 500,
      autoPausedDurationSec: 100, // 100 s paused
      startedAt: new Date(0),
      finishedAt: new Date(400_000), // 400 s total
    });
    expect(result.routeData.duration_sec).toBe(300); // 400 - 100
  });
});

// ─── downsample ──────────────────────────────────────────────────────────

describe('downsample', () => {
  it('returns original array when length <= maxPoints', () => {
    const items = [1, 2, 3];
    expect(downsample(items, 5)).toBe(items); // same reference
    expect(downsample(items, 3)).toBe(items);
  });

  it('downsamples to exactly maxPoints items', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const result = downsample(items, 10);
    expect(result).toHaveLength(10);
  });

  it('preserves first element', () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const result = downsample(items, 5);
    expect(result[0]).toBe(0);
  });

  it('works with HR readings', () => {
    const readings: HRReading[] = Array.from({ length: 200 }, (_, i) => ({
      bpm: 60 + i,
      timestamp: i * 1000,
    }));
    const result = downsample(readings, 20);
    expect(result).toHaveLength(20);
    expect(result[0].bpm).toBe(60);
  });

  it('works with cadence readings', () => {
    const readings: CadenceReading[] = Array.from({ length: 100 }, (_, i) => ({
      spm: 160 + (i % 20),
      timestamp: i * 1000,
    }));
    const result = downsample(readings, 15);
    expect(result).toHaveLength(15);
  });
});

// ─── getHRZone / getHRZoneColor ──────────────────────────────────────────

describe('getHRZone', () => {
  const maxHR = 200;

  it('returns zone 1 for < 60% max HR', () => {
    expect(getHRZone(100, maxHR)).toBe(1); // 50%
    expect(getHRZone(119, maxHR)).toBe(1); // 59.5%
  });

  it('returns zone 2 for 60-69% max HR', () => {
    expect(getHRZone(120, maxHR)).toBe(2); // 60%
    expect(getHRZone(139, maxHR)).toBe(2); // 69.5%
  });

  it('returns zone 3 for 70-79% max HR', () => {
    expect(getHRZone(140, maxHR)).toBe(3); // 70%
    expect(getHRZone(159, maxHR)).toBe(3); // 79.5%
  });

  it('returns zone 4 for 80-89% max HR', () => {
    expect(getHRZone(160, maxHR)).toBe(4); // 80%
    expect(getHRZone(179, maxHR)).toBe(4); // 89.5%
  });

  it('returns zone 5 for >= 90% max HR', () => {
    expect(getHRZone(180, maxHR)).toBe(5); // 90%
    expect(getHRZone(200, maxHR)).toBe(5); // 100%
  });
});

describe('getHRZoneColor', () => {
  it('returns correct color for each zone', () => {
    expect(getHRZoneColor(100, 200)).toBe(HR_ZONE_COLORS[1]); // zone 1
    expect(getHRZoneColor(130, 200)).toBe(HR_ZONE_COLORS[2]); // zone 2
    expect(getHRZoneColor(150, 200)).toBe(HR_ZONE_COLORS[3]); // zone 3
    expect(getHRZoneColor(170, 200)).toBe(HR_ZONE_COLORS[4]); // zone 4
    expect(getHRZoneColor(190, 200)).toBe(HR_ZONE_COLORS[5]); // zone 5
  });
});

// ─── computePaceTimeSeries ───────────────────────────────────────────────

describe('computePaceTimeSeries', () => {
  it('returns empty for fewer than 2 points', () => {
    expect(computePaceTimeSeries([])).toEqual([]);
    expect(computePaceTimeSeries([pt(0, 0)])).toEqual([]);
  });

  it('returns pace time series from a steady route', () => {
    // 30 points, 100m apart, 30s interval → 300 s/km pace (5:00/km)
    const points = straightRoute(30, 100, 30000);
    const series = computePaceTimeSeries(points, 5);
    expect(series.length).toBeGreaterThan(0);

    // All paces should be roughly 300 s/km (5:00/km)
    for (const p of series) {
      expect(p.paceSecPerKm).toBeGreaterThan(200);
      expect(p.paceSecPerKm).toBeLessThan(400);
      expect(p.elapsedMin).toBeGreaterThanOrEqual(0);
    }
  });

  it('elapsed time increases monotonically', () => {
    const points = straightRoute(50, 100, 10000);
    const series = computePaceTimeSeries(points, 5);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].elapsedMin).toBeGreaterThan(series[i - 1].elapsedMin);
    }
  });
});

// ─── computeSpeedTimeSeries ──────────────────────────────────────────────

describe('computeSpeedTimeSeries', () => {
  it('returns empty for fewer than 2 points', () => {
    expect(computeSpeedTimeSeries([])).toEqual([]);
    expect(computeSpeedTimeSeries([pt(0, 0)])).toEqual([]);
  });

  it('returns speed time series from a steady route', () => {
    // 30 points, 100m apart, 10s interval → 10 m/s = 36 km/h
    const points = straightRoute(30, 100, 10000);
    const series = computeSpeedTimeSeries(points, 5);
    expect(series.length).toBeGreaterThan(0);

    for (const p of series) {
      expect(p.speedKph).toBeGreaterThan(25);
      expect(p.speedKph).toBeLessThan(50);
      expect(p.elapsedMin).toBeGreaterThanOrEqual(0);
    }
  });

  it('elapsed time increases monotonically', () => {
    const points = straightRoute(50, 100, 10000);
    const series = computeSpeedTimeSeries(points, 5);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].elapsedMin).toBeGreaterThan(series[i - 1].elapsedMin);
    }
  });
});

// ─── computeEffortScore ─────────────────────────────────────────────────

describe('computeEffortScore', () => {
  function hrReadings(bpms: number[], intervalMs = 60000): HRReading[] {
    return bpms.map((bpm, i) => ({ bpm, timestamp: i * intervalMs }));
  }

  it('returns 0 for empty readings', () => {
    const result = computeEffortScore([], 185, 3600);
    expect(result.score).toBe(0);
    expect(result.label).toBe('Easy');
  });

  it('returns 0 for a single reading', () => {
    const result = computeEffortScore([{ bpm: 120, timestamp: 0 }], 185, 3600);
    expect(result.score).toBe(0);
  });

  it('returns low score for Z1 workout', () => {
    // 30 minutes of HR at 100 bpm with max 185 = Z1 (< 60%)
    const readings = hrReadings(Array(31).fill(100), 60000);
    const result = computeEffortScore(readings, 185, 1800);
    expect(result.score).toBeLessThan(25);
    expect(result.label).toBe('Easy');
  });

  it('returns moderate score for Z2 workout', () => {
    // 60 minutes of HR at 125 bpm with max 185 = Z2 (67%)
    const readings = hrReadings(Array(61).fill(125), 60000);
    const result = computeEffortScore(readings, 185, 3600);
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect(result.score).toBeLessThan(65);
    expect(['Moderate', 'Hard']).toContain(result.label);
  });

  it('returns high score for Z4/Z5 workout', () => {
    // 45 minutes of HR at 170 bpm with max 185 = Z4/Z5
    const readings = hrReadings(Array(46).fill(170), 60000);
    const result = computeEffortScore(readings, 185, 2700);
    expect(result.score).toBeGreaterThan(50);
  });

  it('score is capped at 100', () => {
    // Very long hard workout should cap at 100
    const readings = hrReadings(Array(181).fill(180), 60000);
    const result = computeEffortScore(readings, 185, 10800);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

// ─── getEffortColor ──────────────────────────────────────────────────────

describe('getEffortColor', () => {
  it('returns green for easy', () => {
    expect(getEffortColor(10)).toBe('#4CAF50');
  });

  it('returns yellow for moderate', () => {
    expect(getEffortColor(30)).toBe('#FFC107');
  });

  it('returns orange for hard', () => {
    expect(getEffortColor(60)).toBe('#FF9800');
  });

  it('returns red for very hard', () => {
    expect(getEffortColor(80)).toBe('#F44336');
  });
});

// ─── computeKmSplits ─────────────────────────────────────────────────────

describe('computeKmSplits', () => {
  it('returns empty analysis for fewer than 2 points', () => {
    const result = computeKmSplits([]);
    expect(result.splits).toEqual([]);
    expect(result.fastestSplitKm).toBe(0);
  });

  it('returns empty if total distance < 1km', () => {
    // 500m route — too short for even 1 split
    const points = straightRoute(6, 100, 30000);
    const result = computeKmSplits(points);
    expect(result.splits.length).toBe(0);
  });

  it('produces correct splits for a multi-km route', () => {
    // 41 points, 100m apart = 4000m total, should produce 4 full km splits
    // Each point 30s apart = 300s per km = 5:00/km
    const points = straightRoute(41, 100, 30000);
    const result = computeKmSplits(points);

    expect(result.splits.length).toBeGreaterThanOrEqual(3);
    expect(result.splits[0].km).toBe(1);
    expect(result.splits[1].km).toBe(2);

    // Each split should be ~300 sec/km pace
    for (const s of result.splits) {
      expect(s.paceSecPerKm).toBeGreaterThan(250);
      expect(s.paceSecPerKm).toBeLessThan(350);
    }
  });

  it('identifies fastest and slowest splits', () => {
    // Build a route where km 2 is faster (shorter interval)
    const points: GPSPoint[] = [];
    let ts = 0;
    let lng = 4.0;
    const metresToLng = 100 / 68600;

    for (let i = 0; i < 31; i++) {
      const isKm2 = i >= 10 && i < 20;
      const interval = isKm2 ? 20000 : 35000; // km2 is faster
      if (i > 0) ts += interval;

      points.push({
        lat: 52.0,
        lng,
        altitude: null,
        accuracy: 5,
        speed: null,
        timestamp: ts,
        distance_from_prev: i === 0 ? 0 : 100,
      });
      lng += metresToLng;
    }

    const result = computeKmSplits(points);
    expect(result.splits.length).toBe(3);
    expect(result.fastestSplitKm).toBe(2);
    expect(result.slowestSplitKm).not.toBe(2);
  });

  it('detects negative split correctly', () => {
    // Build route where second half is faster
    const points: GPSPoint[] = [];
    let ts = 0;
    let lng = 4.0;
    const metresToLng = 100 / 68600;

    for (let i = 0; i < 41; i++) {
      const isSecondHalf = i >= 20;
      const interval = isSecondHalf ? 20000 : 35000;
      if (i > 0) ts += interval;

      points.push({
        lat: 52.0,
        lng,
        altitude: null,
        accuracy: 5,
        speed: null,
        timestamp: ts,
        distance_from_prev: i === 0 ? 0 : 100,
      });
      lng += metresToLng;
    }

    const result = computeKmSplits(points);
    expect(result.isNegativeSplit).toBe(true);
  });

  it('includes HR data in splits when provided', () => {
    const points = straightRoute(21, 100, 30000);
    const hrReadings: HRReading[] = points.map((p) => ({ bpm: 140, timestamp: p.timestamp }));

    const result = computeKmSplits(points, hrReadings);
    for (const s of result.splits) {
      expect(s.avgHR).toBe(140);
    }
  });
});
