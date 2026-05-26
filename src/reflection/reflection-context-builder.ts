import { prisma } from "../db/prisma.js";
import { loadPersona } from "../core/persona-loader.js";
import type {
  BuildReflectionContextInput,
  ReflectionContext,
  ReflectionMessage,
  ReflectionMemory,
} from "./reflection.types.js";
import { env } from "../utils/env.js";

export async function buildReflectionContext(
  input: BuildReflectionContextInput
): Promise<ReflectionContext> {
  const { scope, userId, conversationId, messageLimit, from, to } = input;
  const limit = Math.min(
    messageLimit ?? env.REFLECTION_DEFAULT_MESSAGE_LIMIT,
    env.REFLECTION_MAX_MESSAGE_LIMIT
  );

  // ── Messages ──────────────────────────────────────────────────────────────
  const messageWhere: Record<string, unknown> = {};
  if (scope === "conversation" && conversationId) {
    const conv = await prisma.conversation.findFirst({
      where: { externalConversationId: conversationId },
    });
    if (conv) messageWhere["conversationId"] = conv.id;
  } else if (scope === "user" && userId) {
    const convIds = await prisma.conversation
      .findMany({ where: { userId }, select: { id: true } })
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
  if (userId) memoryWhere["userId"] = userId;

  const rawMemories = await prisma.memory.findMany({
    where: memoryWhere,
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: env.REFLECTION_INCLUDE_MEMORIES ? 30 : 0,
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
