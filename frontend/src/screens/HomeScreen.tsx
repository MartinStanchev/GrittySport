import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../contexts/ThemeContext';
import { useChatWebSocket, ChatMessage } from '../hooks/useChatWebSocket';
import { useProgram } from '../contexts/ProgramContext';
import { getChatHistory } from '../services/api';
import { ProgramProposalCard } from '../components/ProgramProposalCard';
import { ProgramModificationCard } from '../components/ProgramModificationCard';
import { ProgramArc } from '../components/ProgramArc';
import { GritChatBanner } from '../components/GritChatBanner';
import { ActivityDashboard } from '../components/ActivityDashboard';
import { WeeklyEffortCounter } from '../components/WeeklyEffortCounter';
import { FABActionSheet } from '../components/FABActionSheet';
import { pickWorkoutFile } from '../services/workoutFileParser';
import type { ThemeColors } from '../constants/colors';
import { TOOL_LABELS } from '../constants/toolLabels';

const TOOL_CALL_RE = /^\[System: Grit called tools?: ([^\]]+?)(?:\. .*)?\]$/;

function mapHistoryMessages(messages: { id: string; role: string; content: string }[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === 'system') {
      const match = m.content.match(TOOL_CALL_RE);
      if (match) {
        const tools = match[1].split(',').map((t) => t.trim());
        for (let i = 0; i < tools.length; i++) {
          result.push({
            id: `${m.id}-tool-${i}`,
            role: 'assistant',
            content: TOOL_LABELS[tools[i]] ?? tools[i],
            messageType: 'tool_action',
            toolName: tools[i],
            toolDone: true,
          });
        }
      }
      // Skip system messages that don't match the tool pattern (internal context)
      continue;
    }
    result.push({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      messageType: 'text',
    });
  }
  return result;
}

function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates.height),
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}

