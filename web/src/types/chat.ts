export interface ChatRole {
  role: "user" | "assistant";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  user_id: string;
  channel: "web";
  conversation_id: string;
  message: string;
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  memory_written?: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}
