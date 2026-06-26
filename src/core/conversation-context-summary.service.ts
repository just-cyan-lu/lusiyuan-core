import type { ConversationContextSummary, Message } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { modelProvider } from "./model-provider.js";
import {
  compactConversationMessages,
  selectMessagesWithinCharBudget,
} from "./chat-context.js";
import type { ChatMessage } from "../types/model.js";

export interface PromptContextSummary {
  id: string;
  summary: string;
  fromCreatedAt: Date;
  toCreatedAt: Date;
  messageCount: number;
}

const compactMinMessages = 24;
const compactMinChars = 3000;
const compactMaxBatchMessages = 80;
const compactMaxSourceChars = 16000;
const compactMaxSummaryChars = 5000;

export async function loadConversationContextSummaries(input: {
  conversationId: string;
  maxChars: number;
}): Promise<PromptContextSummary[]> {
  if (input.maxChars <= 0) return [];

  const summaries = await prisma.conversationContextSummary.findMany({
    where: {
      conversationId: input.conversationId,
      status: "active",
    },
    orderBy: { toCreatedAt: "desc" },
    take: 40,
  });

  const selected: ConversationContextSummary[] = [];
  let used = 0;
  for (const summary of summaries) {
    const next = summary.summary.length + 80;
    if (used + next > input.maxChars) break;
    selected.push(summary);
    used += next;
  }

  return selected.reverse().map((summary) => ({
    id: summary.id,
    summary: summary.summary,
    fromCreatedAt: summary.fromCreatedAt,
    toCreatedAt: summary.toCreatedAt,
    messageCount: summary.messageCount,
  }));
}

export async function maybeCompactConversationContext(input: {
  conversationId: string;
}): Promise<void> {
  if (!runtimeConfig.CHAT_CONTEXT_COMPACT_ENABLED) return;

  const messages = await prisma.message.findMany({
    where: {
      conversationId: input.conversationId,
      isIntermediate: false,
      role: { in: ["user", "assistant"] },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 1200,
  });
  if (messages.length < compactMinMessages) return;

  const compacted = compactConversationMessages(messages);
  const recentMessages = selectMessagesWithinCharBudget(
    compacted,
    runtimeConfig.CHAT_CONTEXT_RECENT_MAX_CHARS
  );
  const recentStartAt = recentMessages[0]?.createdAt;
  if (!recentStartAt || recentMessages.length === compacted.length) return;

  const lastSummary = await prisma.conversationContextSummary.findFirst({
    where: {
      conversationId: input.conversationId,
      status: "active",
    },
    orderBy: { toCreatedAt: "desc" },
  });

  const candidates = messages.filter((message) => {
    if (message.createdAt >= recentStartAt) return false;
    if (lastSummary && message.createdAt <= lastSummary.toCreatedAt) return false;
    return message.content.trim().length > 0;
  });
  const batch = takeCompactBatch(candidates);
  if (batch.length < compactMinMessages) return;

  const sourceText = formatMessagesForSummary(batch);
  if (sourceText.length < compactMinChars) return;

  const summary = await generateCompactSummary(sourceText);
  if (!summary) return;

  const first = batch[0];
  const last = batch[batch.length - 1];
  await prisma.conversationContextSummary.upsert({
    where: {
      conversationId_toMessageId: {
        conversationId: input.conversationId,
        toMessageId: last.id,
      },
    },
    create: {
      conversationId: input.conversationId,
      fromMessageId: first.id,
      toMessageId: last.id,
      fromCreatedAt: first.createdAt,
      toCreatedAt: last.createdAt,
      messageCount: batch.length,
      summary,
      metadata: {
        compactVersion: 1,
        sourceChars: sourceText.length,
      },
    },
    update: {
      summary,
      messageCount: batch.length,
      fromMessageId: first.id,
      fromCreatedAt: first.createdAt,
      metadata: {
        compactVersion: 1,
        sourceChars: sourceText.length,
      },
    },
  });
}

function takeCompactBatch(messages: Message[]): Message[] {
  const batch: Message[] = [];
  let used = 0;
  for (const message of messages) {
    if (batch.length >= compactMaxBatchMessages) break;
    const line = formatMessageLine(message);
    if (used + line.length > compactMaxSourceChars && batch.length > 0) break;
    batch.push(message);
    used += line.length;
  }
  return batch;
}

function formatMessagesForSummary(messages: Message[]): string {
  return messages.map(formatMessageLine).join("\n");
}

function formatMessageLine(message: Pick<Message, "role" | "content" | "createdAt">): string {
  const speaker = message.role === "user" ? "用户" : "陆思源";
  return `[${message.createdAt.toISOString()}] ${speaker}: ${message.content.trim()}`;
}

async function generateCompactSummary(sourceText: string): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "你是陆思源项目的对话上下文压缩器。",
        "任务：把较早聊天压缩成后续聊天可用的上下文摘要。",
        "要求：保留事实、约定、情绪变化、关系进展、用户偏好、未完成事项；不要编造；不要写客套话；输出中文。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        "请压缩下面这段较早对话。",
        "格式：",
        "1. 关键事实/约定",
        "2. 用户偏好/禁忌",
        "3. 陆思源当时的回应方式",
        "4. 后续需要延续的上下文",
        "",
        sourceText,
      ].join("\n"),
    },
  ];

  const raw = await modelProvider.chat(messages);
  return raw.trim().slice(0, compactMaxSummaryChars);
}
