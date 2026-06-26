import type { Message, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";

export interface PromptHistoryMessage {
  role: string;
  content: string;
  isIntermediate?: boolean;
  metadata?: Prisma.JsonValue | null;
  createdAt?: Date;
}

const contextBatchSize = 200;
const maxContextScanMessages = 5000;

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function replyGroupId(message: Pick<Message, "metadata">): string | undefined {
  const metadata = readRecord(message.metadata);
  if (metadata.deliveryKind !== "final") return undefined;
  return stringValue(metadata.replyGroupId);
}

function promptLineLength(message: PromptHistoryMessage): number {
  return message.content.length + (message.role === "assistant" ? 5 : 4);
}

function trimContentToBudget(content: string, budget: number): string {
  if (content.length <= budget) return content;
  if (budget <= 1) return "";
  return `…${content.slice(-Math.max(0, budget - 1))}`;
}

export function compactConversationMessages(
  messages: Array<
    Pick<Message, "role" | "content" | "isIntermediate" | "metadata" | "createdAt">
  >
): PromptHistoryMessage[] {
  const compacted: PromptHistoryMessage[] = [];
  for (const message of messages) {
    if (message.isIntermediate) continue;

    const groupId = message.role === "assistant" ? replyGroupId(message) : undefined;
    const last = compacted[compacted.length - 1];
    const lastGroupId =
      last?.role === "assistant"
        ? stringValue(readRecord(last.metadata).replyGroupId)
        : undefined;

    if (groupId && last?.role === "assistant" && lastGroupId === groupId) {
      last.content = [last.content, message.content].filter(Boolean).join("\n");
      continue;
    }

    compacted.push({
      role: message.role,
      content: message.content,
      isIntermediate: message.isIntermediate,
      metadata: message.metadata,
      createdAt: message.createdAt,
    });
  }
  return compacted.filter((message) => message.content.trim().length > 0);
}

export function selectMessagesWithinCharBudget(
  messages: PromptHistoryMessage[],
  maxChars: number
): PromptHistoryMessage[] {
  const budget = Math.max(1, Math.floor(maxChars));
  const selected: PromptHistoryMessage[] = [];
  let used = 0;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    const lineLength = promptLineLength(message);
    if (used + lineLength <= budget) {
      selected.push(message);
      used += lineLength;
      continue;
    }

    if (selected.length === 0) {
      const labelLength = message.role === "assistant" ? 5 : 4;
      const contentBudget = Math.max(1, budget - labelLength);
      selected.push({
        ...message,
        content: trimContentToBudget(message.content, contentBudget),
      });
    }
    break;
  }

  return selected.reverse();
}

export async function loadRecentConversationContext(input: {
  conversationId: string;
  excludeMessageId?: string;
  maxChars: number;
}): Promise<PromptHistoryMessage[]> {
  const loaded: Message[] = [];
  let cursor: string | undefined;

  while (loaded.length < maxContextScanMessages) {
    const batch = await prisma.message.findMany({
      where: {
        conversationId: input.conversationId,
        ...(input.excludeMessageId
          ? { id: { not: input.excludeMessageId } }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(contextBatchSize, maxContextScanMessages - loaded.length),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;

    loaded.push(...batch);
    const compacted = compactConversationMessages([...loaded].reverse());
    const selected = selectMessagesWithinCharBudget(compacted, input.maxChars);
    if (selected.length > 0 && selected.length < compacted.length) {
      return selected;
    }
    cursor = batch[batch.length - 1]?.id;
    if (!cursor) break;
  }

  return selectMessagesWithinCharBudget(
    compactConversationMessages([...loaded].reverse()),
    input.maxChars
  );
}
