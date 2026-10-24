import {
  haversineMetres,
  currentPaceSecPerKm,
  currentSpeedKph,
  avgPaceSecPerKm,
  avgSpeedKph,
  computeElevationGain,
  triggerLap,
  closeFinalLap,
  hasRecordedLaps,
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
  activeSecBetween,
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
    ...(opts.paused_before_sec != null && { paused_before_sec: opts.paused_before_sec }),
  };
}

// Helper: shift every point from `index` on by a pause of `pauseSec`, recording it on the
// first point after the pause — what the GPS reducer does on resume.
function withPause(points: GPSPoint[], index: number, pauseSec: number): GPSPoint[] {
  return points.map((p, i) => {
    if (i < index) return p;
    const shifted = { ...p, timestamp: p.timestamp + pauseSec * 1000 };
    return i === index ? { ...shifted, paused_before_sec: pauseSec } : shifted;
  });
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

// Helper: point with only timestamp + leg distance (lat/lng unused by live pace/speed).
function leg(timestamp: number, distance_from_prev: number): GPSPoint {
  return pt(52, 4, { timestamp, distance_from_prev });
}

// ─── currentPaceSecPerKm ───────────────────────────────────────────────────

describe('currentPaceSecPerKm', () => {
  it('returns 0 for a single point', () => {
    expect(currentPaceSecPerKm([pt(0, 0)])).toBe(0);
  });

  it('returns 0 when distance is too small', () => {
    expect(currentPaceSecPerKm([leg(0, 0), leg(5000, 0)])).toBe(0);
  });

  it('computes 10:00 /km for 10 m every 6 s', () => {
    const points = [leg(0, 0)];
    for (let t = 6; t <= 60; t += 6) points.push(leg(t * 1000, 10));
    expect(currentPaceSecPerKm(points)).toBeCloseTo(600, 5);
  });

  it('agrees with currentSpeedKph over the same window', () => {
    const points = straightRoute(30, 3, 1000); // 3 m/s
    const pace = currentPaceSecPerKm(points);
    expect(pace).toBeCloseTo(3600 / currentSpeedKph(points), 6);
    expect(Math.abs(pace - 1000 / 3) / (1000 / 3)).toBeLessThan(0.01); // straightRoute's lng scale is approximate
  });
});

// ─── currentSpeedKph ──────────────────────────────────────────────────────

describe('currentSpeedKph', () => {
  it('returns 0 for a single point', () => {
    expect(currentSpeedKph([pt(0, 0)])).toBe(0);
  });

  it('computes ~3.6 km/h for 1 m/s', () => {
    expect(currentSpeedKph([leg(0, 0), leg(5000, 5)])).toBeCloseTo(3.6, 1);
  });

  it('returns 0 when the available span is shorter than the minimum', () => {
    expect(currentSpeedKph([leg(0, 0), leg(1000, 3), leg(2000, 3)])).toBe(0);
  });

  it('uses a time window, not a point count', () => {
    // 60 s at 1 m/s, then 20 s at 3 m/s, 1 point per second.
    const points = [leg(0, 0)];
    for (let t = 1; t <= 60; t++) points.push(leg(t * 1000, 1));
    for (let t = 61; t <= 80; t++) points.push(leg(t * 1000, 3));
    // Window covers only the last 15 s of fast running → 10.8 km/h.
    expect(currentSpeedKph(points)).toBeCloseTo(10.8, 5);
  });

  it('extends the window back to cover at least the full window when fixes are sparse', () => {
    // Fixes every 4 s at 2 m/s: cutoff at 16 s, window starts at the 12 s point (span 20 s).
    const points = [leg(0, 0)];
    for (let t = 4; t <= 32; t += 4) points.push(leg(t * 1000, 8));
    expect(currentSpeedKph(points)).toBeCloseTo(7.2, 5);
  });

  it('smooths single-fix GPS jitter far better than a short window', () => {
    // Steady 3 m/s with one fix jumping 6 m ahead at the end.
    const points = [leg(0, 0)];
    for (let t = 1; t <= 29; t++) points.push(leg(t * 1000, 3));
    points.push(leg(30000, 9));
    // (14 × 3 + 9) m / 15 s = 3.4 m/s = 12.24 km/h, vs ~16 km/h over the last 4 s.
    expect(currentSpeedKph(points)).toBeCloseTo(12.24, 5);
  });

  it('does not span a pause gap', () => {
    // Moving at 2 m/s, then a 60 s pause (with a resume jump leg), then 5 s at 2 m/s.
    const points = [leg(0, 0)];
    for (let t = 1; t <= 20; t++) points.push(leg(t * 1000, 2));
    points.push(leg(80000, 30)); // first point after resume, leg spans the pause
    for (let t = 81; t <= 85; t++) points.push(leg(t * 1000, 2));
    // Only the 5 s after resume count: 10 m / 5 s = 2 m/s = 7.2 km/h.
    expect(currentSpeedKph(points)).toBeCloseTo(7.2, 5);
  });

  it('returns 0 right after resuming until the minimum span is reached', () => {
    const points = [leg(0, 0)];
    for (let t = 1; t <= 20; t++) points.push(leg(t * 1000, 2));
    points.push(leg(80000, 30));
    points.push(leg(81000, 2));
    expect(currentSpeedKph(points)).toBe(0);
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

  it("excludes the boundary point's distance_from_prev when lapStartIndex > 0", () => {
    // points[lapStartIndex] is the LAST point of the PREVIOUS lap (the reducer sets
    // lapStartIndex = allPoints.length - 1 when a lap fires), so its distance_from_prev
    // belongs to the previous lap segment and must not be counted again here.
    const points = straightRoute(5, 100, 10000); // 5 points, ~100 m apart
    const lapStartIndex = 2;
    const lap = triggerLap(points, lapStartIndex, [], []);

    const expectedDist = points[3].distance_from_prev + points[4].distance_from_prev;
    expect(lap.distance_m).toBeCloseTo(expectedDist, 6);
    // The buggy version summed from the boundary point, over-counting its distance_from_prev.
    expect(lap.distance_m).not.toBeCloseTo(expectedDist + points[lapStartIndex].distance_from_prev, 0);
  });

  it('sums two consecutive laps to the total of all distance_from_prev (no double count)', () => {
    const points = straightRoute(7, 100, 10000);

    // Lap 1 fires once 4 points have accumulated (indices 0-3).
    const lap1 = triggerLap(points.slice(0, 4), 0, [], []);
    const lapStartIndex = 3; // last point of lap 1, per the reducer's convention
    // Lap 2 fires once the rest of the points have accumulated (indices 0-6).
    const lap2 = triggerLap(points.slice(0, 7), lapStartIndex, [lap1], []);

    const totalDist = points.slice(1).reduce((s, p) => s + p.distance_from_prev, 0);
    expect(lap1.distance_m + lap2.distance_m).toBeCloseTo(totalDist, 6);
  });

  it('excludes paused time so lap time and pace match the active timer', () => {
    // 4 x 100m legs at 30s each, with a 5-minute pause between points 2 and 3.
    const points = withPause(straightRoute(5, 100, 30000), 3, 300);
    const lap = triggerLap(points, 0, [], []);
    expect(lap.duration_sec).toBeCloseTo(120, 6);
    expect(lap.avg_pace_sec_per_km).toBeCloseTo((120 / lap.distance_m) * 1000, 6);
    // Wall-clock bounds are kept for HR windowing / export.
    expect(lap.end_time - lap.start_time).toBe(420_000);
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
      durationSec: 600, // 10 minutes
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
      durationSec: 30,
    });
    expect(result.hrData).toBeNull();
    expect(result.routeData.sport).toBe('cycling');
  });

  it('derives avg pace and speed from the given active duration for every sport', () => {
    for (const activityType of ['run', 'cycling', 'hike']) {
      const result = buildFinalGPSPayload({
        activityType,
        points: straightRoute(2, 1000, 300_000),
        laps: [],
        hrReadings: [],
        totalDistanceM: 1000,
        durationSec: 300, // e.g. 400 s wall clock minus a 100 s pause
      });
      expect(result.routeData.duration_sec).toBe(300);
      expect(result.routeData.avg_pace_sec_per_km).toBeCloseTo(300);
      expect(result.routeData.avg_speed_kph).toBeCloseTo(12);
      // recorded_data carries the same overall averages (not a best-lap figure)
      expect(result.summaryData.avg_pace_sec_per_km).toBeCloseTo(300);
      expect(result.summaryData.avg_speed_kph).toBeCloseTo(12);
    }
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

  it('excludes paused time from a split spanning a pause', () => {
    // 10 x 100m legs at 30s each = 300s for the km, plus a 10-minute pause mid-split.
    const route = straightRoute(11, 100, 30000).map((p, i) => ({ ...p, distance_from_prev: i === 0 ? 0 : 100 }));
    const points = withPause(route, 5, 600);
    const { splits } = computeKmSplits(points);
    expect(splits).toHaveLength(1);
    expect(splits[0].durationSec).toBeCloseTo(300, 6);
    expect(splits[0].paceSecPerKm).toBeCloseTo(300, 0);
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

// ─── closeFinalLap / hasRecordedLaps ──────────────────────────────────────

describe('closeFinalLap', () => {
  it('leaves an empty lap list empty (user never pressed Lap)', () => {
    const points = straightRoute(10, 100, 1000);
    expect(closeFinalLap(points, [], 0, [])).toEqual([]);
  });

  it('closes the stretch after the last manual lap into a final lap', () => {
    const points = straightRoute(10, 100, 1000);
    // User pressed Lap at point index 3 (the reducer then sets lapStartIndex = 3).
    const lap1 = triggerLap(points.slice(0, 4), 0, [], []);
    const laps = closeFinalLap(points, [lap1], 3, []);

    expect(laps).toHaveLength(2);
    expect(laps[1].lap_number).toBe(2);
    expect(laps[1].start_time).toBe(points[3].timestamp);
    expect(laps[1].end_time).toBe(points[9].timestamp);
    const total = points.reduce((s, p) => s + p.distance_from_prev, 0);
    expect(laps[0].distance_m + laps[1].distance_m).toBeCloseTo(total, 6);
  });

  it('excludes paused time from the closed final lap', () => {
    const points = withPause(straightRoute(10, 100, 1000), 6, 120);
    const lap1 = triggerLap(points.slice(0, 4), 0, [], []);
    const laps = closeFinalLap(points, [lap1], 3, []);
    expect(laps[1].duration_sec).toBeCloseTo(6, 6);
  });

  it('is a no-op when the last lap already ends at the last point', () => {
    const points = straightRoute(6, 100, 1000);
    const lap1 = triggerLap(points.slice(0, 3), 0, [], []);
    const lap2 = triggerLap(points, 2, [lap1], []);
    const laps = [lap1, lap2];
    expect(closeFinalLap(points, laps, 5, [])).toBe(laps);
  });
});

describe('hasRecordedLaps', () => {
  const points = straightRoute(6, 100, 1000);
  const lap = triggerLap(points, 0, [], []);

  it('is false for missing, empty or single whole-workout laps', () => {
    expect(hasRecordedLaps(undefined)).toBe(false);
    expect(hasRecordedLaps(null)).toBe(false);
    expect(hasRecordedLaps([])).toBe(false);
    expect(hasRecordedLaps([lap])).toBe(false);
  });

  it('is true for two or more laps', () => {
    expect(hasRecordedLaps([lap, { ...lap, lap_number: 2 }])).toBe(true);
  });
});

describe('buildFinalGPSPayload laps', () => {
  const points = straightRoute(10, 100, 1000);
  const base = {
    activityType: 'cycling',
    points,
    hrReadings: [] as HRReading[],
    totalDistanceM: points.reduce((s, p) => s + p.distance_from_prev, 0),
    durationSec: 9,
  };

  it('stores no laps when there are none', () => {
    expect(buildFinalGPSPayload({ ...base, laps: [] }).routeData.laps).toEqual([]);
  });

  it('stores laps as given — an imported lap that ends early is not extended', () => {
    // Imports reach this path too; only live recordings close a final lap (closeFinalLap).
    const lap1 = triggerLap(points.slice(0, 4), 0, [], []);
    expect(buildFinalGPSPayload({ ...base, laps: [lap1] }).routeData.laps).toEqual([lap1]);
  });
});

describe('activeSecBetween', () => {
  it('is wall-clock time when nothing was paused', () => {
    const points = straightRoute(5, 100, 1000);
    expect(activeSecBetween(points, 1, 4)).toBe(3);
  });

  it('subtracts pauses recorded on legs inside the range only', () => {
    const points = withPause(straightRoute(6, 100, 1000), 3, 60);
    expect(activeSecBetween(points, 0, 5)).toBeCloseTo(5, 6);
    // The pause sits on the leg into point 3, so a range starting at 3 excludes it.
    expect(activeSecBetween(points, 3, 5)).toBeCloseTo(2, 6);
  });
});
