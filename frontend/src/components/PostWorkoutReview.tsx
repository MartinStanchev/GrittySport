import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { formatActivityType } from '../constants/activityIcons';
import { formatRelativeDay } from '../utils/dates';
import {
  getLinkableActivities,
  getWorkoutReview,
  linkWorkoutToActivity,
  triggerWorkoutReview,
  type LinkableActivity,
} from '../services/api';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // 15 * 2s = 30s

type ReviewPhase = 'linking' | 'polling' | 'ready' | 'timeout';

function LoadingPanel({
  pulseAnim,
  text,
  colors,
}: {
  pulseAnim: Animated.Value;
  text: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.pollingRow}>
        <Animated.View style={[styles.pollingDot, { backgroundColor: colors.primary, opacity: pulseAnim }]} />
        <Animated.View style={[styles.pollingDot, { backgroundColor: colors.primary, opacity: pulseAnim }]} />
        <Animated.View style={[styles.pollingDot, { backgroundColor: colors.primary, opacity: pulseAnim }]} />
      </View>
      <Text style={[styles.pollingText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

interface Props {
  workoutId: string;
  activityType: string;
  scheduledActivityId?: string;
  onContinueInChat: () => void;
  onSkipReview?: () => void;
}

export function PostWorkoutReview({
  workoutId,
  activityType,
  scheduledActivityId,
  onContinueInChat,
  onSkipReview,
}: Props) {
  const { colors } = useTheme();
  const [phase, setPhase] = useState<ReviewPhase>('linking');
  const [reviewContent, setReviewContent] = useState('');
  const [compatibleActivities, setCompatibleActivities] = useState<LinkableActivity[]>([]);
  const [linkLookupDone, setLinkLookupDone] = useState(!!scheduledActivityId);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const reviewTriggered = useRef(false);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const showLinkOptions = phase === 'linking' && !scheduledActivityId && linkLookupDone && compatibleActivities.length > 0;
  const showReviewPrompt = phase === 'linking' && linkLookupDone && !showLinkOptions;
  const showLinkingLoader = phase === 'linking' && !linkLookupDone;

  // Pulse animation for loading states (link lookup + polling)
  useEffect(() => {
    if (phase !== 'polling' && !showLinkingLoader) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [phase, showLinkingLoader, pulseAnim]);

  // Fetch compatible activities (skipped when workout is already linked)
  useEffect(() => {
    if (scheduledActivityId) return;
    let active = true;

    getLinkableActivities(activityType)
      .then((activities) => {
        if (!active) return;
        setCompatibleActivities(activities.slice(0, 5));
        setLinkLookupDone(true);
      })
      .catch(() => {
        if (active) setLinkLookupDone(true);
      });

    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function triggerAndPoll() {
    if (reviewTriggered.current) return;
    reviewTriggered.current = true;
    setPhase('polling');
    try {
      await triggerWorkoutReview(workoutId);
    } catch {
      // Still poll — review might have been triggered another way
    }
  }

  async function handleLink(review: boolean) {
    if (!selectedActivityId) return;
    setLinking(true);
    try {
      await linkWorkoutToActivity(workoutId, selectedActivityId);
    } catch {
      // Non-critical — proceed regardless
    }
    setLinking(false);
    if (review) {
      triggerAndPoll();
    } else {
      onSkipReview?.();
    }
  }

  // Poll for review once in polling phase
  useEffect(() => {
    if (phase !== 'polling') return;
    let active = true;
    let attempts = 0;

    const poll = async () => {
      while (active && attempts < MAX_POLL_ATTEMPTS) {
        try {
          const resp = await getWorkoutReview(workoutId);
          if (!active) return;
          if (resp.status === 'ready' && resp.message) {
            setReviewContent(resp.message.content);
            setPhase('ready');
            return;
          }
        } catch {
          // ignore, retry
        }
        attempts++;
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      if (active) setPhase('timeout');
    };

    poll();
    return () => { active = false; };
  }, [phase, workoutId]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + '1A' }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>G</Text>
        </View>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Grit&apos;s Review</Text>
        <View style={[styles.aiBadge, { borderColor: colors.primary }]}>
          <Text style={[styles.aiBadgeText, { color: colors.primary }]}>AI</Text>
        </View>
      </View>

      {/* Linking phase — show compatible activities */}
      {showLinkOptions && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.linkTitle, { color: colors.textPrimary }]}>
            Link to Scheduled Activity
          </Text>
          <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>
            Help Grit evaluate your workout against your plan
          </Text>

          {compatibleActivities.map((a) => (
            <Pressable
              key={a.id}
              style={[
                styles.linkOption,
                { borderColor: colors.border },
                selectedActivityId === a.id && { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
              ]}
              onPress={() =>
                setSelectedActivityId(selectedActivityId === a.id ? null : a.id)
              }
            >
              <Ionicons
                name={selectedActivityId === a.id ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={selectedActivityId === a.id ? colors.primary : colors.textSecondary}
              />
              <View style={styles.linkOptionContent}>
                <Text style={[styles.linkOptionType, { color: colors.textPrimary }]}>
                  {formatActivityType(a.activity_type)}
                </Text>
                <Text style={[styles.linkOptionMeta, { color: colors.textSecondary }]}>
                  {formatRelativeDay(a.date)} — {a.phase_name}, Week {a.week_number}
                </Text>
              </View>
            </Pressable>
          ))}

          <View style={styles.linkActions}>
            <Pressable
              style={[styles.linkBtn, { backgroundColor: colors.primary }, (!selectedActivityId || linking) && styles.linkBtnDisabled]}
              onPress={() => handleLink(true)}
              disabled={!selectedActivityId || linking}
            >
              <Text style={styles.linkBtnText}>
                {linking ? 'Linking...' : 'Link & Review'}
              </Text>
            </Pressable>
            {onSkipReview && (
              <Pressable
                style={[styles.skipBtn, (!selectedActivityId || linking) && styles.linkBtnDisabled]}
                onPress={() => handleLink(false)}
                disabled={!selectedActivityId || linking}
              >
                <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>
                  Link without review
                </Text>
              </Pressable>
            )}
            <Pressable style={styles.skipBtn} onPress={triggerAndPoll}>
              <Text style={[styles.skipBtnText, { color: colors.textSecondary }]}>
                Review without linking
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {showReviewPrompt && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.linkTitle, { color: colors.textPrimary }]}>
            Get Grit&apos;s review?
          </Text>
          <Text style={[styles.linkSubtitle, { color: colors.textSecondary }]}>
            Grit will analyze your workout and share feedback in chat.
          </Text>
          <View style={styles.linkActions}>
            <Pressable
              style={[styles.linkBtn, { backgroundColor: colors.primary }]}
              onPress={triggerAndPoll}
            >
              <Text style={styles.linkBtnText}>Get review</Text>
            </Pressable>
          </View>
        </View>
      )}

      {showLinkingLoader && (
        <LoadingPanel pulseAnim={pulseAnim} text="Checking your schedule..." colors={colors} />
      )}

      {phase === 'polling' && (
        <LoadingPanel pulseAnim={pulseAnim} text="Grit is reviewing your workout..." colors={colors} />
      )}

      {phase === 'ready' && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.reviewText, { color: colors.textPrimary }]}>
            {reviewContent}
          </Text>
        </View>
      )}

      {phase === 'timeout' && (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textSecondary} style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={[styles.timeoutText, { color: colors.textSecondary }]}>
            Review saved — check your chat with Grit
          </Text>
        </View>
      )}

      {(phase === 'ready' || phase === 'timeout') && (
        <Pressable
          style={[styles.chatBtn, { backgroundColor: colors.primary }]}
          onPress={onContinueInChat}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#fff" />
          <Text style={styles.chatBtnText}>Continue in Chat</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.heading,
    fontSize: 16,
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: 20,
  },
  aiBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 9,
    fontFamily: Fonts.bodySemiBold,
    letterSpacing: 0.5,
  },
  panel: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  pollingRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 10,
  },
  pollingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pollingText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  reviewText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  timeoutText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    textAlign: 'center',
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
  },
  chatBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: '#fff',
  },
  // Linking styles
  linkTitle: {
    fontFamily: Fonts.heading,
    fontSize: 16,
    marginBottom: 4,
  },
  linkSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    marginBottom: 14,
  },
  linkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  linkOptionContent: {
    flex: 1,
  },
  linkOptionType: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 14,
  },
  linkOptionMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  linkActions: {
    marginTop: 8,
    gap: 8,
  },
  linkBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
  },
  linkBtnDisabled: {
    opacity: 0.5,
  },
  linkBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
  },
});
