import { parseGPXFile } from '../services/gpxParser';
import { detectActivityType, buildFileSavePayload } from '../services/workoutFileParser';
import type { WorkoutFileParseResult } from '../services/workoutFileParser';

// ── Helpers ──────────────────────────────────────────────────────────

function makeGPX(opts: {
  name?: string;
  type?: string;
  trkpts?: string;
  multiSegment?: boolean;
} = {}): string {
  const name = opts.name ?? 'Test Run';
  const type = opts.type ?? 'running';
  const trkpts = opts.trkpts ?? `
    <trkpt lat="51.5074" lon="-0.1278">
      <ele>10</ele>
      <time>2024-06-01T08:00:00Z</time>
    </trkpt>
    <trkpt lat="51.5080" lon="-0.1270">
      <ele>12</ele>
      <time>2024-06-01T08:01:00Z</time>
    </trkpt>
    <trkpt lat="51.5090" lon="-0.1260">
      <ele>15</ele>
      <time>2024-06-01T08:02:00Z</time>
    </trkpt>
  `;

  if (opts.multiSegment) {
    return `<?xml version="1.0"?>
    <gpx>
      <trk>
        <name>${name}</name>
        <type>${type}</type>
        <trkseg>${trkpts}</trkseg>
        <trkseg>
          <trkpt lat="51.5100" lon="-0.1250">
            <ele>18</ele>
            <time>2024-06-01T08:03:00Z</time>
          </trkpt>
        </trkseg>
      </trk>
    </gpx>`;
  }

  return `<?xml version="1.0"?>
  <gpx>
    <trk>
      <name>${name}</name>
      <type>${type}</type>
      <trkseg>${trkpts}</trkseg>
    </trk>
  </gpx>`;
}

// ── parseGPXFile ─────────────────────────────────────────────────────

describe('parseGPXFile', () => {
  it('parses basic GPX with trackpoints', () => {
    const result = parseGPXFile(makeGPX());

    expect(result.name).toBe('Test Run');
    expect(result.type).toBe('running');
    expect(result.sourceFormat).toBe('gpx');
    expect(result.points).toHaveLength(3);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.durationSec).toBe(120);
    expect(result.totalDistanceM).toBeGreaterThan(0);
    expect(result.cadenceReadings).toEqual([]);
    expect(result.powerReadings).toEqual([]);
    expect(result.laps).toEqual([]);
  });

  it('computes distance_from_prev for each point', () => {
    const result = parseGPXFile(makeGPX());

    expect(result.points[0].distance_from_prev).toBe(0);
    expect(result.points[1].distance_from_prev).toBeGreaterThan(0);
    expect(result.points[2].distance_from_prev).toBeGreaterThan(0);

    const sumDist = result.points.reduce((s, p) => s + p.distance_from_prev, 0);
    expect(Math.abs(sumDist - result.totalDistanceM)).toBeLessThan(0.01);
  });

  it('extracts altitude values', () => {
    const result = parseGPXFile(makeGPX());
    expect(result.points[0].altitude).toBe(10);
    expect(result.points[1].altitude).toBe(12);
    expect(result.points[2].altitude).toBe(15);
  });

  it('computes elevation gain', () => {
    const result = parseGPXFile(makeGPX());
    expect(result.elevationGainM).toBeGreaterThanOrEqual(0);
  });

  it('handles multiple segments', () => {
    const result = parseGPXFile(makeGPX({ multiSegment: true }));
    expect(result.points).toHaveLength(4);
  });

  it('extracts HR from TrackPointExtension', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <ele>10</ele>
          <time>2024-06-01T08:00:00Z</time>
          <extensions>
            <TrackPointExtension>
              <hr>145</hr>
            </TrackPointExtension>
          </extensions>
        </trkpt>
        <trkpt lat="51.5080" lon="-0.1270">
          <ele>12</ele>
          <time>2024-06-01T08:01:00Z</time>
          <extensions>
            <TrackPointExtension>
              <hr>152</hr>
            </TrackPointExtension>
          </extensions>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    expect(result.hrReadings).toHaveLength(2);
    expect(result.hrReadings[0].bpm).toBe(145);
    expect(result.hrReadings[1].bpm).toBe(152);
  });

  it('extracts HR from direct hr extension element', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <time>2024-06-01T08:00:00Z</time>
          <extensions>
            <hr>160</hr>
          </extensions>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    expect(result.hrReadings).toHaveLength(1);
    expect(result.hrReadings[0].bpm).toBe(160);
  });

  it('extracts HR from heartrate extension (Coros/Wahoo)', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <time>2024-06-01T08:00:00Z</time>
          <extensions>
            <heartrate>138</heartrate>
          </extensions>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    expect(result.hrReadings).toHaveLength(1);
    expect(result.hrReadings[0].bpm).toBe(138);
  });

  it('handles missing timestamps gracefully', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <ele>10</ele>
        </trkpt>
        <trkpt lat="51.5080" lon="-0.1270">
          <ele>12</ele>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    expect(result.points).toHaveLength(2);
    expect(result.durationSec).toBe(0);
    expect(result.startTime).toBeNull();
  });

  it('handles missing elevation', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <time>2024-06-01T08:00:00Z</time>
        </trkpt>
        <trkpt lat="51.5080" lon="-0.1270">
          <time>2024-06-01T08:01:00Z</time>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    expect(result.points[0].altitude).toBeNull();
    expect(result.points[1].altitude).toBeNull();
    expect(result.elevationGainM).toBe(0);
  });

  it('returns empty result for empty/invalid XML', () => {
    expect(parseGPXFile('').points).toHaveLength(0);
    expect(parseGPXFile('<gpx></gpx>').points).toHaveLength(0);
    expect(parseGPXFile('<gpx><trk></trk></gpx>').points).toHaveLength(0);
  });

  it('handles single trackpoint', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <ele>10</ele>
          <time>2024-06-01T08:00:00Z</time>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    expect(result.points).toHaveLength(1);
    expect(result.totalDistanceM).toBe(0);
  });
});

