import { useState, useEffect } from "react";
import {
  cancelChatTask,
  streamChatMessage,
  fetchConversationMessages,
} from "../api/lusiyuan-api";
import type { ChatMessage, ChatReplyPart } from "../types/chat";
import type { VoiceStreamEvent } from "../types/chat";
import type { WebIdentity } from "../utils/storage";

interface UseChatOptions {
  voiceAutoplayEnabled?: boolean;
  onVoiceStreamEvent?: (event: VoiceStreamEvent) => void;
}

export function useChat(identity: WebIdentity, options: UseChatOptions = {}) {
  const { userId, conversationId, displayName } = identity;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setMessages([]);
    setError(null);
    setIsLoadingHistory(true);

    fetchConversationMessages(conversationId, userId)
      .then((history) => {
        if (cancelled) return;
        setMessages(
          history.map((m) => ({
            id: m.id,
            messageId: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
          }))
        );
      })
      .finally(() => {
        if (!cancelled) setIsLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, userId]);

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!content || isSending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    setIsStopping(false);
    setCurrentTaskId(null);
    setError(null);

    let receivedAssistantMessage = false;
    let stopped = false;

    function appendAssistantMessage(part: ChatReplyPart) {
      if (!part.content.trim()) return;
      receivedAssistantMessage = true;
      const assistantMsg: ChatMessage = {
        id: part.message_id ?? crypto.randomUUID(),
        messageId: part.message_id,
        role: "assistant",
        content: part.content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    try {
      await streamChatMessage(
        {
          user_id: userId,
          channel: "web",
          conversation_id: conversationId,
          message: content,
          display_name: displayName,
          voice: {
            autoplay: Boolean(options.voiceAutoplayEnabled),
          },
        },
        (event) => {
          if (event.type === "ready" && event.data.task_id) {
            setCurrentTaskId(event.data.task_id);
          }
          if (event.type === "message") appendAssistantMessage(event.data);
          if (
            event.type === "voice_start" ||
            event.type === "voice_chunk" ||
            event.type === "voice_done" ||
            event.type === "voice_error"
          ) {
            options.onVoiceStreamEvent?.(event);
          }
          if (event.type === "cancelled") stopped = true;
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
      if (!receivedAssistantMessage && !stopped) {
        // Remove the optimistic user message on failure before any assistant response appears.
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      }
    } finally {
      setIsSending(false);
      setIsStopping(false);
      setCurrentTaskId(null);
    }
  }

  async function stopMessage() {
    if (!currentTaskId || isStopping) return;
    setIsStopping(true);
    setError(null);

    try {
      await cancelChatTask({
        taskId: currentTaskId,
        userId,
        conversationId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "停止失败，请稍后重试");
      setIsStopping(false);
    }
  }

  return {
    messages,
    isSending,
    isStopping,
    canStop: Boolean(currentTaskId) && isSending && !isStopping,
    isLoadingHistory,
    error,
    sendMessage,
    stopMessage,
  };
}
