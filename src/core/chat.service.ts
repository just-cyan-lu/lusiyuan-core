import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { loadPersona } from "./persona-loader.js";
import { loadOwnerProfile } from "./owner-profile-loader.js";
import { buildChatPrompt } from "./prompt-builder.js";
import { modelProvider } from "./model-provider.js";
import { memoryService } from "./memory.service.js";
import {
  loadPromptConversationContext,
  maintainConversationContext,
} from "./conversation-context.service.js";
import { checkInput, sanitizeOutput } from "./safety.js";
import { toolExecutor } from "../tools/tool-executor.js";
import { toolRegistry } from "../tools/tool-registry.js";
import { convertToolsForLLM } from "../tools/tool-converter.js";
import { isOwner } from "../tools/policy/owner-check.js";
import { runtimeStateService } from "../runtime/runtime-state.service.js";
import { relationshipStateService } from "../runtime/relationship-state.service.js";
import {
  isTaskCancellationError,
  runningTaskRegistry,
  TaskCancelledError,
  throwIfTaskCancelled,
} from "../runtime/running-task-registry.js";
import {
  buildDuplicatedChatOutput,
  buildExternalMessageLookup,
  isPrismaUniqueConstraintError,
} from "./chat-idempotency.js";
import {
  getReplySegmentationOptions,
  replySegmentDelay,
  segmentReply,
  shouldDeliverIntermediateMessages,
} from "./reply-segmentation.service.js";
import type { ChatInput, ChatOutput, ChatReplyPart } from "../types/chat.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";
import type { ChatMessage, MessageContentPart } from "../types/model.js";
import type { Message } from "@prisma/client";

async function storeAndEmitIntermediateMessage(input: {
  chatInput: ChatInput;
  conversationId: string;
  turnId: string;
  sequence: number;
  content: string;
  delayMs: number;
  source: string;
}): Promise<ChatReplyPart | null> {
  const content = input.content.trim();
  if (!content) return null;

  await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: "assistant",
      content,
      isIntermediate: true,
      metadata: {
        turnId: input.turnId,
        deliveryKind: "intermediate",
        sequence: input.sequence,
        source: input.source,
      },
    },
  });

  const part: ChatReplyPart = {
    turn_id: input.turnId,
    sequence: input.sequence,
    kind: "intermediate",
    content,
    delay_ms: input.delayMs,
    transcript: true,
  };

  if (input.chatInput.onReplyPart) {
    await input.chatInput.onReplyPart(part);
    return part;
  }
  if (input.chatInput.onIntermediateMessage) {
    await input.chatInput.onIntermediateMessage(content, input.delayMs);
  }
  return part;
}

async function emitProgressDraft(input: {
  chatInput: ChatInput;
  turnId: string;
  sequence: number;
}): Promise<ChatReplyPart | null> {
  if (!input.chatInput.onReplyPart) {
    return null;
  }

  const part: ChatReplyPart = {
    turn_id: input.turnId,
    sequence: input.sequence,
    kind: "progress",
    content: "typing",
    delay_ms: 0,
    transcript: false,
  };

  await input.chatInput.onReplyPart(part);
  return part;
}

