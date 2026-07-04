import type { MessageContentPart } from "./model.js";

export type ReplyPartKind = "progress" | "intermediate" | "final";

export interface ChatReplyPart {
  turn_id: string;
  message_id?: string;
  sequence: number;
  kind: ReplyPartKind;
  content: string;
  delay_ms: number;
  transcript: boolean;
}

export interface ChatVoiceOptions {
  autoplay?: boolean;
}

export interface ChatInput {
  user_id: string;
  channel: string;
  conversation_id: string;
  message: string;
  images?: MessageContentPart[];  // Optional array of image content parts
  task_id?: string;
  signal?: AbortSignal;

  external_message_id?: string;
  display_name?: string;
  raw_event?: unknown;
  voice?: ChatVoiceOptions;

  onReplyPart?: (part: ChatReplyPart) => Promise<void>;
}

export interface ChatOutput {
  reply: string;
  replies: string[];
  reply_parts: ChatReplyPart[];
  conversation_id: string;
  memory_written: boolean;
  turn_id: string;
  duplicated?: boolean;
}
