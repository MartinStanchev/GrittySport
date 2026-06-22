import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import type { PersonalRecord } from '../types/gps';
import { PRBadge } from './PRBadge';

// Renders the "Personal Records" block inside the premium Analytics card: one
// row per record with a PR badge, category, and formatted value (+ improvement).
// Shared by WorkoutDetailScreen and the marketing summary render so they can't
// drift apart.
export function PersonalRecordsList({ records }: { records: PersonalRecord[] }) {
  const { colors } = useTheme();
  if (records.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Personal Records</Text>
      {records.map((pr) => (
        <View key={pr.category} style={styles.row}>
          <PRBadge />
          <View style={styles.info}>
            <Text style={[styles.category, { color: colors.textPrimary }]}>{pr.category}</Text>
            {pr.formatted_value ? (
              <Text style={[styles.value, { color: colors.textSecondary }]}>
                {pr.formatted_value}
                {pr.improvement_pct != null && pr.improvement_pct > 0
                  ? ` (+${pr.improvement_pct.toFixed(1)}%)`
                  : ''}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontFamily: Fonts.bodySemiBold,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  info: {
    flex: 1,
  },
  category: {
    fontSize: 13,
    fontFamily: Fonts.bodyMedium,
  },
  value: {
    fontSize: 12,
    fontFamily: Fonts.body,
    fontVariant: ['tabular-nums'] as const,
    marginTop: 1,
  },
});
