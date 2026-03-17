import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { ProgramSummary } from '../services/api';

interface ProgramArcProps {
  program: ProgramSummary | null;
  onCreateProgram: () => void;
}

export function ProgramArc({ program, onCreateProgram }: ProgramArcProps) {
  const { colors } = useTheme();

  let progressPercent = 0;
  let progressText = '';

  if (program?.end_date) {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const start = new Date(program.start_date).getTime();
    const end = new Date(program.end_date).getTime();
    const total = end - start;
    const elapsed = Date.now() - start;
    progressPercent = Math.min(Math.max(elapsed / total, 0), 1);
    const totalWeeks = Math.ceil(total / msPerWeek);
    const currentWeek = Math.min(Math.ceil(elapsed / msPerWeek), totalWeeks);
    progressText = `Week ${currentWeek} of ${totalWeeks}`;
  }

  // Arc geometry: semi-circle (180 degrees) using SVG Circle
  const size = 200;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = Math.PI * radius; // half-circle circumference

  if (!program) {
    return (
      <View style={styles.container}>
        <Ionicons name="barbell-outline" size={32} color={colors.textSecondary} />
        <Text style={[styles.noProgram, { color: colors.textPrimary }]}>No active program</Text>
        <Text style={[styles.noProgramSub, { color: colors.textSecondary }]}>
          Let Grit build your personalized training program
        </Text>
        <Pressable style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={onCreateProgram}>
          <Text style={[styles.createBtnText, { color: colors.surface }]}>Create Your Program</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.arcWrapper}>
        <Svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.surfaceAlt}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            rotation={180}
            origin={`${size / 2}, ${size / 2}`}
          />
          {/* Progress */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * progressPercent} ${circumference}`}
            rotation={180}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={styles.arcLabel}>
          <Text style={[styles.percentText, { color: colors.primary }]}>
            {Math.round(progressPercent * 100)}%
          </Text>
        </View>
      </View>
      <Text style={[styles.programName, { color: colors.textPrimary }]}>{program.name}</Text>
      {program.sport && (
        <Text style={[styles.sport, { color: colors.primary }]}>{program.sport}</Text>
      )}
      {progressText && (
        <Text style={[styles.weekText, { color: colors.textSecondary }]}>{progressText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  arcWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  arcLabel: {
    position: 'absolute',
    bottom: 4,
    alignItems: 'center',
  },
  percentText: {
    fontSize: 28,
    fontWeight: '800',
  },
  programName: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  sport: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  weekText: {
    fontSize: 13,
    marginTop: 4,
  },
  noProgram: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  noProgramSub: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  createBtn: {
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
