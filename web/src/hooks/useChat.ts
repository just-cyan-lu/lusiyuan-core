import { useState, useEffect, useRef } from "react";
import { sendChatMessage, fetchConversationMessages } from "../api/lusiyuan-api";
import { getWebIdentity } from "../utils/storage";
import type { ChatMessage, ChatReplyPart } from "../types/chat";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function displayReplyParts(result: {
  reply: string;
  replies?: string[];
  reply_parts?: ChatReplyPart[];
  turn_id?: string;
}): ChatReplyPart[] {
  const parts = result.reply_parts?.filter((part) => part.kind !== "progress" && part.content.trim());
  if (parts && parts.length > 0) return parts;

  const replies = result.replies && result.replies.length > 0 ? result.replies : [result.reply];
  return replies
    .filter((content) => content.trim())
    .map((content, index) => ({
      turn_id: result.turn_id ?? "",
      sequence: index,
      kind: "final",
      content,
      delay_ms: index === 0 ? 0 : 600,
      transcript: true,
    }));
}

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

      const parts = displayReplyParts(result);
      for (const part of parts) {
        if (part.delay_ms > 0) await sleep(part.delay_ms);
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: part.content,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      }
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
