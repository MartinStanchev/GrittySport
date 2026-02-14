import { useCallback, useEffect, useRef, useState } from 'react';
import { getAccessToken, getWsBaseUrl } from '../services/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
}

interface WsIncoming {
  type: 'grit_chunk' | 'error';
  content: string;
  done?: boolean;
}

export function useChatWebSocket() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isGritTyping, setIsGritTyping] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelayRef = useRef(1000);
  const mountedRef = useRef(true);
  const streamingContentRef = useRef('');

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
          setIsGritTyping(false);
          // Finalize the streaming message
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { ...last, isStreaming: false }];
            }
            return prev;
          });
          streamingContentRef.current = '';
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
            // First chunk — create new assistant message
            const newMsg: ChatMessage = {
              id: `streaming-${Date.now()}`,
              role: 'assistant',
              content: currentContent,
              isStreaming: true,
            };
            return [...prev, newMsg];
          });
        }
      } else if (data.type === 'error') {
        setIsGritTyping(false);
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);

      // Reconnect with exponential backoff
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

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
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

  const loadHistory = useCallback((historyMessages: ChatMessage[]) => {
    setMessages(historyMessages);
  }, []);

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
    sendMessage,
    loadHistory,
  };
}
