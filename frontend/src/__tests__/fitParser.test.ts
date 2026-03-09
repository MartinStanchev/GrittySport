/* eslint-disable import/first */
// Mock fit-file-parser since it needs binary data we can't easily generate in tests
jest.mock('fit-file-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseAsync: jest.fn(),
  }));
});

import FitParser from 'fit-file-parser';
import { parseFITFile } from '../services/parsers/fitParser';

function setupFitMock(data: any) {
  (FitParser as jest.Mock).mockImplementation(() => ({
    parseAsync: jest.fn().mockResolvedValue(data),
  }));
}

describe('parseFITFile', () => {
  const DUMMY_BASE64 = 'AAAA';

  it('parses FIT data with GPS records', async () => {
    setupFitMock({
      sessions: [{ sport: 'running' }],
      records: [
        {
          timestamp: '2024-06-01T08:00:00Z',
          position_lat: 51.5074,
          position_long: -0.1278,
          altitude: 10,
          heart_rate: 145,
          cadence: 82,
        },
        {
          timestamp: '2024-06-01T08:01:00Z',
          position_lat: 51.5080,
          position_long: -0.1270,
          altitude: 12,
          heart_rate: 152,
          cadence: 85,
        },
      ],
      laps: [
        {
          start_time: '2024-06-01T08:00:00Z',
          total_elapsed_time: 60,
          total_distance: 200,
          avg_heart_rate: 148,
          total_ascent: 2,
        },
      ],
    });

    const result = await parseFITFile(DUMMY_BASE64);

    expect(result.sourceFormat).toBe('fit');
    expect(result.type).toBe('run');
    expect(result.points).toHaveLength(2);
    expect(result.hrReadings).toHaveLength(2);
    expect(result.hrReadings[0].bpm).toBe(145);
    expect(result.cadenceReadings).toHaveLength(2);
    expect(result.cadenceReadings[0].spm).toBe(82);
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].distance_m).toBe(200);
    expect(result.laps[0].avg_hr).toBe(148);
  });

  it('maps sport string to type', async () => {
    setupFitMock({
      sessions: [{ sport: 'cycling' }],
      records: [
        {
          timestamp: '2024-06-01T08:00:00Z',
          position_lat: 51.5074,
          position_long: -0.1278,
        },
        {
          timestamp: '2024-06-01T08:01:00Z',
          position_lat: 51.5080,
          position_long: -0.1270,
        },
      ],
      laps: [],
    });

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.type).toBe('cycling');
  });

  it('extracts power readings', async () => {
    setupFitMock({
      sessions: [{ sport: 'cycling' }],
      records: [
        {
          timestamp: '2024-06-01T08:00:00Z',
          position_lat: 51.5074,
          position_long: -0.1278,
          power: 200,
        },
        {
          timestamp: '2024-06-01T08:01:00Z',
          position_lat: 51.5080,
          position_long: -0.1270,
          power: 220,
        },
      ],
      laps: [],
    });

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.powerReadings).toHaveLength(2);
    expect(result.powerReadings[0].watts).toBe(200);
    expect(result.powerReadings[1].watts).toBe(220);
  });

  it('handles semicircle coordinates (large values)', async () => {
    const latSemicircles = 614421830;
    const lngSemicircles = -1525694;

    setupFitMock({
      sessions: [{ sport: 'running' }],
      records: [
        {
          timestamp: '2024-06-01T08:00:00Z',
          position_lat: latSemicircles,
          position_long: lngSemicircles,
        },
      ],
      laps: [],
    });

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.points).toHaveLength(1);
    expect(Math.abs(result.points[0].lat - 51.5)).toBeLessThan(1);
  });

  it('returns empty result when no data', async () => {
    setupFitMock({
      sessions: [],
      records: [],
      laps: [],
    });

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.points).toHaveLength(0);
    expect(result.sourceFormat).toBe('fit');
  });

  it('returns empty result when data is null', async () => {
    setupFitMock(null);

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.points).toHaveLength(0);
  });

  it('skips records without position', async () => {
    setupFitMock({
      sessions: [{ sport: 'running' }],
      records: [
        {
          timestamp: '2024-06-01T08:00:00Z',
          heart_rate: 130,
        },
        {
          timestamp: '2024-06-01T08:01:00Z',
          position_lat: 51.5074,
          position_long: -0.1278,
          heart_rate: 140,
        },
      ],
      laps: [],
    });

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.points).toHaveLength(1);
    expect(result.hrReadings).toHaveLength(2);
  });

  it('maps swim sport', async () => {
    setupFitMock({
      sessions: [{ sport: 'swimming' }],
      records: [
        { timestamp: '2024-06-01T08:00:00Z', heart_rate: 120 },
      ],
      laps: [],
    });

    const result = await parseFITFile(DUMMY_BASE64);
    expect(result.type).toBe('swim');
  });
});
