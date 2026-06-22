import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { QuickStatsRow } from '../components/QuickStatsRow';
import { TodayWorkoutCard } from '../components/TodayWorkoutCard';
import { GritInsightCardView } from '../components/GritInsightCard';
import { WeeklyEffortCounterView } from '../components/WeeklyEffortCounter';
import { LastWorkoutCardView } from '../components/LastWorkoutCard';
import { StreakDots } from '../components/StreakDots';
import type { HomeSceneProps } from './types';

const noop = () => {};

function defaultGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Marketing render of the HomeScreen progress dashboard. Reuses the exact home
// cards (presentational variants where the production card self-fetches) with
// every value injected, so the headless renderer is deterministic and offline.
export function MarketingHome(props: HomeSceneProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const completedIds = new Set(props.completedActivityIds ?? []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>GRITTY FITNESS</Text>
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>
            {props.greeting ?? defaultGreeting()}, {props.firstName}
          </Text>
          <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>READY FOR THE GRIND?</Text>
        </View>

        <QuickStatsRow workoutCount={props.quickStats.workouts} streakDays={props.quickStats.streakDays} />

        <TodayWorkoutCard
          activities={props.todayActivities}
          completedIds={completedIds}
          program={props.program}
          onStartWorkout={noop}
          onCreateProgram={noop}
        />

        <GritInsightCardView insight={props.insight} onOpenChat={noop} />

        <WeeklyEffortCounterView
          total={props.weeklyEffort.total}
          goal={props.weeklyEffort.goal}
          workoutCount={props.weeklyEffort.workoutCount}
        />

        {props.lastWorkout && <LastWorkoutCardView workout={props.lastWorkout} onPress={noop} />}

        <StreakDots completedDays={new Set(props.completedDays)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 24 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.5,
  },
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.heading,
    marginTop: 4,
  },
  greetingSub: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
