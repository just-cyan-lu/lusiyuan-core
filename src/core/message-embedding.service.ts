import type { Message } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { createMemoryContentHash } from "../embeddings/content-hash.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import { upsertMessageEmbedding } from "../vector-index/pgvector-message-index.js";
import { useAsChatContext } from "./chat-context.js";

const maxEmbeddingTextChars = 6000;

export function shouldIndexMessageForRecall(
  message: Pick<Message, "role" | "content" | "isIntermediate"> & { metadata?: unknown }
): boolean {
  if (message.isIntermediate) return false;
  if (!useAsChatContext(message.metadata)) return false;
  if (message.role !== "user" && message.role !== "assistant") return false;
  return message.content.trim().length > 0;
}

export function buildMessageEmbeddingText(message: Pick<Message, "role" | "content">): string {
  const speaker = message.role === "user" ? "用户" : "陆思源";
  return `${speaker}: ${message.content.trim()}`.slice(0, maxEmbeddingTextChars);
}

export async function generateAndStoreMessageEmbedding(message: Message): Promise<void> {
  if (!shouldIndexMessageForRecall(message)) return;

  const text = buildMessageEmbeddingText(message);
  const contentHash = createMemoryContentHash(text);
  const existing = await prisma.messageEmbedding.findUnique({
    where: {
      messageId_provider_model_dimensions: {
        messageId: message.id,
        provider: embeddingProvider.providerName,
        model: embeddingProvider.model,
        dimensions: embeddingProvider.dimensions,
      },
    },
    select: { contentHash: true },
  });

  if (existing?.contentHash === contentHash) return;

  const embedding = await embeddingProvider.embedText(text);
  await upsertMessageEmbedding({
    messageId: message.id,
    conversationId: message.conversationId,
    embedding,
    provider: embeddingProvider.providerName,
    model: embeddingProvider.model,
    dimensions: embeddingProvider.dimensions,
    contentHash,
  });
}

export async function indexMessagesForRecall(messages: Message[]): Promise<void> {
  for (const message of messages) {
    await generateAndStoreMessageEmbedding(message);
  }
}
