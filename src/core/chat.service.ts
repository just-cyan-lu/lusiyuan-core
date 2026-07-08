import { randomUUID } from "node:crypto";
import { prisma } from "../db/prisma.js";
import { loadPersona } from "./persona-loader.js";
import { loadOwnerProfile } from "./owner-profile-loader.js";
import { buildChatPrompt } from "./prompt-builder.js";
import { modelProvider } from "./model-provider.js";
import { memoryService } from "./memory.service.js";
import { embeddingProvider } from "../embeddings/siliconflow-embedding-provider.js";
import {
  loadPromptConversationContext,
  maintainConversationContext,
} from "./conversation-context.service.js";
import { checkInput, sanitizeOutput } from "./safety.js";
import { toolExecutor } from "../tools/tool-executor.js";
import { toolRegistry } from "../tools/tool-registry.js";
import { convertToolsForLLM } from "../tools/tool-converter.js";
import { selectToolsForChat, toolProgressContent } from "../tools/tool-router.js";
import { isOwner } from "../tools/policy/owner-check.js";
import { runtimeStateService } from "../runtime/runtime-state.service.js";
import { relationshipStateService } from "../runtime/relationship-state.service.js";
import { identityBindingService } from "../runtime/identity-binding.service.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
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
} from "./reply-segmentation.service.js";
import {
  EXPRESSION_LEARNING_REPLY_RETRIEVAL_LIMIT,
  formatExpressionLearningExamples,
  retrieveExpressionLearningExamples,
} from "../expression-learning/expression-learning.service.js";
import type { ChatInput, ChatOutput, ChatReplyPart } from "../types/chat.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";
import type { ChatMessage, MessageContentPart } from "../types/model.js";
import type { Message } from "@prisma/client";

function createChatTrace(input: {
  turnId: string;
  channel: string;
  userId: string;
  conversationId: string;
}) {
  const startedAt = Date.now();
  let previousAt = startedAt;
  const base = `turn=${input.turnId} channel=${input.channel} user=${input.userId} conversation=${input.conversationId}`;

  return {
    mark(stage: string, extra?: Record<string, unknown>) {
      const now = Date.now();
      const stepMs = now - previousAt;
      const totalMs = now - startedAt;
      previousAt = now;
      const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
      console.info(`[chat:trace] ${base} stage=${stage} step=${stepMs}ms total=${totalMs}ms${suffix}`);
    },
    async time<T>(stage: string, fn: () => Promise<T>, extra?: Record<string, unknown>): Promise<T> {
      const stageStartedAt = Date.now();
      try {
        return await fn();
      } finally {
        const now = Date.now();
        const stageMs = now - stageStartedAt;
        const stepMs = now - previousAt;
        const totalMs = now - startedAt;
        previousAt = now;
        const suffix = extra ? ` ${JSON.stringify(extra)}` : "";
        console.info(`[chat:trace] ${base} stage=${stage} stageMs=${stageMs}ms step=${stepMs}ms total=${totalMs}ms${suffix}`);
      }
    },
  };
}

function expressionLearningSceneForChat(_channel: string): string {
  return "chat";
}

