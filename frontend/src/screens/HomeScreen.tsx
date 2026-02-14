import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { useChatWebSocket, ChatMessage } from '../hooks/useChatWebSocket';
import { getChatHistory } from '../services/api';

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

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { messages, isGritTyping, sendMessage, loadHistory, isConnected } =
    useChatWebSocket();

  const [chatOpen, setChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const openChat = useCallback(() => {
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    Keyboard.dismiss();
    setChatOpen(false);
  }, []);

  useEffect(() => {
    if (chatOpen && !historyLoaded) {
      getChatHistory('free_chat', 50)
        .then((resp) => {
          if (resp.messages.length > 0) {
            const mapped: ChatMessage[] = resp.messages.map((m) => ({
              id: m.id,
              role: m.role as 'user' | 'assistant',
              content: m.content,
            }));
            loadHistory(mapped);
          }
          setHistoryLoaded(true);
        })
        .catch(() => setHistoryLoaded(true));
    }
  }, [chatOpen, historyLoaded, loadHistory]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

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

  // Also scroll when keyboard opens
  useEffect(() => {
    if (keyboardHeight > 0 && chatOpen) {
      scrollToBottom();
    }
  }, [keyboardHeight, chatOpen, scrollToBottom]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isUser = item.role === 'user';
      return (
        <View
          style={[
            styles.messageBubble,
            isUser ? styles.userBubble : styles.gritBubble,
          ]}
        >
          {!isUser && <Text style={styles.gritLabel}>Grit</Text>}
          <Text
            style={[
              styles.messageText,
              isUser ? styles.userText : styles.gritText,
            ]}
          >
            {item.content}
          </Text>
        </View>
      );
    },
    [],
  );

  // Bottom padding: when keyboard is open use keyboard height, otherwise use safe area
  const chatBottomPadding =
    keyboardHeight > 0 ? keyboardHeight : insets.bottom;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top Zone */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>GRITTY FITNESS</Text>
        <View style={styles.programCard}>
          <Ionicons
            name="barbell-outline"
            size={32}
            color={Colors.textSecondary}
            style={styles.programIcon}
          />
          <Text style={styles.programText}>No active program</Text>
          <Text style={styles.programSubtext}>
            Create one to get started with personalized training
          </Text>
          <Pressable style={styles.createButton} disabled>
            <Text style={styles.createButtonText}>Create Program</Text>
          </Pressable>
        </View>
      </View>

      {/* Middle Zone */}
      <View style={styles.comingUp}>
        <Text style={styles.sectionTitle}>Coming up</Text>
        <View style={styles.emptyCard}>
          <Ionicons
            name="calendar-outline"
            size={24}
            color={Colors.textSecondary}
          />
          <Text style={styles.emptyText}>No upcoming activities</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      {/* Bottom Zone — Chat Bar */}
      <View
        style={[styles.chatBar, { paddingBottom: Math.max(insets.bottom, 8) }]}
      >
        <Pressable style={styles.chatBarInner} onPress={openChat}>
          <View style={styles.chatBarAvatar}>
            <Text style={styles.chatBarAvatarText}>G</Text>
          </View>
          <Text style={styles.chatBarPlaceholder}>Message Grit...</Text>
          <View style={[styles.sendButton, styles.sendButtonDisabled]}>
            <Ionicons name="arrow-up" size={18} color={Colors.textSecondary} />
          </View>
        </Pressable>
      </View>

      {/* Chat Modal — truly full screen, above tab bar */}
      <Modal
        visible={chatOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeChat}
      >
        <View
          style={[styles.chatScreen, { paddingBottom: chatBottomPadding }]}
        >
          {/* Chat Header */}
          <View style={[styles.chatHeader, { paddingTop: insets.top + 8 }]}>
            <Pressable
              onPress={closeChat}
              style={styles.closeButton}
              hitSlop={12}
            >
              <Ionicons
                name="chevron-down"
                size={24}
                color={Colors.textPrimary}
              />
            </Pressable>
            <View style={styles.chatHeaderCenter}>
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>G</Text>
              </View>
              <View>
                <Text style={styles.chatHeaderTitle}>Grit</Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: isConnected ? '#4CAF50' : '#FF5722',
                      },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {isConnected ? 'Online' : 'Reconnecting...'}
                  </Text>
                </View>
              </View>
            </View>
            <View style={{ width: 36 }} />
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
            onLayout={scrollToBottom}
          />

          {/* Typing Indicator */}
          {isGritTyping &&
            messages[messages.length - 1]?.isStreaming !== true && (
              <View style={styles.typingContainer}>
                <View style={styles.typingDots}>
                  <View style={styles.typingDot} />
                  <View style={[styles.typingDot, styles.typingDotMiddle]} />
                  <View style={styles.typingDot} />
                </View>
              </View>
            )}

          {/* Chat Input */}
          <View style={styles.chatInputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.chatInput}
              placeholder="Message Grit..."
              placeholderTextColor={Colors.textSecondary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              autoFocus
            />
            <Pressable
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={inputText.trim() ? '#FFFFFF' : Colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
  },
  programCard: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  programIcon: {
    marginBottom: 8,
  },
  programText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  programSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  comingUp: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  // Chat Bar (Home screen)
  chatBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.tabBarBorder,
  },
  chatBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  chatBarAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chatBarAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  chatBarPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: Colors.textSecondary,
    paddingVertical: Platform.OS === 'ios' ? 6 : 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  sendButtonDisabled: {
    backgroundColor: '#E8E8E8',
  },
  // Chat Screen (Modal)
  chatScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.tabBarBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    color: Colors.textSecondary,
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
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  gritBubble: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  gritLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 3,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  userText: {
    color: '#FFFFFF',
  },
  gritText: {
    color: Colors.textPrimary,
  },
  typingContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textSecondary,
    opacity: 0.5,
  },
  typingDotMiddle: {
    opacity: 0.7,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.tabBarBorder,
    backgroundColor: Colors.surface,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    maxHeight: 120,
    minHeight: 40,
  },
});
