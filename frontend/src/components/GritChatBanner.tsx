import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { getChatHistory } from '../services/api';

interface GritChatBannerProps {
  onOpenChat: () => void;
  unreadCount: number;
}

export function GritChatBanner({ onOpenChat, unreadCount }: GritChatBannerProps) {
  const { colors } = useTheme();
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useFetchOnFocus(
    useCallback(async () => {
      const resp = await getChatHistory(5);
      const assistantMsg = resp.messages.find((m) => m.role === 'assistant');
      if (assistantMsg) {
        setLastMessage(assistantMsg.content);
      }
    }, []),
  );

  return (
    <Pressable
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={onOpenChat}
    >
      <View style={styles.headerRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.surface }]}>G</Text>
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.error }]}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Grit</Text>
        <View style={[styles.aiBadge, { borderColor: colors.primary }]}>
          <Text style={[styles.aiBadgeText, { color: colors.primary }]}>AI</Text>
        </View>
        <View style={styles.spacer} />
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>
      {lastMessage ? (
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
          {lastMessage}
        </Text>
      ) : (
        <Text style={[styles.preview, { color: colors.textSecondary }]}>
          Your AI coach is ready to help
        </Text>
      )}
      <View style={[styles.inputMock, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
        <Text style={[styles.inputPlaceholder, { color: colors.textSecondary }]}>
          Ask Grit anything...
        </Text>
        <View style={[styles.sendMock, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="arrow-up" size={16} color={colors.textSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '700',
    fontSize: 14,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  aiBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  spacer: {
    flex: 1,
  },
  preview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  inputMock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  inputPlaceholder: {
    flex: 1,
    fontSize: 14,
  },
  sendMock: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
