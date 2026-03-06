import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/colors';
import { getEffortColor } from '../services/gpsUtils';
import type { EffortScoreData } from '../types/gps';

interface EffortScoreCardProps {
  data: EffortScoreData;
}

export function EffortScoreCard({ data }: EffortScoreCardProps) {
  const color = getEffortColor(data.score);

  return (
    <View style={styles.container}>
      <View style={[styles.scoreCircle, { borderColor: color }]}>
        <Text style={[styles.scoreText, { color }]}>{data.score}</Text>
      </View>
      <View style={styles.labelContainer}>
        <Text style={styles.labelTitle}>Effort Score</Text>
        <Text style={[styles.labelValue, { color }]}>{data.label}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${data.score}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '800',
  },
  labelContainer: {
    flex: 1,
    minWidth: 80,
  },
  labelTitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  labelValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  barTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#E8E8E8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
});