async function emitProgressDraft(input: {
  chatInput: ChatInput;
  turnId: string;
  sequence: number;
  content?: string;
}): Promise<ChatReplyPart | null> {
  if (!input.chatInput.onReplyPart) {
    return null;
  }

  const part: ChatReplyPart = {
    turn_id: input.turnId,
    sequence: input.sequence,
    kind: "progress",
    content: input.content ?? "typing",
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
  const trace = createChatTrace({
    turnId,
    channel: input.channel,
    userId: input.user_id,
    conversationId: input.conversation_id,
  });
  let replySequence = 0;
  const replyParts: ChatReplyPart[] = [];
  const deliveryOptions = getReplySegmentationOptions();
  async function progress(content = "typing"): Promise<void> {
    if (!input.onReplyPart) return;
    const part = await emitProgressDraft({
      chatInput: input,
      turnId,
      sequence: replySequence,
      content,
    });
    if (part) replySequence++;
  }
  trace.mark("received");

  let userMessage: Message;
  try {
    userMessage = await trace.time("store_user_message", () =>
      prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: input.message,
          externalMessageId: input.external_message_id,
        },
      })
    );
  } catch (err) {
    if (input.external_message_id && isPrismaUniqueConstraintError(err)) {
      return buildDuplicatedChatOutput(input.conversation_id);
    }
    throw err;
  }

  checkCancelled();

  const relationshipRecord = await trace.time("relationship_get_or_create", () =>
    relationshipStateService.getOrCreate(user.id)
  );
  let sharedQueryEmbedding: Promise<number[]> | undefined;
  const getSharedQueryEmbedding = () => {
    sharedQueryEmbedding ??= trace.time("query_embedding", () =>
      embeddingProvider.embedText(input.message)
    );
    return sharedQueryEmbedding;
  };
  const expressionLearningScene = expressionLearningSceneForChat(input.channel);
  let reply = "";

  const identityBindingAction = await trace.time("identity_binding", () =>
    identityBindingService.handleChatMessage({
      userId: user.id,
      channel: input.channel,
      conversationId: conversation.id,
      messageId: userMessage.id,
      userMessage: input.message,
    })
  );
  if (identityBindingAction) {
    reply = sanitizeOutput(identityBindingAction.reply);
    trace.mark("identity_binding_direct_reply", {
      type: identityBindingAction.type,
      code: identityBindingAction.code,
    });
  }

  if (!reply) {
    const [
      persona,
      ownerProfile,
      memories,
      conversationContext,
      runtimeState,
      relationshipState,
      expressionLearningExamples,
    ] = await trace.time(
      "prepare_prompt_materials",
      () =>
        Promise.all([
          loadPersona(),
          owner ? loadOwnerProfile() : Promise.resolve(""),
          memoryService.retrieveRelevantMemories({
            personId: relationshipRecord.personId,
            query: input.message,
            queryEmbedding: runtimeConfig.MEMORY_RETRIEVAL_ENABLED
              ? getSharedQueryEmbedding()
              : undefined,
          }),
          loadPromptConversationContext({
            userId: user.id,
            conversationId: conversation.id,
            query: input.message,
            queryEmbedding: runtimeConfig.CHAT_CONTEXT_RECALL_ENABLED
              ? getSharedQueryEmbedding()
              : undefined,
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
          retrieveExpressionLearningExamples({
            scene: expressionLearningScene,
            query: input.message,
            queryEmbedding: getSharedQueryEmbedding,
            limit: EXPRESSION_LEARNING_REPLY_RETRIEVAL_LIMIT,
          }).catch((err) => {
            console.warn("[chat] expression learning unavailable:", err);
            return [];
          }),
        ])
    );
    checkCancelled();

    trace.mark("prompt_materials_ready", {
      memories: memories.length,
      recentMessages: conversationContext.recentMessages.length,
      summaries: conversationContext.summaries.length,
      recallWindows: conversationContext.recallWindows.length,
      expressionExamples: expressionLearningExamples.length,
    });

    const toolContext: ToolExecutionContext = {
      userId: user.id,
      channel: input.channel,
      conversationId: conversation.id,
      messageId: userMessage.id,
      isOwner: owner, // use externalId (e.g. "telegram:1848918705"), not internal DB id
      signal,
    };
    const availableTools = selectToolsForChat({
      message: input.message,
      tools: toolRegistry.listEnabled(),
      context: toolContext,
    });

    console.log(`[chat] availableTools count: ${availableTools.length}`);
    trace.mark("tool_route", { tools: availableTools.map((tool) => tool.name) });

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
      toolsAvailable: availableTools.length > 0,
      expressionLearningContext: formatExpressionLearningExamples(expressionLearningExamples),
    });
    trace.mark("prompt_ready", { messages: messages.length });

    // If user sent images, append them to the last user message
    if (input.images && input.images.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "user") {
        // Convert string content to multimodal array
        const textPart: MessageContentPart = { type: "text", text: typeof lastMessage.content === "string" ? lastMessage.content : "" };
        lastMessage.content = [textPart, ...input.images];
      }
    }

    checkCancelled();
    await progress();
    checkCancelled();

    if (availableTools.length > 0) {
      console.log(`[chat] externalId: ${input.user_id}, isOwner: ${toolContext.isOwner}`);

      const toolsForLLM = convertToolsForLLM(availableTools);
      const conversationMessages: ChatMessage[] = [...messages];

      // Allow multiple tool rounds to handle multi-step tasks until the model stops requesting tools.
      for (let round = 0; ; round++) {
        checkCancelled();
        console.log(`[chat] round ${round + 1}: calling LLM with ${toolsForLLM.length} tools`);

        const response = await trace.time(
          `model_tools_round_${round + 1}`,
          () =>
            modelProvider.chatWithTools(
              conversationMessages,
              toolsForLLM,
              { signal }
            ),
          { tools: availableTools.map((tool) => tool.name) }
        );
        checkCancelled();

        // If LLM returned text (no tool calls), we're done
        if (!response.tool_calls || response.tool_calls.length === 0) {
          reply = sanitizeOutput(response.content ?? "");
          console.log("[chat] LLM returned text, no tool calls");
          break;
        }

        // LLM wants to call tools
        const toolCallNames = response.tool_calls.map((toolCall) => toolCall.function.name);
        console.log(`[chat] LLM requested ${response.tool_calls.length} tool calls`);
        await progress(toolProgressContent(toolCallNames));
        trace.mark("tool_calls_requested", { round: round + 1, tools: toolCallNames });
        checkCancelled();

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

          const result = await trace.time(`tool_${toolName}`, () =>
            toolExecutor.execute({
              toolName,
              input: toolInput,
              context: toolContext,
              signal,
            })
          );
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
        const finalResponse = await trace.time("model_final_no_tools", () =>
          modelProvider.chat(conversationMessages, { signal })
        );
        checkCancelled();
        reply = sanitizeOutput(finalResponse);
      }
    } else {
      // No tool is available for this context, so use a direct response.
      checkCancelled();
      const draftReply = await trace.time("model_direct", () =>
        modelProvider.chat(messages, { signal })
      );
      checkCancelled();
      reply = sanitizeOutput(draftReply);
    }
  }

  await progress();
  checkCancelled();
  const segmentation = await trace.time("segment_reply", () =>
    segmentReply(reply, deliveryOptions, { signal })
  );
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
    const assistantMessage = await trace.time("store_assistant_message", () =>
      prisma.message.create({
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
      })
    );
    part.message_id = assistantMessage.id;
    assistantMessages.push(assistantMessage);
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

  trace.mark("done", { finalParts: finalParts.length });

  return {
    reply,
    replies: finalReplies,
    reply_parts: [...replyParts, ...finalParts],
    conversation_id: input.conversation_id,
    memory_written: false,
    turn_id: turnId,
  };
}
