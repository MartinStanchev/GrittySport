import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';

interface QuickStatsRowProps {
  workoutCount: number;
  streakDays: number;
}

export function QuickStatsRow({ workoutCount, streakDays }: QuickStatsRowProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <StatPill
        icon="flame-outline"
        value={String(workoutCount)}
        label="workouts"
        color={colors.tertiary}
        bgColor={colors.surface}
        textColor={colors.textPrimary}
        labelColor={colors.textSecondary}
      />
      <StatPill
        icon="flash-outline"
        value={`${streakDays}d`}
        label="streak"
        color={colors.secondary}
        bgColor={colors.surface}
        textColor={colors.textPrimary}
        labelColor={colors.textSecondary}
      />
    </View>
  );
}

interface StatPillProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  labelColor: string;
}

function StatPill({ icon, value, label, color, bgColor, textColor, labelColor }: StatPillProps) {
  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={[styles.value, { color: textColor }]}>{value}</Text>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 2,
  },
  value: {
    fontSize: 16,
    fontFamily: Fonts.heading,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.body,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
