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
import { useFetchOnFocus } from '../hooks/useFetchOnFocus';
import { Ionicons } from '@expo/vector-icons';
import { isGPSActivity, isManualActivity } from '../constants/activityIcons';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../contexts/ThemeContext';
import { useChatWebSocket, ChatMessage } from '../hooks/useChatWebSocket';
import { useProgram } from '../contexts/ProgramContext';
import { getChatHistory, getWorkouts } from '../services/api';
import type { ChatMessageResponse, ChatSegmentResponse } from '../services/api';
import { ProgramProposalCard } from '../components/ProgramProposalCard';
import type { ProgramProposalData } from '../components/ProgramProposalCard';
import { ProgramEditCard } from '../components/ProgramEditCard';
import type { ProgramEditData } from '../components/ProgramEditCard';
import { ProposalReviewView } from '../components/ProposalReviewView';
import { EditProposalReviewView } from '../components/EditProposalReviewView';
import { TodayWorkoutCard } from '../components/TodayWorkoutCard';
import { GritInsightCard } from '../components/GritInsightCard';
import { QuickStatsRow } from '../components/QuickStatsRow';
import { WeeklyEffortCounter } from '../components/WeeklyEffortCounter';
import { LastWorkoutCard } from '../components/LastWorkoutCard';
import { StreakDots } from '../components/StreakDots';
import { QuickStartSection } from '../components/QuickStartSection';
import { useAuth } from '../contexts/AuthContext';
import { pickWorkoutFile } from '../services/workoutFileParser';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { TOOL_LABELS } from '../constants/toolLabels';

const TOOL_CALL_RE = /^\[System: Grit called tools?: ([^\]]+?)(?:\. .*)?\]$/;

function buildSegmentHeaderMessage(seg: ChatSegmentResponse): ChatMessage {
  const h = seg.header!;
  return {
    id: `seg-${seg.id}`,
    role: 'system',
    content: '',
    messageType: 'segment_header',
    segmentHeader: {
      segmentId: seg.id,
      segmentType: seg.segment_type,
      label: h.label,
      subtitle: h.subtitle,
      refType: h.ref_type,
      refId: h.ref_id,
      startedAt: seg.started_at,
    },
  };
}

