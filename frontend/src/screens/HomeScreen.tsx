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
import { UpcomingActivityCard } from '../components/UpcomingActivityCard';
import { FABActionSheet } from '../components/FABActionSheet';
import { ClearChatModal } from '../components/ClearChatModal';
import { pickWorkoutFile } from '../services/workoutFileParser';
import type { ThemeColors } from '../constants/colors';

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
  const [clearChatVisible, setClearChatVisible] = useState(false);

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
    loadHistory, isConnected, quickReplies, clearChat, activeToolAction,
    unreadCount, markRead, markClosed,
    isRateLimited, usageRemaining, usageLimit,
  } = useChatWebSocket({
    onProgramCreated: handleProgramCreated,
    onAdjustmentApplied: handleAdjustmentApplied,
  });

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
      getChatHistory(50)
        .then((resp) => {
          if (resp.messages.length > 0) {
            const mapped: ChatMessage[] = resp.messages.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
              messageType: 'text' as const,
            }));
            loadHistory(mapped);
          }
          setHistoryLoaded(true);
        })
        .catch(() => setHistoryLoaded(true));
    }
  }, [chatOpen, historyLoaded, loadHistory]);

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
              : [styles.gritBubble, { backgroundColor: colors.surface }],
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

  const confirmClearChat = useCallback(() => {
    setClearChatVisible(false);
    clearChat();
    setHistoryLoaded(false);
  }, [clearChat]);

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

  // Calculate program progress
  let progressText = '';
  let progressPercent = 0;
  if (activeProgram) {
    const start = new Date(activeProgram.start_date);
    const end = activeProgram.end_date ? new Date(activeProgram.end_date) : null;
    if (end) {
      const total = end.getTime() - start.getTime();
      const elapsed = Date.now() - start.getTime();
      progressPercent = Math.min(Math.max(elapsed / total, 0), 1);
      const totalWeeks = Math.ceil(total / (7 * 24 * 60 * 60 * 1000));
      const currentWeek = Math.ceil(elapsed / (7 * 24 * 60 * 60 * 1000));
      progressText = `Week ${Math.min(currentWeek, totalWeeks)} of ${totalWeeks}`;
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Scrollable Content -- padded so it scrolls past the floating bottom bar */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Zone */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>GRITTY FITNESS</Text>

          {activeProgram ? (
            <View style={[styles.programCard, { borderBottomColor: colors.border }]}>
              <Text style={[styles.activeProgramName, { color: colors.textPrimary }]}>{activeProgram.name}</Text>
              {activeProgram.sport && (
                <Text style={[styles.activeProgramSport, { color: colors.primary }]}>{activeProgram.sport}</Text>
              )}
              {progressText && (
                <Text style={[styles.activeProgramWeek, { color: colors.textSecondary }]}>{progressText}</Text>
              )}
              {activeProgram.end_date && (
                <View style={[styles.progressBarContainer, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={[styles.progressBarFill, { width: `${progressPercent * 100}%`, backgroundColor: colors.primary }]}
                  />
                </View>
              )}
              <Pressable
                style={[styles.logWorkoutBtn, { borderColor: colors.primary }]}
                onPress={() => navigation.navigate('RecordManual')}
              >
                <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
                <Text style={[styles.logWorkoutBtnText, { color: colors.primary }]}>Log Workout</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.programCard, { borderBottomColor: colors.border }]}>
              <Ionicons
                name="barbell-outline"
                size={32}
                color={colors.textSecondary}
                style={styles.programIcon}
              />
              <Text style={[styles.programText, { color: colors.textPrimary }]}>No active program</Text>
              <Text style={[styles.programSubtext, { color: colors.textSecondary }]}>
                Let Grit build your personalized training program
              </Text>
              <Pressable style={[styles.createButton, { backgroundColor: colors.primary }]} onPress={openProgramCreation}>
                <Text style={[styles.createButtonText, { color: colors.surface }]}>Create Your Program</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Middle Zone */}
        <View style={styles.comingUp}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Coming up</Text>
          {upcomingActivities.length > 0 ? (
            upcomingActivities.map((activity) => (
              <UpcomingActivityCard
                key={activity.id}
                activity={activity}
                onPress={() => navigation.navigate('ActivityDetail', { activityId: activity.id })}
                onRecord={() => navigation.navigate('RecordManual', { scheduledActivityId: activity.id, activityType: activity.activity_type })}
                onRecordGPS={() => navigation.navigate('RecordGPS', { scheduledActivityId: activity.id, activityType: activity.activity_type })}
              />
            ))
          ) : (
            <View style={[styles.emptyCard, { borderBottomColor: colors.border }]}>
              <Ionicons
                name="calendar-outline"
                size={24}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No upcoming activities</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating bottom -- FAB + chat bar overlaid on scroll content */}
      <View style={[styles.floatingBottom, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {/* FAB Row -- Log Workout */}
        <View style={styles.fabRow}>
          <Pressable
            style={[styles.fab, { backgroundColor: colors.primary }]}
            onPress={() => setFabSheetVisible(true)}
            hitSlop={8}
          >
            <Ionicons name="add" size={28} color={colors.surface} />
          </Pressable>
        </View>

        {/* Chat Bar */}
        <View style={[styles.chatBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <Pressable style={[styles.chatBarInner, { backgroundColor: colors.surface }]} onPress={() => openChat()}>
            <View style={[styles.chatBarAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.chatBarAvatarText, { color: colors.surface }]}>G</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : String(unreadCount)}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.chatBarPlaceholder, { color: colors.textSecondary }]}>
              {unreadCount > 0 ? 'Grit replied...' : 'Message Grit...'}
            </Text>
            <View style={[styles.sendButton, { backgroundColor: colors.surfaceAlt }]}>
              <Ionicons name="arrow-up" size={18} color={colors.textSecondary} />
            </View>
          </Pressable>
        </View>
      </View>

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
            <Pressable
              onPress={() => setClearChatVisible(true)}
              style={[styles.clearButton, { backgroundColor: colors.background }]}
              hitSlop={12}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Messages */}
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            onLayout={() => scrollToBottom(true)}
            onContentSizeChange={handleChatContentSizeChange}
          />

          {/* Typing / Tool Indicator */}
          {(isGritTyping || activeToolAction) &&
            messages[messages.length - 1]?.isStreaming !== true && (
              <View style={styles.typingContainer}>
                <View style={styles.toolActionRow}>
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                  <Text style={[styles.toolActionLabel, { color: colors.textSecondary }]}>
                    {activeToolAction ?? 'Thinking...'}
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

        <ClearChatModal
          visible={clearChatVisible}
          onCancel={() => setClearChatVisible(false)}
          onConfirm={confirmClearChat}
        />
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
  programCard: {
    marginTop: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  programIcon: {
    marginBottom: 8,
  },
  programText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  programSubtext: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  createButton: {
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  activeProgramName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  activeProgramSport: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  activeProgramWeek: {
    fontSize: 13,
    marginBottom: 8,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  logWorkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  logWorkoutBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 160,
  },
  floatingBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  fabRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  fab: {
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
  comingUp: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyText: {
    fontSize: 14,
  },
  chatBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
  },
  chatBarAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chatBarAvatarText: {
    fontWeight: '700',
    fontSize: 14,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30', // system red badge — intentionally static
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  chatBarPlaceholder: {
    flex: 1,
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
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
  toolActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  toolActionLabel: {
    fontSize: 12,
    fontStyle: 'italic',
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
  clearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
