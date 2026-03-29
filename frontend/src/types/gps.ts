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
  avg_cadence?: number;
  max_cadence?: number;
  points: GPSPoint[];
  laps: Lap[];
  auto_paused_duration_sec: number;
}

// Stored in heart_rate_data JSONB column
export interface HRData {
  readings: HRReading[];
  cadence_readings?: CadenceReading[];
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
  avg_cadence?: number;
  max_cadence?: number;
}

export interface CadenceReading {
  spm: number;       // steps per minute
  timestamp: number; // Unix ms
}

export interface PowerReading {
  watts: number;
  timestamp: number; // Unix ms
}

export type HRZone = 1 | 2 | 3 | 4 | 5;
export type HRZoneDistribution = Record<HRZone, number>; // seconds in each zone

export interface KmSplit {
  km: number;
  durationSec: number;
  paceSecPerKm: number;
  avgHR?: number;
  elevationGain: number;
}

export interface EffortScoreData {
  score: number;
  label: 'Easy' | 'Moderate' | 'Hard' | 'Very Hard' | 'Max';
}

export interface SplitsAnalysis {
  splits: KmSplit[];
  fastestSplitKm: number;
  slowestSplitKm: number;
  fadePct: number;
  isNegativeSplit: boolean;
}

export interface PersonalRecord {
  category: string;
  value: number;
  formatted_value?: string;
  unit?: string;
  previous_best?: number;
  improvement_pct?: number;
}

export interface CardiacEfficiency {
  current_pace_sec_per_km: number;
  current_avg_hr: number;
  historical_avg_hr: number;
  comparison_count: number;
  delta_hr: number;
  trend: 'improving' | 'stable' | 'declining';
  summary: string;
}

export interface VolumeTrend {
  this_week_km?: number;
  last_week_km?: number;
  this_week_sessions: number;
  last_week_sessions: number;
  change_km_pct?: number;
  change_session_pct: number;
}

export interface EffortTrend {
  this_week_avg_effort: number;
  last_4_weeks_avg_effort: number;
  change_pct: number;
}

export interface HRTrend {
  avg_hr_at_pace_this_week: number;
  avg_hr_at_pace_last_4_wks: number;
  delta_hr: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface WeeklyTrend {
  volume_trend?: VolumeTrend;
  effort_trend?: EffortTrend;
  hr_trend?: HRTrend;
}

export interface WorkoutAnalytics {
  effort_score: number;
  effort_label: EffortScoreData['label'];
  splits: KmSplit[];
  fastest_split_km: number;
  slowest_split_km: number;
  fade_pct: number;
  is_negative_split: boolean;
  program_alignment?: ProgramAlignment;
  trend?: TrendComparison;
  personal_records?: PersonalRecord[];
  cardiac_efficiency?: CardiacEfficiency;
  weekly_trend?: WeeklyTrend;
}

export interface ProgramAlignment {
  prescribed_distance_km?: number;
  actual_distance_km?: number;
  distance_deviation_pct?: number;
  prescribed_pace?: string;
  actual_pace?: string;
  pace_deviation_pct?: number;
  prescribed_duration_min?: number;
  actual_duration_min?: number;
  duration_deviation_pct?: number;
}

export interface TrendComparison {
  comparison_text: string;
  avg_pace_trend: 'improving' | 'stable' | 'declining';
}
