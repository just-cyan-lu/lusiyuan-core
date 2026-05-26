import { prisma } from "../db/prisma.js";
import { loadPersona } from "./persona-loader.js";
import { buildChatPrompt } from "./prompt-builder.js";
import { modelProvider } from "./model-provider.js";
import { memoryService } from "./memory.service.js";
import { checkInput, sanitizeOutput } from "./safety.js";
import { toolIntentDetector } from "../tools/tool-intent-detector.js";
import { toolExecutor } from "../tools/tool-executor.js";
import { formatToolResults } from "../tools/tool-result-formatter.js";
import { isOwner } from "../tools/policy/owner-check.js";
import { env } from "../utils/env.js";
import type { ChatInput, ChatOutput } from "../types/chat.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const safety = checkInput(input.message);
  if (!safety.ok) {
    throw new Error(safety.error);
  }

  // Idempotency: skip if this external message was already processed
  if (input.external_message_id) {
    const existing = await prisma.message.findFirst({
      where: { externalMessageId: input.external_message_id },
    });
    if (existing) {
      return {
        reply: "",
        conversation_id: input.conversation_id,
        memory_written: false,
        duplicated: true,
      };
    }
  }

  // Record the raw channel event (fire-and-forget, non-blocking)
  prisma.channelEvent
    .create({
      data: {
        channel: input.channel,
        externalMessageId: input.external_message_id,
        externalUserId: input.user_id,
        payload: (input.raw_event ?? {}) as object,
        status: "received",
      },
    })
    .catch((err) => console.warn("ChannelEvent write failed:", err));

  const user = await prisma.user.upsert({
    where: { externalId: input.user_id },
    update: input.display_name ? { displayName: input.display_name } : {},
    create: {
      externalId: input.user_id,
      displayName: input.display_name,
    },
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

  const userMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: input.message,
      externalMessageId: input.external_message_id,
    },
  });

  const [persona, memories, recentMessages] = await Promise.all([
    loadPersona(),
    memoryService.retrieveRelevantMemories(user.id, input.message),
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

  const draftReply = await modelProvider.chat(messages);

  // Tool execution
  let reply = sanitizeOutput(draftReply);

  if (env.TOOLS_ENABLED) {
    const toolContext: ToolExecutionContext = {
      userId: user.id,
      channel: input.channel,
      conversationId: conversation.id,
      messageId: userMessage.id,
      isOwner: isOwner(user.id),
    };

    const intents = await toolIntentDetector
      .detect(input.message, draftReply, user.id)
      .catch((err) => {
        console.warn("ToolIntentDetector failed:", err);
        return [];
      });

    if (intents.length > 0) {
      const maxCalls = Math.min(intents.length, env.TOOL_MAX_CALLS_PER_MESSAGE);
      const results = await Promise.all(
        intents.slice(0, maxCalls).map((intent) =>
          toolExecutor.execute({
            toolName: intent.toolName,
            input: intent.input,
            context: toolContext,
          })
        )
      );

      const formatted = formatToolResults(results);
      if (formatted) {
        const augmentedMessages = buildChatPrompt({
          persona,
          memories,
          recentMessages,
          userMessage: input.message,
          toolResults: formatted,
        });
        const augmentedReply = await modelProvider.chat(augmentedMessages);
        reply = sanitizeOutput(augmentedReply);
      }
    }
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      role: "assistant",
      content: reply,
    },
  });

  return {
    reply,
    conversation_id: input.conversation_id,
    memory_written: false,
  };
}
