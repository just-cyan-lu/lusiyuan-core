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
import {
  buildDuplicatedChatOutput,
  buildExternalMessageLookup,
  isPrismaUniqueConstraintError,
} from "./chat-idempotency.js";
import type { ChatInput, ChatOutput } from "../types/chat.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";
import type { ChatMessage, MessageContentPart } from "../types/model.js";

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const safety = checkInput(input.message);
  if (!safety.ok) {
    throw new Error(safety.error);
  }

  // Idempotency: skip if this external message was already processed
  const externalMessageLookup = buildExternalMessageLookup(input);
  if (externalMessageLookup) {
    const existing = await prisma.message.findFirst({
      where: externalMessageLookup,
    });
    if (existing) {
      return buildDuplicatedChatOutput(input.conversation_id);
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

  let userMessage: { id: string };
  try {
    userMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: input.message,
        externalMessageId: input.external_message_id,
      },
    });
  } catch (err) {
    if (input.external_message_id && isPrismaUniqueConstraintError(err)) {
      return buildDuplicatedChatOutput(input.conversation_id);
    }
    throw err;
  }

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
    channel: input.channel,
  });

  // If user sent images, append them to the last user message
  if (input.images && input.images.length > 0) {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === "user") {
      // Convert string content to multimodal array
      const textPart: MessageContentPart = { type: "text", text: typeof lastMessage.content === "string" ? lastMessage.content : "" };
      lastMessage.content = [textPart, ...input.images];
    }
  }

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

    // Allow a bounded number of tool rounds to handle multi-step tasks.
    for (let round = 0; round < env.TOOL_MAX_CALLS_PER_MESSAGE; round++) {
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

      // If LLM returned text alongside tool calls, send it as an intermediate message.
      // This is the primary multi-message mechanism: the LLM naturally writes its
      // immediate reaction in the content field before issuing tool calls.
      if (response.content && response.content.trim().length > 0) {
        console.log(`[chat] LLM returned content with tool calls, sending as intermediate message`);
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: response.content,
            isIntermediate: true,
          },
        });
        if (input.onIntermediateMessage) {
          const delay = Math.floor(Math.random() * 400) + 100;
          try {
            await input.onIntermediateMessage(response.content, delay);
          } catch (err) {
            console.error("[chat] failed to send intermediate message:", err);
          }
        }
      }

      // Some providers return only hidden thinking before tool calls. In that
      // case, ask for a short visible reaction so the chat feels responsive.
      if ((!modelProvider.capabilities.supportsContentWithToolCalls ||
          modelProvider.capabilities.requestsToolReactionFallback) &&
          (!response.content || response.content.trim().length === 0)) {
        console.log(`[chat] provider returned no visible tool-call content, requesting immediate reaction`);

        // Build a focused prompt to get a short immediate reaction
        const reactionPrompt: ChatMessage[] = [
          ...conversationMessages,
          {
            role: "assistant",
            content: `[内部指令] 你即将调用工具 ${response.tool_calls.map(tc => tc.function.name).join(", ")}。在调用工具之前，请用1句话表达你的即时反应（如"我去看看"、"稍等，我查一下"等），让对话更自然。只输出这1句话，不要解释。`,
          },
        ];

        try {
          const reactionResponse = await modelProvider.chat(reactionPrompt);
          const reaction = reactionResponse.trim();

          if (reaction.length > 0 && reaction.length < 100) {
            console.log(`[chat] got immediate reaction: ${reaction}`);
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "assistant",
                content: reaction,
                isIntermediate: true,
              },
            });
            if (input.onIntermediateMessage) {
              const delay = Math.floor(Math.random() * 400) + 100;
              try {
                await input.onIntermediateMessage(reaction, delay);
              } catch (err) {
                console.error("[chat] failed to send immediate reaction:", err);
              }
            }
          }
        } catch (err) {
          console.warn("[chat] failed to get immediate reaction:", err);
          // Continue with tool execution even if reaction fails
        }
      }

      // Add assistant message with tool calls to conversation
      conversationMessages.push({
        role: "assistant",
        content: response.rawContent ?? response.content ?? "",
        tool_calls: response.tool_calls,
        providerMetadata: response.providerMetadata,
      });

      // Execute each tool call
      console.log(`[chat] executing ${response.tool_calls.length} tool calls`);
      const toolResults = await Promise.all(
        response.tool_calls.map(async (toolCall) => {
          const toolName = toolCall.function.name;
          console.log(`[chat] tool call: ${toolName}, args: ${toolCall.function.arguments.slice(0, 200)}`);
          let toolInput: unknown;
          try {
            toolInput = JSON.parse(toolCall.function.arguments);
          } catch {
            toolInput = {};
          }

          const result = await toolExecutor.execute({
            toolName,
            input: toolInput,
            context: toolContext,
          });

          console.log(`[chat] tool result: ${toolName}, ok: ${result.ok}, output: ${JSON.stringify(result.ok ? result.output : result.error).slice(0, 200)}`);

          // Handle send_intermediate_message tool specially
          if (toolName === "send_intermediate_message" && result.ok && result.output) {
            const output = result.output as { content: string; delay_ms: number; is_intermediate: boolean };

            // Store intermediate message in database
            await prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "assistant",
                content: output.content,
                isIntermediate: true,
              },
            });

            // Send via callback if provided
            if (input.onIntermediateMessage) {
              try {
                await input.onIntermediateMessage(output.content, output.delay_ms);
                console.log(`[chat] sent intermediate message: ${output.content.slice(0, 50)}`);
              } catch (err) {
                console.error("[chat] failed to send intermediate message:", err);
              }
            }
          }

          return {
            tool_call_id: toolCall.id,
            result,
          };
        })
      );

      // Add tool results to conversation
      for (const { tool_call_id, result } of toolResults) {
        let content: ChatMessage["content"];

        if (result.ok && result.output && typeof result.output === "object" && "screenshotBase64" in result.output && result.output.screenshotBase64) {
          // Tool returned a screenshot — build multimodal content
          const { screenshotBase64, ...outputWithoutScreenshot } = result.output as Record<string, unknown>;
          const parts: MessageContentPart[] = [
            { type: "text", text: JSON.stringify(outputWithoutScreenshot) },
            {
              type: "image",
              image: {
                data: screenshotBase64 as string,
                mimeType: "image/png",
              },
            },
          ];
          content = parts;
        } else {
          content = result.ok
            ? JSON.stringify(result.output)
            : `Error: ${result.error}`;
        }

        conversationMessages.push({ role: "tool", content, tool_call_id });
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