function getMarkdownStyles(colors: ThemeColors) {
  return {
    body: {
      fontSize: 15,
      lineHeight: 21,
      color: colors.textPrimary,
    },
    heading1: {
      fontSize: 20,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      marginBottom: 4,
      marginTop: 8,
    },
    heading2: {
      fontSize: 17,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      marginBottom: 4,
      marginTop: 6,
    },
    heading3: {
      fontSize: 15,
      fontWeight: '700' as const,
      color: colors.textPrimary,
      marginBottom: 2,
      marginTop: 4,
    },
    strong: {
      fontWeight: '700' as const,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    list_item: {
      marginVertical: 2,
    },
    code_inline: {
      backgroundColor: colors.background,
      borderRadius: 4,
      paddingHorizontal: 4,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    fence: {
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
      marginVertical: 8,
      fontSize: 13,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    paragraph: {
      marginTop: 0,
      marginBottom: 6,
    },
  };
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const keyboardHeight = useKeyboardHeight();
  const {
    activeProgram, upcomingActivities, notifyProgramDataChanged,
    openChatRequest, clearOpenChatRequest, refreshUpcoming,
  } = useProgram();

  const [chatOpen, setChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [respondedProposals, setRespondedProposals] = useState<Set<string>>(new Set());
  const [fabSheetVisible, setFabSheetVisible] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const didInitialScrollRef = useRef(false);

  const markdownStyles = useMemo(() => getMarkdownStyles(colors), [colors]);

  const handleProgramCreated = useCallback(() => {
    notifyProgramDataChanged();
    setTimeout(() => {
      setChatOpen(false);
    }, 1500);
  }, [notifyProgramDataChanged]);

  const handleAdjustmentApplied = useCallback(() => {
    notifyProgramDataChanged();
  }, [notifyProgramDataChanged]);

  const {
    messages, isGritTyping, sendMessage, respondToProposal,
    loadHistory, prependHistory, isConnected, quickReplies,
    unreadCount, markRead, markClosed,
    isRateLimited, usageRemaining, usageLimit,
    hasMore, isLoadingMore, setIsLoadingMore,
  } = useChatWebSocket({
    onProgramCreated: handleProgramCreated,
    onAdjustmentApplied: handleAdjustmentApplied,
  });

  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  const openChat = useCallback(() => {
    markRead();
    setChatOpen(true);
  }, [markRead]);

  const closeChat = useCallback(() => {
    Keyboard.dismiss();
    markClosed();
    setChatOpen(false);
  }, [markClosed]);

  const openProgramCreation = useCallback(() => {
    setChatOpen(true);
    setTimeout(() => {
      sendMessage('I want to create a training program');
    }, 500);
  }, [sendMessage]);

  useEffect(() => {
    if (chatOpen && !historyLoaded) {
      getChatHistory(25)
        .then((resp) => {
          if (resp.messages.length > 0) {
            loadHistory(mapHistoryMessages(resp.messages), resp.has_more);
          }
          setHistoryLoaded(true);
        })
        .catch(() => setHistoryLoaded(true));
    }
  }, [chatOpen, historyLoaded, loadHistory]);

  const loadOlderMessages = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    const firstMsg = messages.find((m) => m.messageType !== 'tool_action');
    if (!firstMsg) return;
    setIsLoadingMore(true);
    getChatHistory(25, firstMsg.id)
      .then((resp) => {
        prependHistory(mapHistoryMessages(resp.messages), resp.has_more);
      })
      .catch(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, messages, setIsLoadingMore, prependHistory]);

  const scrollToBottom = useCallback((animated = true) => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated });
    }, 100);
  }, []);

  // When chat open state changes, reset so we scroll to bottom on next open (long history)
  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [chatOpen]);

  const handleChatContentSizeChange = useCallback(
    (_w: number, _h: number) => {
      if (messages.length > 0 && !didInitialScrollRef.current) {
        flatListRef.current?.scrollToEnd({ animated: false });
      }
    },
    [messages.length],
  );

  // Stop forcing scroll to bottom after a short window (list may report content size multiple times)
  useEffect(() => {
    if (!chatOpen) return;
    const t = setTimeout(() => {
      didInitialScrollRef.current = true;
    }, 600);
    return () => clearTimeout(t);
  }, [chatOpen]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    if (!chatOpen) openChat();
    sendMessage(text);
  }, [inputText, chatOpen, openChat, sendMessage]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (keyboardHeight > 0 && chatOpen) {
      scrollToBottom();
    }
  }, [keyboardHeight, chatOpen, scrollToBottom]);

  const handleProposalResponse = useCallback(
    (action: 'accept' | 'deny', proposalId: string) => {
      setRespondedProposals((prev) => new Set(prev).add(proposalId));
      respondToProposal(action);
    },
    [respondToProposal],
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.messageType === 'tool_action') {
        return (
          <View style={styles.toolActionRow}>
            {item.toolDone ? (
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            ) : (
              <ActivityIndicator size={12} color={colors.textSecondary} />
            )}
            <Text style={[styles.toolActionLabel, { color: colors.textSecondary }]}>
              {item.content}
            </Text>
          </View>
        );
      }

      if (item.messageType === 'program_proposal' || item.messageType === 'adjustment_proposal') {
        return (
          <ProgramProposalCard
            data={item.proposalData}
            onAccept={() => handleProposalResponse('accept', item.id)}
            onDeny={() => handleProposalResponse('deny', item.id)}
            disabled={respondedProposals.has(item.id)}
          />
        );
      }

      if (item.messageType === 'program_modification') {
        return (
          <ProgramModificationCard
            data={item.proposalData}
            onAccept={() => handleProposalResponse('accept', item.id)}
            onDeny={() => handleProposalResponse('deny', item.id)}
            disabled={respondedProposals.has(item.id)}
          />
        );
      }

      const isUser = item.role === 'user';
      return (
        <View
          style={[
            styles.messageBubble,
            isUser
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [styles.gritBubble, { backgroundColor: colors.messageBubble }],
          ]}
        >
          {!isUser && <Text style={[styles.gritLabel, { color: colors.primary }]}>Grit</Text>}
          {isUser ? (
            <Text style={[styles.messageText, { color: colors.surface }]}>
              {item.content}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>{item.content}</Markdown>
          )}
        </View>
      );
    },
    [handleProposalResponse, respondedProposals, colors, markdownStyles],
  );

  // Refresh upcoming activities each time the home tab gains focus
  useFocusEffect(
    useCallback(() => {
      refreshUpcoming();
    }, [refreshUpcoming]),
  );

  // Auto-open chat when another screen requests it (e.g. after saving program edits)
  useFocusEffect(
    useCallback(() => {
      if (openChatRequest) {
        clearOpenChatRequest();
        setChatOpen(true);
      }
    }, [openChatRequest, clearOpenChatRequest]),
  );

  const inputBottomPadding = keyboardHeight > 0 ? 4 : Math.max(insets.bottom, 8);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>GRITTY FITNESS</Text>
        </View>

        {/* Program Progress Arc */}
        <ProgramArc program={activeProgram} onCreateProgram={openProgramCreation} />

        {/* Grit Chat Banner */}
        <GritChatBanner onOpenChat={openChat} unreadCount={unreadCount} />

        {/* Activity Dashboard */}
        <ActivityDashboard
          upcomingActivities={upcomingActivities}
          onWorkoutPress={(workoutId) => navigation.navigate('WorkoutDetail', { workoutId })}
          onActivityPress={(activityId) => navigation.navigate('ActivityDetail', { activityId })}
        />

        {/* Weekly Effort */}
        <WeeklyEffortCounter />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary, bottom: Math.max(insets.bottom, 16) }]}
        onPress={() => setFabSheetVisible(true)}
        hitSlop={8}
      >
        <Ionicons name="add" size={28} color={colors.surface} />
      </Pressable>

      <FABActionSheet
        visible={fabSheetVisible}
        onClose={() => setFabSheetVisible(false)}
        onStartWorkout={() => navigation.navigate('RecordManual')}
        onLogActivity={() => navigation.navigate('LogActivity')}
        onImportFile={async () => {
          const file = await pickWorkoutFile();
          if (file) navigation.navigate('WorkoutFilePreview', { fileUri: file.uri, fileName: file.fileName });
        }}
      />

      {/* Chat Modal */}
      <Modal
        visible={chatOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeChat}
      >
        <KeyboardAvoidingView
          style={[styles.chatScreen, { backgroundColor: colors.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Chat Header */}
          <View style={[styles.chatHeader, { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Pressable
              onPress={closeChat}
              style={[styles.closeButton, { backgroundColor: colors.background }]}
              hitSlop={12}
            >
              <Ionicons
                name="chevron-down"
                size={24}
                color={colors.textPrimary}
              />
            </Pressable>
            <View style={styles.chatHeaderCenter}>
              <View style={[styles.headerAvatar, { backgroundColor: colors.primary }]}>
                <Text style={[styles.headerAvatarText, { color: colors.surface }]}>G</Text>
              </View>
              <View>
                <Text style={[styles.chatHeaderTitle, { color: colors.textPrimary }]}>Grit</Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isConnected ? colors.success : colors.error,
                      },
                    ]}
                  />
                  <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                    {isConnected ? 'Online' : 'Reconnecting...'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={uniqueMessages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            onLayout={() => scrollToBottom(true)}
            onContentSizeChange={handleChatContentSizeChange}
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y < 60 && hasMore && !isLoadingMore) {
                loadOlderMessages();
              }
            }}
            scrollEventThrottle={200}
            ListHeaderComponent={
              isLoadingMore ? (
                <View style={styles.loadMoreContainer}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                </View>
              ) : null
            }
          />

          {/* Typing Indicator */}
          {isGritTyping &&
            messages[messages.length - 1]?.isStreaming !== true &&
            messages[messages.length - 1]?.messageType !== 'tool_action' && (
              <View style={styles.typingContainer}>
                <View style={styles.typingRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={[styles.typingLabel, { color: colors.textSecondary }]}>
                    Thinking...
                  </Text>
                </View>
              </View>
            )}

          {/* Quick Reply Buttons */}
          {quickReplies.length > 0 && (
            <View style={styles.quickReplyContainer}>
              {quickReplies.map((reply) => (
                <Pressable
                  key={reply}
                  style={[styles.quickReplyButton, { borderColor: colors.primary, backgroundColor: colors.surface }]}
                  onPress={() => sendMessage(reply)}
                >
                  <Text style={[styles.quickReplyText, { color: colors.primary }]}>{reply}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Usage counter */}
          {!isRateLimited && usageRemaining != null && usageLimit != null && usageRemaining <= 15 && usageRemaining > 0 && (
            <View style={[styles.usageCounterContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.usageCounterText, { color: colors.textSecondary }]}>
                {usageRemaining} message{usageRemaining !== 1 ? 's' : ''} left this week
              </Text>
            </View>
          )}

          {/* Chat Input or Rate Limit Banner */}
          {isRateLimited ? (
            <View style={[styles.rateLimitBanner, { paddingBottom: inputBottomPadding, borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
              <Text style={[styles.rateLimitText, { color: colors.textSecondary }]}>
                You&apos;ve used your free messages this week. Resets Monday.
              </Text>
              <Pressable
                style={[styles.upgradeButton, { backgroundColor: colors.primary }]}
                onPress={() => Alert.alert('Coming Soon', 'Premium subscriptions will be available soon!')}
              >
                <Text style={[styles.upgradeButtonText, { color: colors.surface }]}>Upgrade</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.chatInputContainer, { paddingBottom: inputBottomPadding, borderTopColor: colors.border, backgroundColor: colors.surface }]}>
              {keyboardHeight > 0 && (
                <Pressable
                  onPress={() => Keyboard.dismiss()}
                  style={styles.keyboardDismissButton}
                  hitSlop={8}
                >
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </Pressable>
              )}
              <TextInput
                ref={inputRef}
                style={[styles.chatInput, { color: colors.textPrimary, backgroundColor: colors.background }]}
                placeholder="Message Grit..."
                placeholderTextColor={colors.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline
                maxLength={2000}
                blurOnSubmit={false}
                autoFocus
                autoCapitalize="sentences"
              />
              <Pressable
                style={[
                  styles.sendButton,
                  { backgroundColor: colors.primary },
                  !inputText.trim() && { backgroundColor: colors.surfaceAlt },
                ]}
                onPress={handleSend}
                disabled={!inputText.trim()}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={inputText.trim() ? colors.surface : colors.textSecondary}
                />
              </Pressable>
            </View>
          )}
        </KeyboardAvoidingView>

      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  chatScreen: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    fontWeight: '700',
    fontSize: 16,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  gritBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  gritLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  typingLabel: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  toolActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 6,
    marginBottom: 2,
  },
  toolActionLabel: {
    fontSize: 12,
  },
  loadMoreContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    minHeight: 40,
  },
  quickReplyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  quickReplyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickReplyText: {
    fontSize: 14,
    fontWeight: '600',
  },
  keyboardDismissButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  usageCounterContainer: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  usageCounterText: {
    fontSize: 12,
  },
  rateLimitBanner: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  rateLimitText: {
    fontSize: 14,
    textAlign: 'center',
  },
  upgradeButton: {
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
