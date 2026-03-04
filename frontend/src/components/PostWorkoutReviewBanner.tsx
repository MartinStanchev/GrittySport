import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';

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
  const hasAccess = tier === 'premium' || reviewsRemaining > 0;

  if (hasAccess) {
    return (
      <View style={styles.container}>
        <Ionicons name="chatbubble-ellipses" size={20} color={Colors.primary} />
        <Text style={styles.text}>Grit is reviewing your workout...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Ionicons name="lock-closed" size={20} color={Colors.textSecondary} />
      <Text style={styles.text}>
        Upgrade to Premium for Grit's feedback on every workout.
      </Text>
      <Pressable
        style={styles.ctaButton}
        onPress={() => Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!')}
      >
        <Text style={styles.ctaText}>See example</Text>
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
    backgroundColor: Colors.surface,
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 8,
  },
  text: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  ctaButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
