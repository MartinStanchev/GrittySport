import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { getActivityIcon, formatPrescriptionSummary, formatActivityDate } from '../constants/activityIcons';
import type { UpcomingActivity } from '../services/api';

interface UpcomingActivityCardProps {
  activity: UpcomingActivity;
  onPress?: () => void;
}

export function UpcomingActivityCard({ activity, onPress }: UpcomingActivityCardProps) {
  const summary = formatPrescriptionSummary(activity.prescription);
  const icon = getActivityIcon(activity.activity_type);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => pressed && onPress && styles.pressed}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={22} color={Colors.primary} />
        </View>
        <View style={styles.content}>
          <Text style={styles.activityType}>{activity.activity_type}</Text>
          <Text style={styles.date}>{formatActivityDate(activity.date)}</Text>
          {summary ? <Text style={styles.prescription} numberOfLines={1}>{summary}</Text> : null}
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activity.phase_name}</Text>
        </View>
        {onPress && <Ionicons name="chevron-forward" size={16} color={Colors.textSecondary} style={styles.chevron} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E5',
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
    color: Colors.textPrimary,
  },
  date: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  prescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  chevron: {
    marginLeft: 6,
  },
});
