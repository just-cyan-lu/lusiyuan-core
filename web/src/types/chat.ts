export interface ChatRole {
  role: "user" | "assistant";
}

export interface ChatMessage {
  id: string;
  messageId?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatRequest {
  user_id: string;
  channel: "web";
  conversation_id: string;
  message: string;
  display_name?: string;
  voice?: {
    autoplay?: boolean;
  };
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
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface ChatReplyPart {
  turn_id: string;
  message_id?: string;
  sequence: number;
  kind: "progress" | "intermediate" | "final";
  content: string;
  delay_ms: number;
  transcript: boolean;
}

export interface VoiceStartEvent {
  message_id: string;
  cache_key: string;
  sequence: number;
  mime_type: string;
  format: "mp3";
}

export interface VoiceChunkEvent {
  message_id: string;
  cache_key: string;
  chunk_index: number;
  audio_base64: string;
}

export interface VoiceDoneEvent {
  message_id: string;
  cache_key: string;
  audio_url: string;
  mime_type: string;
  byte_size: number;
  duration_ms?: number;
  cached: boolean;
}

export interface VoiceErrorEvent {
  message_id?: string;
  error: string;
}

export type VoiceStreamEvent =
  | { type: "voice_start"; data: VoiceStartEvent }
  | { type: "voice_chunk"; data: VoiceChunkEvent }
  | { type: "voice_done"; data: VoiceDoneEvent }
  | { type: "voice_error"; data: VoiceErrorEvent };

export type ChatStreamEvent =
  | { type: "ready"; data: { ok: boolean; task_id?: string } }
  | { type: "progress"; data: ChatReplyPart }
  | { type: "message"; data: ChatReplyPart }
  | { type: "done"; data: ChatResponse }
  | { type: "cancelled"; data: { task_id?: string; reason?: string } }
  | { type: "error"; data: { error: string } }
  | VoiceStreamEvent;