// ── detectActivityType ───────────────────────────────────────────────

describe('detectActivityType', () => {
  function makeResult(overrides: Partial<WorkoutFileParseResult> = {}): WorkoutFileParseResult {
    return {
      name: 'Test',
      type: '',
      sourceFormat: 'gpx',
      points: [],
      hrReadings: [],
      cadenceReadings: [],
      powerReadings: [],
      laps: [],
      startTime: null,
      endTime: null,
      totalDistanceM: 0,
      durationSec: 0,
      elevationGainM: 0,
      ...overrides,
    };
  }

  it('maps "running" to "run"', () => {
    expect(detectActivityType(makeResult({ type: 'running' }))).toBe('run');
  });

  it('maps "cycling" to "cycling"', () => {
    expect(detectActivityType(makeResult({ type: 'cycling' }))).toBe('cycling');
  });

  it('maps "biking" to "cycling"', () => {
    expect(detectActivityType(makeResult({ type: 'biking' }))).toBe('cycling');
  });

  it('maps "walking" to "walk"', () => {
    expect(detectActivityType(makeResult({ type: 'walking' }))).toBe('walk');
  });

  it('maps "swimming" to "swim"', () => {
    expect(detectActivityType(makeResult({ type: 'swimming' }))).toBe('swim');
  });

  it('maps "trail_running" to "trail_run"', () => {
    expect(detectActivityType(makeResult({ type: 'trail_running' }))).toBe('trail_run');
  });

  it('falls back to speed heuristic — slow speed → walk', () => {
    const result = makeResult({ totalDistanceM: 1000, durationSec: 900 });
    expect(detectActivityType(result)).toBe('walk');
  });

  it('falls back to speed heuristic — moderate speed → run', () => {
    const result = makeResult({ totalDistanceM: 5000, durationSec: 1800 });
    expect(detectActivityType(result)).toBe('run');
  });

  it('falls back to speed heuristic — fast speed → cycling', () => {
    const result = makeResult({ totalDistanceM: 25000, durationSec: 3600 });
    expect(detectActivityType(result)).toBe('cycling');
  });

  it('defaults to "run" with no data', () => {
    expect(detectActivityType(makeResult())).toBe('run');
  });
});

// ── buildFileSavePayload ──────────────────────────────────────────────

describe('buildFileSavePayload', () => {
  it('builds a valid payload', () => {
    const result = parseGPXFile(makeGPX());
    const payload = buildFileSavePayload(result, 'run', 'Test notes', 'activity-123');

    expect(payload.source).toBe('gpx');
    expect(payload.activity_type).toBe('run');
    expect(payload.notes).toBe('Test notes');
    expect(payload.scheduled_activity_id).toBe('activity-123');
    expect(payload.started_at).toBeDefined();
    expect(payload.finished_at).toBeDefined();
    expect(payload.gps_route).toBeDefined();
    expect(payload.recorded_data).toBeDefined();
    expect((payload.gps_route as any).points).toHaveLength(3);
  });

  it('omits notes if empty', () => {
    const result = parseGPXFile(makeGPX());
    const payload = buildFileSavePayload(result, 'run', '  ');
    expect(payload.notes).toBeUndefined();
  });

  it('omits scheduled_activity_id if not provided', () => {
    const result = parseGPXFile(makeGPX());
    const payload = buildFileSavePayload(result, 'cycling');
    expect(payload.scheduled_activity_id).toBeUndefined();
  });

  it('includes HR data when present', () => {
    const xml = makeGPX({
      trkpts: `
        <trkpt lat="51.5074" lon="-0.1278">
          <time>2024-06-01T08:00:00Z</time>
          <extensions><TrackPointExtension><hr>145</hr></TrackPointExtension></extensions>
        </trkpt>
        <trkpt lat="51.5080" lon="-0.1270">
          <time>2024-06-01T08:01:00Z</time>
          <extensions><TrackPointExtension><hr>155</hr></TrackPointExtension></extensions>
        </trkpt>
      `,
    });

    const result = parseGPXFile(xml);
    const payload = buildFileSavePayload(result, 'run');
    expect(payload.heart_rate_data).toBeDefined();
    expect((payload.heart_rate_data as any).readings).toHaveLength(2);
  });
});
