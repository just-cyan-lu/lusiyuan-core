export interface ChatInput {
  user_id: string;
  channel: string;
  conversation_id: string;
  message: string;
}

export interface ChatOutput {
  reply: string;
  conversation_id: string;
  memory_written: boolean;
}
