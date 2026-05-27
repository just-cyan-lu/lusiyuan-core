import { prisma } from "../db/prisma.js";
import { loadPersona } from "./persona-loader.js";
import { buildChatPrompt } from "./prompt-builder.js";
import { modelProvider } from "./model-provider.js";
import { memoryService } from "./memory.service.js";
import { checkInput, sanitizeOutput } from "./safety.js";
import { toolExecutor } from "../tools/tool-executor.js";
import { toolRegistry } from "../tools/tool-registry.js";
import { convertToolsForLLM } from "../tools/tool-converter.js";
import { isOwner } from "../tools/policy/owner-check.js";
import { env } from "../utils/env.js";
import type { ChatInput, ChatOutput } from "../types/chat.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";
import type { ChatMessage } from "../types/model.js";

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

  const availableTools = env.TOOLS_ENABLED ? toolRegistry.listEnabled() : [];

  console.log(`[chat] availableTools count: ${availableTools.length}`);

  const messages = buildChatPrompt({
    persona,
    memories,
    recentMessages,
    userMessage: input.message,
  });

  // Tool execution with function calling
  let reply = "";

  console.log("[chat] TOOLS_ENABLED:", env.TOOLS_ENABLED);

  if (env.TOOLS_ENABLED && availableTools.length > 0) {
    const toolContext: ToolExecutionContext = {
      userId: user.id,
      channel: input.channel,
      conversationId: conversation.id,
      messageId: userMessage.id,
      isOwner: isOwner(input.user_id), // use externalId (e.g. "telegram:1848918705"), not internal DB id
    };

    console.log(`[chat] externalId: ${input.user_id}, isOwner: ${toolContext.isOwner}`);

    const toolsForLLM = convertToolsForLLM(availableTools);
    const conversationMessages: ChatMessage[] = [...messages];

    // Allow up to 3 rounds of tool calls (to handle multi-step tasks)
    for (let round = 0; round < 3; round++) {
      console.log(`[chat] round ${round + 1}: calling LLM with ${toolsForLLM.length} tools`);

      const response = await modelProvider.chatWithTools(
        conversationMessages,
        toolsForLLM
      );

      // If LLM returned text (no tool calls), we're done
      if (!response.tool_calls || response.tool_calls.length === 0) {
        reply = sanitizeOutput(response.content ?? "");
        console.log("[chat] LLM returned text, no tool calls");
        break;
      }

      // LLM wants to call tools
      console.log(`[chat] LLM requested ${response.tool_calls.length} tool calls`);

      // Add assistant message with tool calls to conversation
      conversationMessages.push({
        role: "assistant",
        content: response.content ?? "",
        tool_calls: response.tool_calls,
      });

      // Execute each tool call
      console.log(`[chat] executing ${response.tool_calls.length} tool calls`);
      const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
          const toolName = toolCall.function.name;
          console.log(`[chat] tool call: ${toolName}, args: ${toolCall.function.arguments.slice(0, 200)}`);
          let input: unknown;
          try {
            input = JSON.parse(toolCall.function.arguments);
          } catch {
            input = {};
          }

          const result = await toolExecutor.execute({
            toolName,
            input,
            context: toolContext,
          });

          console.log(`[chat] tool result: ${toolName}, ok: ${result.ok}, output: ${JSON.stringify(result.ok ? result.output : result.error).slice(0, 200)}`);

          return {
            tool_call_id: toolCall.id,
            result,
          };
        })
      );

      // Add tool results to conversation
      for (const { tool_call_id, result } of toolResults) {
        conversationMessages.push({
          role: "tool",
          content: result.ok
            ? JSON.stringify(result.output)
            : `Error: ${result.error}`,
          tool_call_id,
        });
      }

      // Continue loop to let LLM respond with tool results
    }

    // If we exhausted rounds without getting a text response, ask LLM one more time without tools
    if (!reply) {
      console.log("[chat] exhausted tool rounds, final call without tools");
      const finalResponse = await modelProvider.chat(conversationMessages);
      reply = sanitizeOutput(finalResponse);
    }
  } else {
    // No tools enabled, just get a direct response
    const draftReply = await modelProvider.chat(messages);
    reply = sanitizeOutput(draftReply);
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
