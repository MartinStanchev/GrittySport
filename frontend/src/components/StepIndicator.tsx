import { StyleSheet, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface StepIndicatorProps {
  current: number;
  total: number;
}

export default function StepIndicator({ current, total }: StepIndicatorProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < current ? colors.primary : colors.surfaceAlt,
              borderColor: i < current ? colors.primary : colors.border,
            },
            i + 1 === current && styles.activeDot,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 20 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  activeDot: { width: 28 },
});
