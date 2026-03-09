import { parseTCXFile } from '../services/parsers/tcxParser';

function makeTCX(opts: {
  sport?: string;
  laps?: string;
} = {}): string {
  const sport = opts.sport ?? 'Running';
  const laps = opts.laps ?? `
    <Lap StartTime="2024-06-01T08:00:00Z">
      <TotalTimeSeconds>120</TotalTimeSeconds>
      <DistanceMeters>500</DistanceMeters>
      <AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm>
      <MaximumHeartRateBpm><Value>165</Value></MaximumHeartRateBpm>
      <Track>
        <Trackpoint>
          <Time>2024-06-01T08:00:00Z</Time>
          <Position>
            <LatitudeDegrees>51.5074</LatitudeDegrees>
            <LongitudeDegrees>-0.1278</LongitudeDegrees>
          </Position>
          <AltitudeMeters>10</AltitudeMeters>
          <HeartRateBpm><Value>145</Value></HeartRateBpm>
          <Cadence>82</Cadence>
        </Trackpoint>
        <Trackpoint>
          <Time>2024-06-01T08:01:00Z</Time>
          <Position>
            <LatitudeDegrees>51.5080</LatitudeDegrees>
            <LongitudeDegrees>-0.1270</LongitudeDegrees>
          </Position>
          <AltitudeMeters>12</AltitudeMeters>
          <HeartRateBpm><Value>152</Value></HeartRateBpm>
          <Cadence>85</Cadence>
        </Trackpoint>
        <Trackpoint>
          <Time>2024-06-01T08:02:00Z</Time>
          <Position>
            <LatitudeDegrees>51.5090</LatitudeDegrees>
            <LongitudeDegrees>-0.1260</LongitudeDegrees>
          </Position>
          <AltitudeMeters>15</AltitudeMeters>
          <HeartRateBpm><Value>160</Value></HeartRateBpm>
          <Cadence>88</Cadence>
        </Trackpoint>
      </Track>
    </Lap>`;

  return `<?xml version="1.0"?>
  <TrainingCenterDatabase>
    <Activities>
      <Activity Sport="${sport}">
        ${laps}
      </Activity>
    </Activities>
  </TrainingCenterDatabase>`;
}

describe('parseTCXFile', () => {
  it('parses basic TCX with trackpoints', () => {
    const result = parseTCXFile(makeTCX());

    expect(result.sourceFormat).toBe('tcx');
    expect(result.type).toBe('run');
    expect(result.points).toHaveLength(3);
    expect(result.startTime).toBeInstanceOf(Date);
    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.durationSec).toBe(120);
    expect(result.totalDistanceM).toBeGreaterThan(0);
  });

  it('extracts HR readings from trackpoints', () => {
    const result = parseTCXFile(makeTCX());
    expect(result.hrReadings).toHaveLength(3);
    expect(result.hrReadings[0].bpm).toBe(145);
    expect(result.hrReadings[1].bpm).toBe(152);
    expect(result.hrReadings[2].bpm).toBe(160);
  });

  it('extracts cadence readings', () => {
    const result = parseTCXFile(makeTCX());
    expect(result.cadenceReadings).toHaveLength(3);
    expect(result.cadenceReadings[0].spm).toBe(82);
    expect(result.cadenceReadings[2].spm).toBe(88);
  });

  it('builds structured laps', () => {
    const result = parseTCXFile(makeTCX());
    expect(result.laps).toHaveLength(1);
    expect(result.laps[0].lap_number).toBe(1);
    expect(result.laps[0].distance_m).toBe(500);
    expect(result.laps[0].duration_sec).toBe(120);
    expect(result.laps[0].avg_hr).toBe(150);
    expect(result.laps[0].avg_pace_sec_per_km).toBeGreaterThan(0);
  });

  it('maps Running sport to run', () => {
    const result = parseTCXFile(makeTCX({ sport: 'Running' }));
    expect(result.type).toBe('run');
  });

  it('maps Biking sport to cycling', () => {
    const result = parseTCXFile(makeTCX({ sport: 'Biking' }));
    expect(result.type).toBe('cycling');
  });

  it('handles Other sport', () => {
    const result = parseTCXFile(makeTCX({ sport: 'Other' }));
    expect(result.type).toBe('');
  });

  it('handles multiple laps', () => {
    const lap1 = `
    <Lap StartTime="2024-06-01T08:00:00Z">
      <TotalTimeSeconds>60</TotalTimeSeconds>
      <DistanceMeters>250</DistanceMeters>
      <Track>
        <Trackpoint>
          <Time>2024-06-01T08:00:00Z</Time>
          <Position><LatitudeDegrees>51.5074</LatitudeDegrees><LongitudeDegrees>-0.1278</LongitudeDegrees></Position>
        </Trackpoint>
        <Trackpoint>
          <Time>2024-06-01T08:01:00Z</Time>
          <Position><LatitudeDegrees>51.5080</LatitudeDegrees><LongitudeDegrees>-0.1270</LongitudeDegrees></Position>
        </Trackpoint>
      </Track>
    </Lap>
    <Lap StartTime="2024-06-01T08:01:00Z">
      <TotalTimeSeconds>60</TotalTimeSeconds>
      <DistanceMeters>250</DistanceMeters>
      <Track>
        <Trackpoint>
          <Time>2024-06-01T08:01:00Z</Time>
          <Position><LatitudeDegrees>51.5080</LatitudeDegrees><LongitudeDegrees>-0.1270</LongitudeDegrees></Position>
        </Trackpoint>
        <Trackpoint>
          <Time>2024-06-01T08:02:00Z</Time>
          <Position><LatitudeDegrees>51.5090</LatitudeDegrees><LongitudeDegrees>-0.1260</LongitudeDegrees></Position>
        </Trackpoint>
      </Track>
    </Lap>`;

    const result = parseTCXFile(makeTCX({ laps: lap1 }));
    expect(result.laps).toHaveLength(2);
    expect(result.laps[0].lap_number).toBe(1);
    expect(result.laps[1].lap_number).toBe(2);
    expect(result.points).toHaveLength(4);
  });

  it('returns empty result for invalid XML', () => {
    const result = parseTCXFile('');
    expect(result.points).toHaveLength(0);
    expect(result.sourceFormat).toBe('tcx');
  });

  it('returns empty result for TCX without activities', () => {
    const result = parseTCXFile('<TrainingCenterDatabase></TrainingCenterDatabase>');
    expect(result.points).toHaveLength(0);
  });

  it('handles trackpoints without position (HR-only)', () => {
    const laps = `
    <Lap StartTime="2024-06-01T08:00:00Z">
      <TotalTimeSeconds>60</TotalTimeSeconds>
      <DistanceMeters>0</DistanceMeters>
      <Track>
        <Trackpoint>
          <Time>2024-06-01T08:00:00Z</Time>
          <HeartRateBpm><Value>130</Value></HeartRateBpm>
        </Trackpoint>
        <Trackpoint>
          <Time>2024-06-01T08:01:00Z</Time>
          <HeartRateBpm><Value>140</Value></HeartRateBpm>
        </Trackpoint>
      </Track>
    </Lap>`;

    const result = parseTCXFile(makeTCX({ laps }));
    expect(result.points).toHaveLength(0);
    expect(result.hrReadings).toHaveLength(2);
    expect(result.hrReadings[0].bpm).toBe(130);
  });
});
