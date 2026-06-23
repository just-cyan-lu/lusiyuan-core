import { prisma } from "../db/prisma.js";
import { loadPersona } from "../core/persona-loader.js";
import type {
  BuildReflectionContextInput,
  ReflectionContext,
  ReflectionMessage,
  ReflectionMemory,
} from "./reflection.types.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";

export async function buildReflectionContext(
  input: BuildReflectionContextInput
): Promise<ReflectionContext> {
  const { scope, userId, conversationId, messageLimit, from, to } = input;
  const limit = Math.min(
    messageLimit ?? runtimeConfig.REFLECTION_DEFAULT_MESSAGE_LIMIT,
    runtimeConfig.REFLECTION_MAX_MESSAGE_LIMIT
  );

  // ── Messages ──────────────────────────────────────────────────────────────
  const messageWhere: Record<string, unknown> = {};
  let resolvedUserId = userId;

  if (scope === "conversation") {
    if (!conversationId) {
      throw new Error("conversationId is required for conversation reflection");
    }
    const conv = await prisma.conversation.findFirst({
      where: {
        OR: [{ id: conversationId }, { externalConversationId: conversationId }],
      },
      select: { id: true, userId: true },
    });
    if (!conv) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    messageWhere["conversationId"] = conv.id;
    resolvedUserId = conv.userId;
  } else if (scope === "user") {
    if (!userId) {
      throw new Error("userId is required for user reflection");
    }
    const user = await prisma.user.findFirst({
      where: { OR: [{ id: userId }, { externalId: userId }] },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    resolvedUserId = user.id;
    const convIds = await prisma.conversation
      .findMany({ where: { userId: user.id }, select: { id: true } })
      .then((cs) => cs.map((c) => c.id));
    messageWhere["conversationId"] = { in: convIds };
  }
  if (from) messageWhere["createdAt"] = { gte: from };
  if (to) {
    messageWhere["createdAt"] = {
      ...(messageWhere["createdAt"] as object ?? {}),
      lte: to,
    };
  }

  const rawMessages = await prisma.message.findMany({
    where: messageWhere,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  const messages: ReflectionMessage[] = rawMessages.reverse();

  // ── Existing memories ─────────────────────────────────────────────────────
  const memoryWhere: Record<string, unknown> = { status: "active" };
  if (resolvedUserId) memoryWhere["userId"] = resolvedUserId;

  const rawMemories = await prisma.memory.findMany({
    where: memoryWhere,
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: runtimeConfig.REFLECTION_INCLUDE_MEMORIES ? 30 : 0,
    select: {
      id: true,
      type: true,
      scope: true,
      content: true,
      importance: true,
      confidence: true,
      createdAt: true,
    },
  });
  const existingMemories: ReflectionMemory[] = rawMemories;

  // ── Persona summaries ─────────────────────────────────────────────────────
  const persona = await loadPersona();
  const coreIdentitySummary = persona.identity.slice(0, 600);
  const boundariesSummary = persona.boundaries.slice(0, 400);

  return { messages, existingMemories, coreIdentitySummary, boundariesSummary };
}
