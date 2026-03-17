import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { getActivityIcon, formatActivityType, formatPrescriptionSummary, formatActivityDate, isManualActivity, isGPSActivity } from '../constants/activityIcons';
import type { UpcomingActivity } from '../services/api';

interface UpcomingActivityCardProps {
  activity: UpcomingActivity;
  onPress?: () => void;
  onRecord?: () => void;
  onRecordGPS?: () => void;
}

export function UpcomingActivityCard({ activity, onPress, onRecord, onRecordGPS }: UpcomingActivityCardProps) {
  const { colors } = useTheme();
  const summary = formatPrescriptionSummary(activity.prescription);
  const icon = getActivityIcon(activity.activity_type);
  const manual = isManualActivity(activity.activity_type);
  const gps = isGPSActivity(activity.activity_type);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => pressed && onPress && styles.pressed}>
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.activityType, { color: colors.textPrimary }]}>{formatActivityType(activity.activity_type)}</Text>
          <Text style={[styles.date, { color: colors.textSecondary }]}>{formatActivityDate(activity.date)}</Text>
          {summary ? <Text style={[styles.prescription, { color: colors.textSecondary }]} numberOfLines={1}>{summary}</Text> : null}
        </View>
        <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{activity.phase_name}</Text>
        </View>
        {(manual || gps) && (
          <Pressable
            style={[styles.logPill, { borderColor: colors.primary }]}
            onPress={manual ? onRecord : onRecordGPS}
            hitSlop={8}
          >
            <Ionicons
              name={gps ? 'navigate-outline' : 'play-circle-outline'}
              size={12}
              color={colors.primary}
            />
            <Text style={[styles.logPillText, { color: colors.primary }]}>
              {gps ? 'GPS' : 'Log'}
            </Text>
          </Pressable>
        )}
        {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={styles.chevron} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  activityType: {
    fontSize: 15,
    fontWeight: '600',
  },
  date: {
    fontSize: 12,
    marginTop: 2,
  },
  prescription: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  logPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
  },
  logPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  chevron: {
    marginLeft: 2,
  },
});
