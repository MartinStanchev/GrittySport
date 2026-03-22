import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface StreakDotsProps {
  /** Set of day indices (0=Mon, 1=Tue, ... 6=Sun) that had workouts this week */
  completedDays: Set<number>;
}

export function StreakDots({ completedDays }: StreakDotsProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Ionicons name="flash-outline" size={16} color={colors.secondary} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>This Week</Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {completedDays.size} day{completedDays.size !== 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.dotsRow}>
        {DAY_LABELS.map((label, idx) => {
          const done = completedDays.has(idx);
          return (
            <View key={idx} style={styles.dotColumn}>
              <View
                style={[
                  styles.dot,
                  done
                    ? { backgroundColor: colors.secondary }
                    : { backgroundColor: colors.surfaceAlt },
                ]}
              >
                {done && <Ionicons name="checkmark" size={12} color={colors.background} />}
              </View>
              <Text style={[styles.dayLabel, { color: done ? colors.textPrimary : colors.textSecondary }]}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.headingMedium,
  },
  count: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotColumn: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.3,
  },
});
