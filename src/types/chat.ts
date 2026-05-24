export interface ChatInput {
  user_id: string;
  channel: string;
  conversation_id: string;
  message: string;

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
