export interface ChatRole {
  role: "user" | "assistant";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isDraft?: boolean;
}

export interface ChatRequest {
  user_id: string;
  channel: "web";
  conversation_id: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
  replies?: string[];
  reply_parts?: ChatReplyPart[];
  conversation_id: string;
  memory_written?: boolean;
  turn_id?: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatReplyPart {
  turn_id: string;
  sequence: number;
  kind: "progress" | "intermediate" | "final";
  content: string;
  delay_ms: number;
  transcript: boolean;
}

export type ChatStreamEvent =
  | { type: "ready"; data: { ok: boolean } }
  | { type: "progress"; data: ChatReplyPart }
  | { type: "message"; data: ChatReplyPart }
  | { type: "done"; data: ChatResponse }
  | { type: "error"; data: { error: string } };