export async function runChatTask(input: ChatInput): Promise<ChatOutput> {
  const handle = runningTaskRegistry.start({
    kind: "chat",
    label: `${input.channel} chat`,
    source: input.channel,
    channel: input.channel,
    userId: input.user_id,
    conversationId: input.conversation_id,
  });

  try {
    return await chat({
      ...input,
      task_id: handle.id,
      signal: handle.signal,
    });
  } catch (err) {
    if (isTaskCancellationError(err, handle.signal)) {
      throw new TaskCancelledError("Chat task cancelled");
    }
    throw err;
  } finally {
    handle.finish();
  }
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const signal = input.signal;
  const checkCancelled = () => throwIfTaskCancelled(signal);
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

  const owner = isOwner(input.user_id);
  const turnId = input.task_id ?? randomUUID();
  let replySequence = 0;
  const replyParts: ChatReplyPart[] = [];
  const deliveryOptions = getReplySegmentationOptions();
  const deliverIntermediate = shouldDeliverIntermediateMessages(deliveryOptions.mode);
  async function progress(): Promise<void> {
    if (!input.onReplyPart) return;
    const part = await emitProgressDraft({
      chatInput: input,
      turnId,
      sequence: replySequence,
    });
    if (part) replySequence++;
  }

  let userMessage: Message;
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

  checkCancelled();

  const relationshipRecord = await relationshipStateService.getOrCreate(user.id);

  const [persona, ownerProfile, memories, conversationContext, runtimeState, relationshipState] = await Promise.all([
    loadPersona(),
    owner ? loadOwnerProfile() : Promise.resolve(""),
    memoryService.retrieveRelevantMemories({
      personId: relationshipRecord.personId,
      query: input.message,
      channel: input.channel,
      conversationId: conversation.id,
    }),
    loadPromptConversationContext({
      userId: user.id,
      conversationId: conversation.id,
      query: input.message,
      excludeMessageId: userMessage.id,
    }),
    runtimeStateService
      .formatForPrompt()
      .catch((err) => {
        console.warn("[chat] runtime state unavailable:", err);
        return undefined;
      }),
    relationshipStateService
      .formatForPrompt(user.id)
      .catch((err) => {
        console.warn("[chat] relationship state unavailable:", err);
        return undefined;
      }),
  ]);
  checkCancelled();

  const availableTools = toolRegistry.listEnabled();

  console.log(`[chat] availableTools count: ${availableTools.length}`);

  const messages = buildChatPrompt({
    persona,
    memories,
    recentMessages: conversationContext.recentMessages,
    contextSummaries: conversationContext.summaries,
    recallWindows: conversationContext.recallWindows,
    userMessage: input.message,
    channel: input.channel,
    runtimeState,
    relationshipState,
    ownerProfile: ownerProfile || undefined,
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

  checkCancelled();
  await progress();
  checkCancelled();

  if (availableTools.length > 0) {
    const toolContext: ToolExecutionContext = {
      userId: user.id,
      channel: input.channel,
      conversationId: conversation.id,
      messageId: userMessage.id,
      isOwner: owner, // use externalId (e.g. "telegram:1848918705"), not internal DB id
      signal,
    };

    console.log(`[chat] externalId: ${input.user_id}, isOwner: ${toolContext.isOwner}`);

    const toolsForLLM = convertToolsForLLM(availableTools);
    const conversationMessages: ChatMessage[] = [...messages];

    // Allow multiple tool rounds to handle multi-step tasks until the model stops requesting tools.
    for (let round = 0; ; round++) {
      checkCancelled();
      console.log(`[chat] round ${round + 1}: calling LLM with ${toolsForLLM.length} tools`);

      const response = await modelProvider.chatWithTools(
        conversationMessages,
        toolsForLLM,
        { signal }
      );
      checkCancelled();

      // If LLM returned text (no tool calls), we're done
      if (!response.tool_calls || response.tool_calls.length === 0) {
        reply = sanitizeOutput(response.content ?? "");
        console.log("[chat] LLM returned text, no tool calls");
        break;
      }

      // LLM wants to call tools
      console.log(`[chat] LLM requested ${response.tool_calls.length} tool calls`);
      await progress();
      checkCancelled();

      // If LLM returned text alongside tool calls, send it as an intermediate message.
      // This is the primary multi-message mechanism: the LLM naturally writes its
      // immediate reaction in the content field before issuing tool calls.
      if (deliverIntermediate && response.content && response.content.trim().length > 0) {
        console.log(`[chat] LLM returned content with tool calls, sending as intermediate message`);
        const delay = replySegmentDelay(replySequence, response.content, deliveryOptions);
        try {
          const part = await storeAndEmitIntermediateMessage({
            chatInput: input,
            conversationId: conversation.id,
            turnId,
            sequence: replySequence++,
            content: response.content,
            delayMs: delay,
            source: "content_with_tool_calls",
          });
          if (part) replyParts.push(part);
        } catch (err) {
          if (isTaskCancellationError(err, signal)) throw err;
          console.error("[chat] failed to send intermediate message:", err);
        }
      }

      // Some providers return only hidden thinking before tool calls. In that
      // case, ask for a short visible reaction so the chat feels responsive.
      if (deliverIntermediate &&
          (!modelProvider.capabilities.supportsContentWithToolCalls ||
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
          const reactionResponse = await modelProvider.chat(reactionPrompt, { signal });
          checkCancelled();
          const reaction = reactionResponse.trim();

          if (reaction.length > 0 && reaction.length < 100) {
            console.log(`[chat] got immediate reaction: ${reaction}`);
            const delay = replySegmentDelay(replySequence, reaction, deliveryOptions);
            try {
              const part = await storeAndEmitIntermediateMessage({
                chatInput: input,
                conversationId: conversation.id,
                turnId,
                sequence: replySequence++,
                content: reaction,
                delayMs: delay,
                source: "tool_reaction_fallback",
              });
              if (part) replyParts.push(part);
            } catch (err) {
              if (isTaskCancellationError(err, signal)) throw err;
              console.error("[chat] failed to send immediate reaction:", err);
            }
          }
        } catch (err) {
          if (isTaskCancellationError(err, signal)) throw err;
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
      const toolResults: Array<{ tool_call_id: string; result: Awaited<ReturnType<typeof toolExecutor.execute>> }> = [];
      for (const toolCall of response.tool_calls) {
        checkCancelled();
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
          signal,
        });
        checkCancelled();

        console.log(`[chat] tool result: ${toolName}, ok: ${result.ok}, output: ${JSON.stringify(result.ok ? result.output : result.error).slice(0, 200)}`);

        toolResults.push({
          tool_call_id: toolCall.id,
          result,
        });
      }
      await progress();
      checkCancelled();

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
      checkCancelled();
      console.log("[chat] exhausted tool rounds, final call without tools");
      const finalResponse = await modelProvider.chat(conversationMessages, { signal });
      checkCancelled();
      reply = sanitizeOutput(finalResponse);
    }
  } else {
    // No tool is available for this context, so use a direct response.
    checkCancelled();
    const draftReply = await modelProvider.chat(messages, { signal });
    checkCancelled();
    reply = sanitizeOutput(draftReply);
  }

  await progress();
  checkCancelled();
  const segmentation = await segmentReply(reply, deliveryOptions, { signal });
  checkCancelled();
  const finalReplies = segmentation.replies.length > 0 ? segmentation.replies : [reply];
  const replyGroupId = randomUUID();
  const finalParts: ChatReplyPart[] = finalReplies.map((content, index) => ({
    turn_id: turnId,
    sequence: replySequence + index,
    kind: "final",
    content,
    delay_ms: replySegmentDelay(index, content, deliveryOptions),
    transcript: true,
  }));
  const assistantMessages: Message[] = [];

  for (const [index, part] of finalParts.entries()) {
    checkCancelled();
    assistantMessages.push(await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: part.content,
        metadata: {
          turnId,
          replyGroupId,
          deliveryKind: "final",
          sequence: part.sequence,
          segmentIndex: index,
          segmentTotal: finalParts.length,
          delayMs: part.delay_ms,
          segmentationSource: segmentation.source,
        },
      },
    }));
  }

  const assistantMessage = assistantMessages[0];
  maintainConversationContext({
    conversationId: conversation.id,
    messagesToIndex: [userMessage, ...assistantMessages],
  });
  if (!assistantMessage) {
    throw new Error("Assistant reply was not recorded");
  }

  relationshipStateService
    .observeChatTurn({
      userId: user.id,
      conversationId: conversation.id,
      messageId: assistantMessage.id,
      channel: input.channel,
      userMessage: input.message,
      assistantReply: reply,
      isOwner: owner,
    })
    .catch((err) => console.warn("[chat] relationship state update failed:", err));

  relationshipStateService
    .observeIdentitySignals({
      userId: user.id,
      conversationId: conversation.id,
      messageId: userMessage.id,
      channel: input.channel,
      userMessage: input.message,
      displayName: input.display_name,
    })
    .catch((err) => console.warn("[chat] identity proposal update failed:", err));

  return {
    reply,
    replies: finalReplies,
    reply_parts: [...replyParts, ...finalParts],
    conversation_id: input.conversation_id,
    memory_written: false,
    turn_id: turnId,
  };
}
