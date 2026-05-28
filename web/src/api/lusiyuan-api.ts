import type { ChatRequest, ChatResponse, ConversationMessage } from "../types/chat";

const API_BASE_URL = import.meta.env.VITE_LUSIYUAN_API_BASE_URL ?? "http://localhost:64100";

export async function sendChatMessage(input: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "发送失败");
  }

  return response.json() as Promise<ChatResponse>;
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/conversations/${encodeURIComponent(conversationId)}/messages`
  );

  if (!response.ok) return [];

  const data = (await response.json()) as { messages: ConversationMessage[] };
  return data.messages ?? [];
}
