import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getAchievements, type Achievement } from '../services/api';
import { achievementColor, achievementIcon } from '../utils/achievements';

interface AchievementsHighlightCardProps {
  onPress: () => void;
}

/** Compact Home card: latest trophy + count, taps through to the trophy room.
 *  Renders nothing until the user has earned at least one achievement. */
export function AchievementsHighlightCard({ onPress }: AchievementsHighlightCardProps) {
  const { colors } = useTheme();
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useFetchOnFocus(
    useCallback(async () => {
      setAchievements(await getAchievements());
    }, []),
  );

  if (achievements.length === 0) return null;

  const latest = achievements[0];
  const accent = achievementColor(latest.type, colors);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={onPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: accent + '22' }]}>
        <Ionicons name={achievementIcon(latest.type)} size={20} color={accent} />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>TROPHY ROOM</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {latest.title}
        </Text>
      </View>
      <Text style={[styles.count, { color: colors.textSecondary }]}>
        {achievements.length} earned
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontFamily: Fonts.headingMedium,
  },
  count: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
});
