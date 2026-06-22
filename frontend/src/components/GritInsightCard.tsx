import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { getChatHistory } from '../services/api';

const DEFAULT_INSIGHT = 'Your AI coach is ready to help you train smarter.';

interface GritInsightCardProps {
  onOpenChat: () => void;
}

export function GritInsightCard({ onOpenChat }: GritInsightCardProps) {
  const [insight, setInsight] = useState(DEFAULT_INSIGHT);

  useFocusEffect(
    useCallback(() => {
      getChatHistory(5)
        .then((resp) => {
          const lastGrit = resp.messages.find((m) => m.role === 'assistant');
          if (lastGrit?.content) {
            const text = lastGrit.content.replace(/[#*_`]/g, '').trim();
            setInsight(text.length > 120 ? text.slice(0, 117) + '...' : text);
          }
        })
        .catch(() => {});
    }, []),
  );

  return <GritInsightCardView insight={insight} onOpenChat={onOpenChat} />;
}

// Presentational body — no data fetching / navigation hooks, so it is safe to
// render outside a NavigationContainer (e.g. the headless marketing renderer).
export function GritInsightCardView({ insight, onOpenChat }: { insight: string; onOpenChat: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.glass, borderColor: colors.border }]}
      onPress={onOpenChat}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
        <Text style={[styles.avatarText, { color: colors.primary }]}>G</Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.text, { color: colors.textPrimary }]} numberOfLines={2}>
          {insight}
        </Text>
        <View style={styles.linkRow}>
          <Text style={[styles.link, { color: colors.primary }]}>Chat with Grit</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontFamily: Fonts.heading,
  },
  content: {
    flex: 1,
    gap: 6,
  },
  text: {
    fontSize: 13,
    fontFamily: Fonts.body,
    lineHeight: 18,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  link: {
    fontSize: 12,
    fontFamily: Fonts.bodySemiBold,
  },
});
