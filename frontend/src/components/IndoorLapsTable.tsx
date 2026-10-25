import { Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { formatTime } from '../constants/workoutUtils';
import { getHRZoneColor } from '../services/gpsUtils';
import type { IndoorLap } from '../utils/indoorWorkout';
import { lapTableStyles } from './WorkoutSummaryParts';

/** Lap / Time / Avg HR rows for an indoor session; the left edge shows the lap's HR zone. */
export function IndoorLapsTable({ laps, maxHR }: { laps: IndoorLap[]; maxHR: number }) {
  const { colors } = useTheme();
  const showHR = laps.some((lap) => lap.avg_hr);
  const columns = showHR ? ['Lap', 'Time', 'Avg HR'] : ['Lap', 'Time'];
  return (
    <View>
      <View style={[lapTableStyles.header, { borderBottomColor: colors.border }]}>
        {columns.map((title) => (
          <Text key={title} style={[lapTableStyles.cell, lapTableStyles.label, { color: colors.textSecondary }]}>
            {title}
          </Text>
        ))}
      </View>
      {laps.map((lap) => (
        <View
          key={lap.lap_number}
          style={[
            lapTableStyles.row,
            {
              borderLeftColor: lap.avg_hr ? getHRZoneColor(lap.avg_hr, maxHR) : colors.border,
              borderBottomColor: colors.surfaceAlt,
            },
          ]}
        >
          <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>{lap.lap_number}</Text>
          <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>{formatTime(Math.round(lap.duration_sec))}</Text>
          {showHR && (
            <Text style={[lapTableStyles.cell, { color: colors.textPrimary }]}>
              {lap.avg_hr ? `${lap.avg_hr} bpm` : '—'}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