function mapHistoryMessages(
  messages: ChatMessageResponse[],
  segments: ChatSegmentResponse[] = [],
): ChatMessage[] {
  // Only segments with a header are renderable cues. general_coaching never has
  // a header — its absence is the visual signal for "ordinary chat."
  const renderable = segments.filter(
    (s) => s.header && s.segment_type !== 'general_coaching',
  );

  // Anchor each header to its start_message_id so the cue lands immediately
  // BEFORE the message that opened the segment. Timestamp comparison would
  // misorder it: segments are saved a few ms after the message, so
  // segment.started_at > start_message.created_at.
  const segByStartMsg = new Map<string, ChatSegmentResponse>();
  const orphans: ChatSegmentResponse[] = [];
  for (const s of renderable) {
    if (s.start_message_id) {
      segByStartMsg.set(s.start_message_id, s);
    } else {
      orphans.push(s);
    }
  }

  const result: ChatMessage[] = [];

  for (const m of messages) {
    const seg = segByStartMsg.get(m.id);
    if (seg) {
      result.push(buildSegmentHeaderMessage(seg));
      segByStartMsg.delete(m.id);
    }

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
      continue;
    }

    result.push({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      messageType: 'text',
    });
  }

  // Append any segments whose anchor message wasn't in this page (orphans, or
  // anchors paginated out). They land at the end so they remain visible.
  for (const seg of segByStartMsg.values()) {
    result.push(buildSegmentHeaderMessage(seg));
  }
  for (const seg of orphans) {
    result.push(buildSegmentHeaderMessage(seg));
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
      fontFamily: Fonts.body,
    },
    heading1: {
      fontSize: 20,
      fontFamily: Fonts.heading,
      color: colors.textPrimary,
      marginBottom: 4,
      marginTop: 8,
    },
    heading2: {
      fontSize: 17,
      fontFamily: Fonts.heading,
      color: colors.textPrimary,
      marginBottom: 4,
      marginTop: 6,
    },
    heading3: {
      fontSize: 15,
      fontFamily: Fonts.heading,
      color: colors.textPrimary,
      marginBottom: 2,
      marginTop: 4,
    },
    strong: {
      fontFamily: Fonts.bodyBold,
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

/** Compute which days (Mon=0 .. Sun=6) had workouts this week. */
function useWeeklyCompletedDays(): Set<number> {
  const [days, setDays] = useState<Set<number>>(new Set());

  useFetchOnFocus(
    useCallback(async () => {
      const now = new Date();
      // Monday of current week
      const dayOfWeek = now.getDay(); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);

      const startDate = monday.toISOString().split('T')[0];
      const workouts = await getWorkouts({ start_date: startDate, limit: 50 });
      const completed = new Set<number>();
      for (const w of workouts) {
        const d = new Date(w.started_at);
        const jsDay = d.getDay(); // 0=Sun
        // Convert to Mon=0 .. Sun=6
        const monIdx = jsDay === 0 ? 6 : jsDay - 1;
        completed.add(monIdx);
      }
      setDays(completed);
    }, []),
  );

  return days;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const keyboardHeight = useKeyboardHeight();
  const { user } = useAuth();
  const {
    activeProgram, upcomingActivities, notifyProgramDataChanged,
    openChatRequest, clearOpenChatRequest, refreshUpcoming,
    setChatUnreadCount,
  } = useProgram();

  const [chatOpen, setChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [respondedProposals, setRespondedProposals] = useState<Set<string>>(new Set());
  const [reviewingProposal, setReviewingProposal] = useState<{ data: ProgramProposalData; messageId: string } | null>(null);
  const [reviewingEditProposal, setReviewingEditProposal] = useState<{ data: ProgramEditData; messageId: string } | null>(null);

  const inputRef = useRef<TextInput>(null);

  const markdownStyles = useMemo(() => getMarkdownStyles(colors), [colors]);

  const completedDays = useWeeklyCompletedDays();

  const todayActivities = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return upcomingActivities.filter((a) => a.date === today);
  }, [upcomingActivities]);

  // Build set of scheduled_activity_ids that have been completed today
  const [completedActivityIds, setCompletedActivityIds] = useState<Set<string>>(new Set());
  useFetchOnFocus(
    useCallback(async () => {
      const today = new Date().toISOString().split('T')[0];
      const workouts = await getWorkouts({ start_date: today, limit: 50 });
      const ids = new Set<string>();
      for (const w of workouts) {
        if (w.scheduled_activity_id) ids.add(w.scheduled_activity_id);
      }
      // Only update state if the set actually changed to avoid no-op re-renders
      setCompletedActivityIds((prev) => {
        if (prev.size === ids.size && [...ids].every((id) => prev.has(id))) return prev;
        return ids;
      });
    }, []),
  );

  const handleProgramCreated = useCallback(() => {
    notifyProgramDataChanged();
    setTimeout(() => {
      setChatOpen(false);
    }, 1500);
  }, [notifyProgramDataChanged]);

  const {
    messages, isGritTyping, sendMessage, respondToProposal,
    loadHistory, prependHistory, isConnected, quickReplies,
    unreadCount, markRead, markClosed,
    isRateLimited, usageRemaining, usageLimit,
    hasMore, isLoadingMore, setIsLoadingMore,
  } = useChatWebSocket({
    onProgramCreated: handleProgramCreated,
    onAdjustmentApplied: notifyProgramDataChanged,
  });

  // Sync unread count to shared context for tab badge
  useEffect(() => {
    setChatUnreadCount(unreadCount);
  }, [unreadCount, setChatUnreadCount]);

  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }, [messages]);

  // Inverted FlatList expects newest-first order
  const invertedMessages = useMemo(
    () => [...uniqueMessages].reverse(),
    [uniqueMessages],
  );

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
            loadHistory(mapHistoryMessages(resp.messages, resp.segments), resp.has_more);
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
        prependHistory(mapHistoryMessages(resp.messages, resp.segments), resp.has_more);
      })
      .catch(() => setIsLoadingMore(false));
  }, [hasMore, isLoadingMore, messages, setIsLoadingMore, prependHistory]);


  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    if (!chatOpen) openChat();
    sendMessage(text);
  }, [inputText, chatOpen, openChat, sendMessage]);


  const handleProposalResponse = useCallback(
    (action: 'accept' | 'deny', proposalId: string) => {
      setRespondedProposals((prev) => new Set(prev).add(proposalId));
      respondToProposal(action);
    },
    [respondToProposal],
  );

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      if (item.messageType === 'segment_header' && item.segmentHeader) {
        return (
          <View style={styles.segmentHeaderRow}>
            <View style={[styles.segmentHeaderRule, { backgroundColor: colors.border }]} />
            <View style={styles.segmentHeaderTextWrap}>
              <Text style={[styles.segmentHeaderLabel, { color: colors.textSecondary }]}>
                {item.segmentHeader.label}
              </Text>
              {item.segmentHeader.subtitle ? (
                <Text style={[styles.segmentHeaderSubtitle, { color: colors.textSecondary }]}>
                  {item.segmentHeader.subtitle}
                </Text>
              ) : null}
            </View>
            <View style={[styles.segmentHeaderRule, { backgroundColor: colors.border }]} />
          </View>
        );
      }

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

      if (item.messageType === 'program_proposal') {
        return (
          <ProgramProposalCard
            data={item.proposalData}
            onReview={() => setReviewingProposal({ data: item.proposalData, messageId: item.id })}
            disabled={respondedProposals.has(item.id)}
          />
        );
      }

      if (item.messageType === 'program_edit') {
        return (
          <ProgramEditCard
            data={item.proposalData}
            onAccept={() => handleProposalResponse('accept', item.id)}
            onDeny={() => handleProposalResponse('deny', item.id)}
            onReviewChanges={() => setReviewingEditProposal({ data: item.proposalData, messageId: item.id })}
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
            <Text style={[styles.messageText, { color: colors.background }]}>
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

  const handleReviewAccept = useCallback(() => {
    if (!reviewingProposal) return;
    handleProposalResponse('accept', reviewingProposal.messageId);
    setReviewingProposal(null);
  }, [reviewingProposal, handleProposalResponse]);

  const handleReviewDeny = useCallback(() => {
    if (!reviewingProposal) return;
    handleProposalResponse('deny', reviewingProposal.messageId);
    setReviewingProposal(null);
  }, [reviewingProposal, handleProposalResponse]);

  const handleEditReviewAccept = useCallback(() => {
    if (!reviewingEditProposal) return;
    handleProposalResponse('accept', reviewingEditProposal.messageId);
    setReviewingEditProposal(null);
  }, [reviewingEditProposal, handleProposalResponse]);

  const handleEditReviewDeny = useCallback(() => {
    if (!reviewingEditProposal) return;
    handleProposalResponse('deny', reviewingEditProposal.messageId);
    setReviewingEditProposal(null);
  }, [reviewingEditProposal, handleProposalResponse]);

  useFocusEffect(
    useCallback(() => {
      refreshUpcoming();
    }, [refreshUpcoming]),
  );

  useFocusEffect(
    useCallback(() => {
      if (openChatRequest) {
        clearOpenChatRequest();
        markRead();
        setHistoryLoaded(false); // force refresh so review + reply appear
        setChatOpen(true);
      }
    }, [openChatRequest, clearOpenChatRequest, markRead]),
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
          <Text style={[styles.greeting, { color: colors.textPrimary }]}>
            {getGreeting()}, {user?.name?.split(' ')[0] || 'Athlete'}
          </Text>
          <Text style={[styles.greetingSub, { color: colors.textSecondary }]}>
            READY FOR THE GRIND?
          </Text>
        </View>

        {/* Quick Stats */}
        <QuickStatsRow
          workoutCount={completedDays.size}
          streakDays={completedDays.size}
        />

        {/* Today's Workout Hero */}
        <TodayWorkoutCard
          activities={todayActivities}
          completedIds={completedActivityIds}
          program={activeProgram}
          onStartWorkout={(activity) => {
            if (isGPSActivity(activity.activity_type)) {
              navigation.navigate('RecordGPS', {
                scheduledActivityId: activity.id,
                activityType: activity.activity_type,
              });
            } else {
              navigation.navigate('RecordManual', {
                scheduledActivityId: activity.id,
                activityType: activity.activity_type,
              });
            }
          }}
          onCreateProgram={openProgramCreation}
        />

        {/* Grit Insight */}
        <GritInsightCard onOpenChat={openChat} />

        {/* Weekly Effort */}
        <WeeklyEffortCounter />

        {/* Last Workout */}
        <LastWorkoutCard onPress={(workoutId) => navigation.navigate('WorkoutDetail', { workoutId })} />

        {/* Streak Dots */}
        <StreakDots completedDays={completedDays} />

        {/* Quick Start */}
        <QuickStartSection
          onRepeatLast={(activityType) => navigation.navigate('RecordManual', { activityType })}
          onStartWorkout={() => navigation.navigate('RecordManual')}
          onLogActivity={() => navigation.navigate('LogActivity')}
          onImportFile={async () => {
            const file = await pickWorkoutFile();
            if (file) navigation.navigate('ImportPreview', { fileUri: file.uri, fileName: file.fileName });
          }}
        />
      </ScrollView>

      {/* Chat Modal */}
      <Modal
        visible={chatOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={
          reviewingEditProposal ? () => setReviewingEditProposal(null) :
          reviewingProposal ? () => setReviewingProposal(null) :
          closeChat
        }
      >
        {reviewingEditProposal ? (
          <EditProposalReviewView
            data={reviewingEditProposal.data}
            onAccept={handleEditReviewAccept}
            onDeny={handleEditReviewDeny}
            onBack={() => setReviewingEditProposal(null)}
            disabled={respondedProposals.has(reviewingEditProposal.messageId)}
          />
        ) : reviewingProposal ? (
          <ProposalReviewView
            data={reviewingProposal.data}
            onAccept={handleReviewAccept}
            onDeny={handleReviewDeny}
            onBack={() => setReviewingProposal(null)}
            disabled={respondedProposals.has(reviewingProposal.messageId)}
          />
        ) : (
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
            data={invertedMessages}
            inverted
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="none"
            onEndReached={loadOlderMessages}
            onEndReachedThreshold={0.15}
            ListFooterComponent={
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
        )}
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
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingBottom: 16,
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
    fontFamily: Fonts.heading,
    fontSize: 16,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontFamily: Fonts.heading,
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
    fontFamily: Fonts.body,
  },
  messageList: {
    flex: 1,
  },
  messageListContent: {
    padding: 16,
    paddingBottom: 8,
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
    fontFamily: Fonts.bodySemiBold,
    marginBottom: 3,
  },
  messageText: {
    fontSize: 15,
    fontFamily: Fonts.body,
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
    fontFamily: Fonts.body,
  },
  segmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  segmentHeaderRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  segmentHeaderTextWrap: {
    alignItems: 'center',
    maxWidth: '70%',
  },
  segmentHeaderLabel: {
    fontSize: 12,
    fontFamily: Fonts.heading,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  segmentHeaderSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.body,
    marginTop: 2,
    textAlign: 'center',
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
    fontFamily: Fonts.body,
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
    fontFamily: Fonts.bodySemiBold,
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
    fontFamily: Fonts.bodySemiBold,
  },
});
