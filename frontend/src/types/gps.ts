export interface GPSPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number;
  speed: number | null; // m/s
  timestamp: number; // Unix ms
  distance_from_prev: number; // haversine metres from previous point (0 for first)
}

export interface HRReading {
  bpm: number;
  timestamp: number; // Unix ms
}

export interface Lap {
  lap_number: number;
  start_time: number; // Unix ms
  end_time: number; // Unix ms
  distance_m: number;
  duration_sec: number;
  avg_pace_sec_per_km: number; // 0 for cycling laps
  avg_speed_kph: number;
  avg_hr?: number;
  elevation_gain_m: number;
}

// Stored in gps_route JSONB column — full route + computed stats
export interface GPSRouteData {
  sport: 'run' | 'cycling' | 'swim_open_water' | string;
  distance_km: number;
  duration_sec: number;
  avg_pace_sec_per_km: number;
  avg_speed_kph: number;
  elevation_gain_m: number;
  avg_hr?: number;
  max_hr?: number;
  points: GPSPoint[];
  laps: Lap[];
  auto_paused_duration_sec: number;
}

// Stored in heart_rate_data JSONB column
export interface HRData {
  readings: HRReading[];
  device_name?: string;
  device_id?: string;
}

// Stored in recorded_data JSONB column — lightweight summary for list views
export interface GPSSummaryData {
  distance_km: number;
  avg_pace_sec_per_km: number;
  avg_speed_kph: number;
  elevation_gain_m: number;
  avg_hr?: number;
  max_hr?: number;
}

export type HRZone = 1 | 2 | 3 | 4 | 5;
export type HRZoneDistribution = Record<HRZone, number>; // seconds in each zone
