import { useState, useEffect, useRef } from "react";
import { streamChatMessage, fetchConversationMessages } from "../api/lusiyuan-api";
import { getWebIdentity } from "../utils/storage";
import type { ChatMessage, ChatReplyPart } from "../types/chat";

export function useChat() {
  const { userId, conversationId } = getWebIdentity();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const initialized = useRef(false);

  // Load conversation history on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    fetchConversationMessages(conversationId)
      .then((history) => {
        if (history.length > 0) {
          setMessages(
            history.map((m) => ({
              id: crypto.randomUUID(),
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
            }))
          );
        }
      })
      .finally(() => setIsLoadingHistory(false));
  }, [conversationId]);

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
    setError(null);

    let draftMessageId: string | null = null;
    let receivedAssistantMessage = false;

    function removeDraftMessage() {
      if (!draftMessageId) return;
      const id = draftMessageId;
      draftMessageId = null;
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }

    function upsertDraftMessage(part: ChatReplyPart) {
      const id = draftMessageId ?? `draft:${part.turn_id || crypto.randomUUID()}`;
      draftMessageId = id;
      setMessages((prev) => {
        const existing = prev.find((m) => m.id === id);
        if (existing) {
          return prev.map((m) =>
            m.id === id
              ? { ...m, content: part.content, createdAt: new Date().toISOString(), isDraft: true }
              : m
          );
        }
        return [
          ...prev,
          {
            id,
            role: "assistant",
            content: part.content,
            createdAt: new Date().toISOString(),
            isDraft: true,
          },
        ];
      });
    }

    function appendAssistantMessage(part: ChatReplyPart) {
      if (!part.content.trim()) return;
      receivedAssistantMessage = true;
      removeDraftMessage();
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: part.content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    try {
      await streamChatMessage({
        user_id: userId,
        channel: "web",
        conversation_id: conversationId,
        message: content,
      }, (event) => {
        if (event.type === "progress") upsertDraftMessage(event.data);
        if (event.type === "message") appendAssistantMessage(event.data);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
      removeDraftMessage();
      if (!receivedAssistantMessage) {
        // Remove the optimistic user message on failure before any assistant response appears.
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      }
    } finally {
      setIsSending(false);
    }
  }

  return { messages, isSending, isLoadingHistory, error, sendMessage };
}
