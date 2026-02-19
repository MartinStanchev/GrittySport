import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { formatTime } from '../constants/workoutUtils';
import { useWorkout } from '../contexts/WorkoutContext';
import { navigationRef } from '../navigation/navigationRef';

export function ActiveWorkoutBanner() {
  const { activeWorkout } = useWorkout();
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeWorkout || activeWorkout.phase !== 'recording') return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - activeWorkout.startedAt.getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout?.startedAt, activeWorkout?.phase]);

  if (!activeWorkout || activeWorkout.phase !== 'recording') return null;

  function handlePress() {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Home', { screen: 'RecordManual' });
    }
  }

  return (
    <Pressable style={[styles.banner, { paddingTop: insets.top + 10 }]} onPress={handlePress}>
      <View style={styles.pulsingDot} />
      <Ionicons name="fitness-outline" size={16} color="#FFF" style={styles.icon} />
      <Text style={styles.type} numberOfLines={1}>
        {activeWorkout.activityDisplayType}
      </Text>
      <Text style={styles.timer}>{formatTime(elapsed)}</Text>
      <Text style={styles.returnLabel}>Tap to return</Text>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
    opacity: 0.9,
  },
  icon: {
    marginRight: 2,
  },
  type: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  timer: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  returnLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
  },
});
