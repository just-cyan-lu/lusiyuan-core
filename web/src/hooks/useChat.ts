import { useState, useEffect, useRef } from "react";
import { sendChatMessage, fetchConversationMessages } from "../api/lusiyuan-api";
import { getWebIdentity } from "../utils/storage";
import type { ChatMessage } from "../types/chat";

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

    try {
      const result = await sendChatMessage({
        user_id: userId,
        channel: "web",
        conversation_id: conversationId,
        message: content,
      });

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.reply,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败，请稍后重试");
      // Remove the optimistic user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsSending(false);
    }
  }

  return { messages, isSending, isLoadingHistory, error, sendMessage };
}
