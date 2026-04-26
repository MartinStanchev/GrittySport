import { useCallback, useEffect, useRef, useState } from 'react';
import { getValidAccessToken, getWsBaseUrl, onChatCleared } from '../services/api';
import { TOOL_LABELS } from '../constants/toolLabels';

export interface SegmentHeaderData {
  segmentId: string;
  segmentType: string;
  label: string;
  subtitle?: string;
  refType?: string;
  refId?: string;
  startedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  messageType?: 'text' | 'program_proposal' | 'program_edit' | 'tool_action' | 'segment_header';
  proposalData?: any;
  toolName?: string;
  toolDone?: boolean;
  segmentHeader?: SegmentHeaderData;
}

interface WsIncoming {
  type: string;
  content?: string;
  done?: boolean;
  tool?: string;
  status?: string;
  data?: any;
  quick_replies?: string[];
  usage_remaining?: number;
  usage_limit?: number;
  resets_at?: string;
}

interface UseChatWebSocketOptions {
  onProgramCreated?: (programId: string) => void;
  onAdjustmentApplied?: () => void;
}

export function useChatWebSocket(options: UseChatWebSocketOptions = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isGritTyping, setIsGritTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [rateLimitResetsAt, setRateLimitResetsAt] = useState<string | null>(null);
  const [usageRemaining, setUsageRemaining] = useState<number | null>(null);
  const [usageLimit, setUsageLimit] = useState<number | null>(null);

  // Tracks whether the chat overlay is currently open
  const chatOpenRef = useRef(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectDelayRef = useRef(1000);
  const connectingRef = useRef(false);
  const mountedRef = useRef(true);
  const streamingContentRef = useRef('');
  const optionsRef = useRef(options);
  const historyLoadedRef = useRef(false);
  optionsRef.current = options;

  // Track whether we've given up on auth — stops reconnect loop when logged out
  const authFailedRef = useRef(false);

  /** Mark all in-flight tool_action messages as done. */
  function finalizeToolActions(msgs: ChatMessage[]): ChatMessage[] {
    const hasActive = msgs.some((m) => m.messageType === 'tool_action' && !m.toolDone);
    if (!hasActive) return msgs;
    return msgs.map((m) =>
      m.messageType === 'tool_action' && !m.toolDone ? { ...m, toolDone: true } : m,
    );
  }

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (connectingRef.current) return;
    if (authFailedRef.current) return;
    connectingRef.current = true;

    // Cancel any pending reconnect since we're connecting now
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    const token = await getValidAccessToken();
    if (!token || !mountedRef.current) {
      connectingRef.current = false;
      // Token is null — either not logged in or refresh failed.
      // Stop trying to reconnect until next explicit connect() call.
      authFailedRef.current = true;
      if (__DEV__) {
        console.log('[WS] No valid token available — stopping reconnect');
      }
      return;
    }

    if (__DEV__) {
      console.log('[WS] Connecting with token...');
    }

    const wsUrl = `${getWsBaseUrl()}/api/ws/chat?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    // Track whether this socket ever successfully opened.
    // If it closes without opening, it was an auth/network rejection — don't retry immediately.
    let didOpen = false;

    ws.onopen = () => {
      didOpen = true;
      connectingRef.current = false;
      authFailedRef.current = false;
      if (!mountedRef.current) return;
      setIsConnected(true);
      reconnectDelayRef.current = 1000;
      if (__DEV__) {
        console.log('[WS] Connected successfully');
      }
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      const data: WsIncoming = JSON.parse(event.data);

      if (data.type === 'rate_limited') {
        setIsRateLimited(true);
        setIsGritTyping(false);
        if (data.resets_at) setRateLimitResetsAt(data.resets_at);
        setMessages((prev) => [
          ...prev,
          {
            id: `rate-limit-${Date.now()}`,
            role: 'system',
            content: data.content || "You've used your free messages this week.",
            messageType: 'text',
          },
        ]);
      } else if (data.type === 'grit_chunk') {
        if (data.done) {
          setIsGritTyping(false);
          if (data.usage_remaining != null) {
            setUsageRemaining(data.usage_remaining);
            setIsRateLimited(false);
          }
          if (data.usage_limit != null) {
            setUsageLimit(data.usage_limit);
          }
          // Finalize tool actions and close the streaming message in one pass
          setMessages((prev) => {
            let updated = finalizeToolActions(prev);
            const last = updated[updated.length - 1];
            if (last?.isStreaming) {
              let content = last.content;
              const delimIdx = content.indexOf('|||QUICK_REPLIES|||');
              if (delimIdx >= 0) {
                content = content.substring(0, delimIdx).trimEnd();
              }
              updated = [...updated.slice(0, -1), { ...last, content, isStreaming: false }];
            }
            return updated;
          });
          streamingContentRef.current = '';
          if (!chatOpenRef.current) {
            setUnreadCount((n) => n + 1);
          }
          if (data.quick_replies && data.quick_replies.length > 0) {
            setQuickReplies(data.quick_replies);
          }
        } else {
          streamingContentRef.current += data.content;
          const currentContent = streamingContentRef.current;

          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...last, content: currentContent },
              ];
            }
            const newMsg: ChatMessage = {
              id: `streaming-${Date.now()}`,
              role: 'assistant',
              content: currentContent,
              isStreaming: true,
              messageType: 'text',
            };
            return [...prev, newMsg];
          });
        }
      } else if (data.type === 'tool_call') {
        const toolKey = data.tool || '';
        const label = TOOL_LABELS[toolKey] || toolKey.replace(/_/g, ' ');
        if (data.status === 'calling') {
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-${toolKey}-${Date.now()}`,
              role: 'system',
              content: label,
              messageType: 'tool_action',
              toolName: toolKey,
              toolDone: false,
            },
          ]);
        } else {
          // Mark the matching tool_action as done
          setMessages((prev) => {
            const idx = prev.findLastIndex(
              (m) => m.messageType === 'tool_action' && m.toolName === toolKey && !m.toolDone,
            );
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = { ...updated[idx], toolDone: true };
              return updated;
            }
            return prev;
          });
        }
      } else if (data.type === 'program_proposal' || data.type === 'edit_proposal') {
        setIsGritTyping(false);
        const messageType: ChatMessage['messageType'] =
          data.type === 'program_proposal' ? 'program_proposal' : 'program_edit';
        setMessages((prev) => [
          ...finalizeToolActions(prev),
          {
            id: `proposal-${Date.now()}`,
            role: 'system',
            content: '',
            messageType,
            proposalData: data.data,
          },
        ]);
      } else if (data.type === 'program_created') {
        const programId = data.data?.program_id;
        if (programId && optionsRef.current?.onProgramCreated) {
          optionsRef.current.onProgramCreated(programId);
        }
      } else if (data.type === 'edit_applied') {
        if (optionsRef.current?.onAdjustmentApplied) {
          optionsRef.current.onAdjustmentApplied();
        }
      } else if (data.type === 'error') {
        setIsGritTyping(false);
      }
    };

    ws.onclose = () => {
      connectingRef.current = false;
      if (!mountedRef.current) return;
      setIsConnected(false);

      if (!didOpen) {
        // Socket closed before opening — likely auth rejection (401).
        // Try once more with a fresh token; if that also fails, connect()
        // will set authFailedRef and stop the loop.
        if (__DEV__) {
          console.log('[WS] Connection rejected (never opened) — retrying in 5s');
        }
        reconnectTimeoutRef.current = setTimeout(connect, 5000);
        return;
      }

      // Normal disconnect — reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
      if (__DEV__) {
        console.log(`[WS] Disconnected — reconnecting in ${delay}ms`);
      }
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      setQuickReplies([]);

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        messageType: 'text',
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsGritTyping(true);
      streamingContentRef.current = '';

      wsRef.current.send(
        JSON.stringify({
          type: 'user_message',
          content,
        }),
      );
    },
    [],
  );

  const respondToProposal = useCallback(
    (action: 'accept' | 'deny', content?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      setIsGritTyping(true);
      setQuickReplies([]);
      streamingContentRef.current = '';

      wsRef.current.send(
        JSON.stringify({
          type: 'proposal_response',
          action,
          content: content || '',
        }),
      );

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: action === 'accept' ? 'Accepted the program' : (content || 'Requested changes'),
        messageType: 'text',
      };
      setMessages((prev) => [...prev, userMsg]);
    },
    [],
  );

  const loadHistory = useCallback((historyMessages: ChatMessage[], more: boolean) => {
    if (!historyLoadedRef.current) {
      setMessages(historyMessages);
      setHasMore(more);
      historyLoadedRef.current = true;
    }
  }, []);

  const prependHistory = useCallback((olderMessages: ChatMessage[], more: boolean) => {
    setMessages((prev) => [...olderMessages, ...prev]);
    setHasMore(more);
    setIsLoadingMore(false);
  }, []);

  const markRead = useCallback(() => {
    setUnreadCount(0);
    chatOpenRef.current = true;
  }, []);

  const markClosed = useCallback(() => {
    chatOpenRef.current = false;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    authFailedRef.current = false; // Reset on mount — user may have logged in
    connect();

    const unsubChatCleared = onChatCleared(() => {
      setMessages([]);
      setHasMore(false);
      setQuickReplies([]);
      historyLoadedRef.current = false;
      // Force WebSocket reconnect so backend reloads from the now-empty DB
      // (the backend caches recent messages in memory for the WS lifetime)
      reconnectDelayRef.current = 500;
      wsRef.current?.close();
    });

    return () => {
      mountedRef.current = false;
      disconnect();
      unsubChatCleared();
    };
  }, [connect, disconnect]);

  return {
    messages,
    isConnected,
    isGritTyping,
    quickReplies,
    unreadCount,
    isRateLimited,
    rateLimitResetsAt,
    usageRemaining,
    usageLimit,
    hasMore,
    isLoadingMore,
    sendMessage,
    respondToProposal,
    loadHistory,
    prependHistory,
    markRead,
    markClosed,
    setIsLoadingMore,
  };
}
