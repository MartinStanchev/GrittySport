import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getAccessToken, getWsBaseUrl } from '../services/api';
import { TOOL_LABELS } from '../constants/toolLabels';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  messageType?: 'text' | 'program_proposal' | 'adjustment_proposal';
  proposalData?: any;
}

interface WsIncoming {
  type: string;
  content?: string;
  done?: boolean;
  tool?: string;
  status?: string;
  data?: any;
  quick_replies?: string[];
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
  const [activeToolAction, setActiveToolAction] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);
  const streamingContentRef = useRef('');
  const optionsRef = useRef(options);
  const historyLoadedRef = useRef(false);
  const chatContextRef = useRef('free_chat');
  const lastActivityRef = useRef<number>(Date.now());
  optionsRef.current = options;

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = await getAccessToken();
    if (!token || !mountedRef.current) return;

    const wsUrl = `${getWsBaseUrl()}/api/ws/chat?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      reconnectDelayRef.current = 1000;
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;

      const data: WsIncoming = JSON.parse(event.data);

      if (data.type === 'grit_chunk') {
        if (data.done) {
          lastActivityRef.current = Date.now();
          setIsGritTyping(false);
          setActiveToolAction(null);
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              // Strip the quick reply delimiter from displayed message
              let content = last.content;
              const delimIdx = content.indexOf('|||QUICK_REPLIES|||');
              if (delimIdx >= 0) {
                content = content.substring(0, delimIdx).trimEnd();
              }
              return [...prev.slice(0, -1), { ...last, content, isStreaming: false }];
            }
            return prev;
          });
          streamingContentRef.current = '';
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
        if (data.status === 'calling') {
          const label = TOOL_LABELS[data.tool || ''] || `Running ${data.tool}...`;
          setActiveToolAction(label);
        } else {
          setActiveToolAction(null);
        }
      } else if (data.type === 'program_proposal') {
        setIsGritTyping(false);
        setActiveToolAction(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `proposal-${Date.now()}`,
            role: 'system',
            content: '',
            messageType: 'program_proposal',
            proposalData: data.data,
          },
        ]);
      } else if (data.type === 'adjustment_proposal') {
        setIsGritTyping(false);
        setActiveToolAction(null);
        setMessages((prev) => [
          ...prev,
          {
            id: `adj-proposal-${Date.now()}`,
            role: 'system',
            content: '',
            messageType: 'adjustment_proposal',
            proposalData: data.data,
          },
        ]);
      } else if (data.type === 'program_created') {
        const programId = data.data?.program_id;
        if (programId && optionsRef.current?.onProgramCreated) {
          optionsRef.current.onProgramCreated(programId);
        }
      } else if (data.type === 'adjustment_applied') {
        if (optionsRef.current?.onAdjustmentApplied) {
          optionsRef.current.onAdjustmentApplied();
        }
      } else if (data.type === 'error') {
        setIsGritTyping(false);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);

      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
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
    (content: string, context = 'free_chat') => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      setQuickReplies([]);
      chatContextRef.current = context;

      lastActivityRef.current = Date.now();

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
          context,
        }),
      );
    },
    [],
  );

  const respondToProposal = useCallback(
    (action: 'accept' | 'deny', context = 'free_chat', content?: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      setIsGritTyping(true);
      setQuickReplies([]);
      streamingContentRef.current = '';

      wsRef.current.send(
        JSON.stringify({
          type: 'proposal_response',
          action,
          context,
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

  const clearChat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'clear_context',
          context: chatContextRef.current,
        }),
      );
    }

    setMessages([]);
    setQuickReplies([]);
    setIsGritTyping(false);
    streamingContentRef.current = '';
    historyLoadedRef.current = false;
  }, []);

  const loadHistory = useCallback((historyMessages: ChatMessage[]) => {
    if (!historyLoadedRef.current) {
      setMessages(historyMessages);
      historyLoadedRef.current = true;
    }
  }, []);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    let prevState: AppStateStatus = AppState.currentState;

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && prevState !== 'active') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= SIX_HOURS_MS && messagesRef.current.length > 0) {
          clearChat();
        }
      }
      prevState = nextState;
    });
    return () => sub.remove();
  }, [clearChat]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    messages,
    isConnected,
    isGritTyping,
    quickReplies,
    activeToolAction,
    sendMessage,
    respondToProposal,
    loadHistory,
    clearChat,
  };
}
