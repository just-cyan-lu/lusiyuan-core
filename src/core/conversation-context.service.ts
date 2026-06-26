import type { Message } from "@prisma/client";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import {
  estimatePromptMessagesChars,
  loadRecentConversationContext,
  type PromptHistoryMessage,
} from "./chat-context.js";
import {
  loadConversationContextSummaries,
  maybeCompactConversationContext,
  type PromptContextSummary,
} from "./conversation-context-summary.service.js";
import {
  retrieveConversationRecallWindows,
  type ConversationRecallWindow,
} from "./conversation-recall.service.js";
import { indexMessagesForRecall } from "./message-embedding.service.js";

export interface PromptConversationContext {
  summaries: PromptContextSummary[];
  recallWindows: ConversationRecallWindow[];
  recentMessages: PromptHistoryMessage[];
}

export async function loadPromptConversationContext(input: {
  userId: string;
  conversationId: string;
  query: string;
  excludeMessageId?: string;
}): Promise<PromptConversationContext> {
  const maxChars = Math.max(1, runtimeConfig.CHAT_CONTEXT_MAX_CHARS);
  const recentMaxChars = Math.min(
    runtimeConfig.CHAT_CONTEXT_RECENT_MAX_CHARS,
    maxChars
  );
  const recentMessages = await loadRecentConversationContext({
    conversationId: input.conversationId,
    excludeMessageId: input.excludeMessageId,
    maxChars: recentMaxChars,
  });

  let remainingChars = Math.max(
    0,
    maxChars - estimatePromptMessagesChars(recentMessages)
  );
  const summaries = await loadConversationContextSummaries({
    conversationId: input.conversationId,
    maxChars: Math.min(runtimeConfig.CHAT_CONTEXT_SUMMARY_MAX_CHARS, remainingChars),
  });
  remainingChars = Math.max(
    0,
    remainingChars - estimateSummariesChars(summaries)
  );

  const excludedMessageIds = collectSourceMessageIds(recentMessages);
  const recallWindows = await retrieveConversationRecallWindows({
    userId: input.userId,
    query: input.query,
    excludedMessageIds,
    maxChars: Math.min(runtimeConfig.CHAT_CONTEXT_RECALL_MAX_CHARS, remainingChars),
  }).catch((err) => {
    console.warn("[chat-context] recall unavailable:", err);
    return [];
  });

  return {
    summaries,
    recallWindows,
    recentMessages,
  };
}

export function maintainConversationContext(input: {
  conversationId: string;
  messagesToIndex: Message[];
}): void {
  indexMessagesForRecall(input.messagesToIndex).catch((err) =>
    console.warn("[chat-context] message embedding update failed:", err)
  );
  maybeCompactConversationContext({ conversationId: input.conversationId }).catch((err) =>
    console.warn("[chat-context] compact update failed:", err)
  );
}

function estimateSummariesChars(summaries: PromptContextSummary[]): number {
  return summaries.reduce((sum, summary) => sum + summary.summary.length + 80, 0);
}

function collectSourceMessageIds(messages: PromptHistoryMessage[]): Set<string> {
  const ids = new Set<string>();
  for (const message of messages) {
    for (const id of message.sourceMessageIds ?? (message.id ? [message.id] : [])) {
      ids.add(id);
    }
  }
  return ids;
}
