import type { ChatInput, ChatOutput } from "../types/chat.js";

export function buildExternalMessageLookup(input: Pick<ChatInput, "channel" | "conversation_id" | "external_message_id">) {
  if (!input.external_message_id) return null;

  return {
    externalMessageId: input.external_message_id,
    conversation: {
      is: {
        channel: input.channel,
        externalConversationId: input.conversation_id,
      },
    },
  };
}

export function buildDuplicatedChatOutput(conversationId: string): ChatOutput {
  return {
    reply: "",
    conversation_id: conversationId,
    memory_written: false,
    duplicated: true,
  };
}

export function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2002"
  );
}
