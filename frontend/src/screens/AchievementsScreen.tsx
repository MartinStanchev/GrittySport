import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { getAchievements, deleteAchievement, type Achievement } from '../services/api';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { groupAchievementsByMonth } from '../utils/achievements';
import { AchievementCard } from '../components/AchievementCard';

type Props = NativeStackScreenProps<Record<string, object | undefined>, string>;

export default function AchievementsScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await getAchievements();
    setAchievements(data);
    setLoading(false);
  }, []);

  useFetchOnFocus(load);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback((a: Achievement) => {
    Alert.alert('Remove achievement', `Remove "${a.title}" from your trophy room?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setAchievements((prev) => prev.filter((x) => x.id !== a.id));
          deleteAchievement(a.id).catch(() => load());
        },
      },
    ]);
  }, [load]);

  const handlePress = useCallback(
    (a: Achievement) => {
      if (a.workout_id) navigation.navigate('WorkoutDetail', { workoutId: a.workout_id });
    },
    [navigation],
  );

  const sections = groupAchievementsByMonth(achievements);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24 }}
      sections={sections}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      renderSectionHeader={({ section }) => (
        <Text style={[styles.sectionHeader, { color: colors.textSecondary }]}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <AchievementCard achievement={item} onPress={handlePress} onDelete={handleDelete} />
      )}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No trophies yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Record workouts and finish your goal events to start filling your trophy room. Personal
            records and milestones land here automatically.
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.6,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.heading,
  },
  emptyBody: {
    fontSize: 14,
    fontFamily: Fonts.body,
    textAlign: 'center',
    lineHeight: 20,
  },
});
