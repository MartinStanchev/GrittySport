import { parseCSVFile } from '../services/parsers/csvParser';

describe('parseCSVFile', () => {
  it('parses basic CSV with GPS and HR', () => {
    const csv = [
      'timestamp,latitude,longitude,altitude,heart_rate',
      '2024-06-01T08:00:00Z,51.5074,-0.1278,10,145',
      '2024-06-01T08:01:00Z,51.5080,-0.1270,12,152',
      '2024-06-01T08:02:00Z,51.5090,-0.1260,15,160',
    ].join('\n');

    const result = parseCSVFile(csv, 'test.csv');

    expect(result.sourceFormat).toBe('csv');
    expect(result.name).toBe('test');
    expect(result.points).toHaveLength(3);
    expect(result.hrReadings).toHaveLength(3);
    expect(result.hrReadings[0].bpm).toBe(145);
    expect(result.totalDistanceM).toBeGreaterThan(0);
    expect(result.durationSec).toBe(120);
  });

  it('detects semicolon delimiter', () => {
    const csv = [
      'timestamp;lat;lng;hr',
      '2024-06-01T08:00:00Z;51.5074;-0.1278;145',
      '2024-06-01T08:01:00Z;51.5080;-0.1270;152',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(2);
    expect(result.hrReadings).toHaveLength(2);
  });

  it('detects tab delimiter', () => {
    const csv = [
      'timestamp\tlat\tlon\tbpm',
      '2024-06-01T08:00:00Z\t51.5074\t-0.1278\t145',
      '2024-06-01T08:01:00Z\t51.5080\t-0.1270\t152',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(2);
  });

  it('handles alternative column names (position_lat, position_long)', () => {
    const csv = [
      'time,position_lat,position_long,ele,bpm',
      '2024-06-01T08:00:00Z,51.5074,-0.1278,10,145',
      '2024-06-01T08:01:00Z,51.5080,-0.1270,12,152',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(2);
    expect(result.points[0].altitude).toBe(10);
  });

  it('handles HR-only CSV without GPS (indoor workout)', () => {
    const csv = [
      'timestamp,heart_rate,cadence',
      '2024-06-01T08:00:00Z,130,80',
      '2024-06-01T08:01:00Z,145,85',
      '2024-06-01T08:02:00Z,155,88',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(0);
    expect(result.hrReadings).toHaveLength(3);
    expect(result.cadenceReadings).toHaveLength(3);
    expect(result.cadenceReadings[0].spm).toBe(80);
  });

  it('extracts power readings', () => {
    const csv = [
      'timestamp,lat,lng,power',
      '2024-06-01T08:00:00Z,51.5074,-0.1278,200',
      '2024-06-01T08:01:00Z,51.5080,-0.1270,220',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.powerReadings).toHaveLength(2);
    expect(result.powerReadings[0].watts).toBe(200);
  });

  it('throws for summary-only CSV (no lat/lng and no HR)', () => {
    const csv = [
      'date,activity,distance,duration',
      '2024-06-01,Run,5km,25:00',
    ].join('\n');

    expect(() => parseCSVFile(csv)).toThrow('summary data only');
  });

  it('handles quoted fields with commas', () => {
    const csv = [
      'timestamp,latitude,longitude,heart_rate',
      '"2024-06-01T08:00:00Z",51.5074,-0.1278,145',
      '"2024-06-01T08:01:00Z",51.5080,-0.1270,152',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(2);
  });

  it('handles escaped quotes in fields', () => {
    const csv = [
      'timestamp,latitude,longitude,heart_rate',
      '2024-06-01T08:00:00Z,51.5074,-0.1278,145',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(1);
  });

  it('returns empty result for too few lines', () => {
    const result = parseCSVFile('just a header');
    expect(result.points).toHaveLength(0);
  });

  it('skips rows with invalid lat/lng', () => {
    const csv = [
      'timestamp,lat,lng,hr',
      '2024-06-01T08:00:00Z,invalid,bad,145',
      '2024-06-01T08:01:00Z,51.5080,-0.1270,152',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(1);
  });

  it('skips rows with zero lat/lng', () => {
    const csv = [
      'timestamp,lat,lng,hr',
      '2024-06-01T08:00:00Z,0,0,145',
      '2024-06-01T08:01:00Z,51.5080,-0.1270,152',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(1);
  });

  it('handles Windows line endings (\\r\\n)', () => {
    const csv = 'timestamp,lat,lng\r\n2024-06-01T08:00:00Z,51.5074,-0.1278\r\n2024-06-01T08:01:00Z,51.5080,-0.1270';

    const result = parseCSVFile(csv);
    expect(result.points).toHaveLength(2);
  });

  it('computes distance between points', () => {
    const csv = [
      'timestamp,lat,lng',
      '2024-06-01T08:00:00Z,51.5074,-0.1278',
      '2024-06-01T08:01:00Z,51.5080,-0.1270',
    ].join('\n');

    const result = parseCSVFile(csv);
    expect(result.totalDistanceM).toBeGreaterThan(0);
    expect(result.points[0].distance_from_prev).toBe(0);
    expect(result.points[1].distance_from_prev).toBeGreaterThan(0);
  });
});
