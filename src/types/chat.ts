import type { MessageContentPart } from "./model.js";

export interface ChatInput {
  user_id: string;
  channel: string;
  conversation_id: string;
  message: string;
  images?: MessageContentPart[];  // Optional array of image content parts

  external_message_id?: string;
  display_name?: string;
  raw_event?: unknown;
}

export interface ChatOutput {
  reply: string;
  conversation_id: string;
  memory_written: boolean;
  duplicated?: boolean;
}
