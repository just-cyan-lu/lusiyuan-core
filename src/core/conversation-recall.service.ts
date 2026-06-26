import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { searchSimilarMessages } from "../vector-index/pgvector-message-index.js";
import {
  compactConversationMessages,
  estimatePromptMessagesChars,
  selectMessagesWithinCharBudget,
  type PromptHistoryMessage,
} from "./chat-context.js";
import type { Message } from "@prisma/client";

export interface ConversationRecallWindow {
  hitMessageId: string;
  conversationId: string;
  externalConversationId?: string;
  channel?: string;
  score: number;
  messages: PromptHistoryMessage[];
}

const recallSearchCandidates = 16;
const recallWindowMessages = 8;

export async function retrieveConversationRecallWindows(input: {
  userId: string;
  query: string;
  excludedMessageIds: Set<string>;
  maxChars: number;
}): Promise<ConversationRecallWindow[]> {
  if (!runtimeConfig.CHAT_CONTEXT_RECALL_ENABLED || input.maxChars <= 0) {
    return [];
  }

  const query = input.query.trim();
  if (!query) return [];

  const queryEmbedding = await embeddingProvider.embedText(query.slice(0, 6000));
  const matches = await searchSimilarMessages({
    queryEmbedding,
    userId: input.userId,
    provider: embeddingProvider.providerName,
    model: embeddingProvider.model,
    dimensions: embeddingProvider.dimensions,
    topK: recallSearchCandidates,
  });

  const windows: ConversationRecallWindow[] = [];
  const seenWindowKeys = new Set<string>();
  let usedChars = 0;

  for (const match of matches) {
    if (windows.length >= 4) break;
    if (input.excludedMessageIds.has(match.messageId)) continue;

    const remaining = input.maxChars - usedChars;
    if (remaining <= 0) break;

    const window = await loadRecallWindow(match, remaining);
    if (!window) continue;

    const sourceIds = sourceMessageIds(window.messages);
    if (sourceIds.length === 0) continue;
    if (sourceIds.every((id) => input.excludedMessageIds.has(id))) continue;

    const key = sourceIds.join(",");
    if (seenWindowKeys.has(key)) continue;
    seenWindowKeys.add(key);

    windows.push(window);
    usedChars += estimatePromptMessagesChars(window.messages);
  }

  return windows;
}

async function loadRecallWindow(
  match: { messageId: string; conversationId: string; score: number },
  maxChars: number
): Promise<ConversationRecallWindow | null> {
  const hit = await prisma.message.findUnique({
    where: { id: match.messageId },
    include: {
      conversation: {
        select: { externalConversationId: true, channel: true },
      },
    },
  });
  if (!hit) return null;

  const beforeTake = Math.ceil(recallWindowMessages / 2);
  const afterTake = Math.max(0, recallWindowMessages - beforeTake);
  const [before, after] = await Promise.all([
    prisma.message.findMany({
      where: recallWindowWhere(match.conversationId, { lte: hit.createdAt }),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: beforeTake,
    }),
    prisma.message.findMany({
      where: recallWindowWhere(match.conversationId, { gt: hit.createdAt }),
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: afterTake,
    }),
  ]);

  const chronological = [...before.reverse(), ...after];
  const messages = selectMessagesWithinCharBudget(
    compactConversationMessages(chronological),
    maxChars
  );
  if (messages.length === 0) return null;

  return {
    hitMessageId: match.messageId,
    conversationId: match.conversationId,
    externalConversationId: hit.conversation.externalConversationId,
    channel: hit.conversation.channel,
    score: match.score,
    messages,
  };
}

function recallWindowWhere(
  conversationId: string,
  createdAt: { lte: Date } | { gt: Date }
) {
  return {
    conversationId,
    isIntermediate: false,
    role: { in: ["user", "assistant"] },
    content: { not: "" },
    createdAt,
  };
}

function sourceMessageIds(messages: PromptHistoryMessage[]): string[] {
  const ids: string[] = [];
  for (const message of messages) {
    ids.push(...(message.sourceMessageIds ?? (message.id ? [message.id] : [])));
  }
  return [...new Set(ids)];
}
