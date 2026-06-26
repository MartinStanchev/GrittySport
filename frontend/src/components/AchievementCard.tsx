import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import type { Achievement } from '../services/api';
import { achievementColor, achievementIcon, achievementTypeLabel } from '../utils/achievements';

interface AchievementCardProps {
  achievement: Achievement;
  onPress?: (achievement: Achievement) => void;
  onDelete?: (achievement: Achievement) => void;
}

function shareText(a: Achievement): string {
  const parts = [a.title];
  if (a.subtitle) parts.push(a.subtitle);
  parts.push('— tracked with Gritty Fitness');
  return parts.join('\n');
}

export function AchievementCard({ achievement, onPress, onDelete }: AchievementCardProps) {
  const { colors } = useTheme();
  const accent = achievementColor(achievement.type, colors);

  const date = new Date(achievement.achieved_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress ? () => onPress(achievement) : undefined}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
        <Ionicons name={achievementIcon(achievement.type)} size={22} color={accent} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.eyebrow, { color: accent }]}>
          {achievementTypeLabel(achievement.type).toUpperCase()}
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {achievement.title}
        </Text>
        {achievement.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {achievement.subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.side}>
        <Text style={[styles.date, { color: colors.textSecondary }]}>{date}</Text>
        <View style={styles.actions}>
          <Pressable
            hitSlop={8}
            onPress={() => Share.share({ message: shareText(achievement) }).catch(() => {})}
          >
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </Pressable>
          {onDelete ? (
            <Pressable hitSlop={8} onPress={() => onDelete(achievement)}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  side: {
    alignItems: 'flex-end',
    gap: 8,
  },
  date: {
    fontSize: 11,
    fontFamily: Fonts.body,
  },
  actions: {
    flexDirection: 'row',
    gap: 14,
  },
});
