import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  tier: string;
  reviewsRemaining: number;
}

/**
 * Banner shown after saving a workout.
 * - Premium or free-with-remaining: shows "Grit is reviewing your workout..."
 * - Free-exhausted: shows upgrade CTA
 *
 * This component is a stub for Task 12 to wire into the post-workout flow.
 */
export function PostWorkoutReviewBanner({ tier, reviewsRemaining }: Props) {
  const { colors } = useTheme();
  const hasAccess = tier === 'premium' || reviewsRemaining > 0;

  if (hasAccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="chatbubble-ellipses" size={20} color={colors.primary} />
        <Text style={[styles.text, { color: colors.textPrimary }]}>Grit is reviewing your workout...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
      <Text style={[styles.text, { color: colors.textPrimary }]}>
        Upgrade to Premium for Grit&apos;s feedback on every workout.
      </Text>
      <Pressable
        style={[styles.ctaButton, { borderColor: colors.primary }]}
        onPress={() => Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!')}
      >
        <Text style={[styles.ctaText, { color: colors.primary }]}>See example</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 14,
  },
  ctaButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
