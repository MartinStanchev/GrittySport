import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { Fonts } from '../constants/fonts';
import { ChatHeader } from '../components/ChatHeader';
import { ChatMessageItem } from '../components/ChatMessageItem';
import { getMarkdownStyles } from '../screens/MarketingPlaygroundScreen';
import type { ChatMessage } from '../hooks/useChatWebSocket';

const EMPTY_SET = new Set<string>();
const noop = () => {};

// Replay variant of the chat scene used for video capture. Renders the same
// ChatHeader + ChatMessageItem + "Thinking..." row as the real chat, but shows
// only the first `visibleCount` messages and an optional typing indicator. The
// capture tool (marketing-studio/video/chat-replay.mjs) steps it frame-by-frame
// through window.__marketingReplay, so timing lives in the tool, not here.
export function ChatReplayStage({ messages }: { messages: ChatMessage[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const markdownStyles = useMemo(() => getMarkdownStyles(colors), [colors]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__marketingReplay = {
      ready: true,
      total: messages.length,
      roles: messages.map((m) => m.role),
      setStep: (count: number, isTyping: boolean) => {
        setVisibleCount(count);
        setTyping(isTyping);
      },
    };
    return () => {
      delete w.__marketingReplay;
    };
  }, [messages]);

  // Keep the newest content in view as messages reveal, like the real chat.
  useEffect(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
  }, [visibleCount, typing]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="marketing-replay-ready">
      <ChatHeader onClose={noop} isConnected />
      <FlatList
        ref={listRef}
        data={messages.slice(0, visibleCount)}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <ChatMessageItem
            item={item}
            colors={colors}
            markdownStyles={markdownStyles}
            respondedProposalIds={EMPTY_SET}
            onReviewProposal={noop}
            onAcceptEdit={noop}
            onDenyEdit={noop}
            onReviewEdit={noop}
          />
        )}
        ListFooterComponent={
          typing ? (
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={[styles.typingLabel, { color: colors.textSecondary }]}>Thinking...</Text>
            </View>
          ) : null
        }
      />
      <View
        style={[
          styles.inputContainer,
          { paddingBottom: insets.bottom + 8, borderTopColor: colors.border, backgroundColor: colors.surface },
        ]}
      >
        <View style={[styles.input, { backgroundColor: colors.background }]}>
          <Text style={[styles.inputPlaceholder, { color: colors.textSecondary }]}>Message Grit...</Text>
        </View>
        <View style={[styles.sendButton, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="arrow-up" size={18} color={colors.textSecondary} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 8 },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  typingLabel: { fontSize: 12, fontStyle: 'italic', fontFamily: Fonts.body },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },
  inputPlaceholder: { fontSize: 15, fontFamily: Fonts.body },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
});
