import { prisma } from "../db/prisma.js";
import { loadPersona } from "./persona-loader.js";
import { buildChatPrompt } from "./prompt-builder.js";
import { modelProvider } from "./model-provider.js";
import { memoryService } from "./memory.service.js";
import { extractMemories } from "./memory-extractor.js";
import { checkInput, sanitizeOutput } from "./safety.js";
import type { ChatInput, ChatOutput } from "../types/chat.js";

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const safety = checkInput(input.message);
  if (!safety.ok) {
    throw new Error(safety.error);
  }

  const user = await prisma.user.upsert({
    where: { externalId: input.user_id },
    update: {},
    create: { externalId: input.user_id },
  });

  let conversation = await prisma.conversation.findFirst({
    where: {
      userId: user.id,
      externalConversationId: input.conversation_id,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        channel: input.channel,
        externalConversationId: input.conversation_id,
      },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: input.message,
    },
  });

  const [persona, memories, recentMessages] = await Promise.all([
    loadPersona(),
    memoryService.searchRelevantMemories(user.id, input.message),
    prisma.message
      .findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
      .then((msgs) => msgs.reverse()),
  ]);

  const messages = buildChatPrompt({
    persona,
    memories,
    recentMessages,
    userMessage: input.message,
  });

  const rawReply = await modelProvider.chat(messages);
  const reply = sanitizeOutput(rawReply);

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: reply,
    },
  });

  // Fire-and-forget: does not block the response
  extractMemories(modelProvider, input.message, reply)
    .then((extracted) => {
      if (extracted.length > 0) {
        return memoryService.createMemories(user.id, extracted);
      }
    })
    .catch((err) => console.warn("Background memory write failed:", err));

  return {
    reply,
    conversation_id: input.conversation_id,
    memory_written: false,
  };
}
