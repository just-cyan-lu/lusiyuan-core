import { Prisma, type RuntimeState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { autonomousTaskService } from "./autonomous-task.service.js";

export const DEFAULT_RUNTIME_STATE_KEY = "global";

export interface RuntimeStatePatch {
  energyLevel?: number;
  recentEventSummary?: string | null;
  statusNote?: string | null;
  metadata?: Prisma.InputJsonValue;
}

interface ApplyRuntimeStatePatchInput {
  patch: RuntimeStatePatch;
  eventType: string;
  source: string;
  summary?: string;
  userId?: string;
  conversationId?: string;
  sourceRuntimeEventIds?: Array<string | null | undefined>;
  sourceMessageIds?: Array<string | null | undefined>;
  channel?: string;
}

interface ObserveChatTurnInput {
  userId: string;
  conversationId: string;
  messageId?: string;
  channel: string;
  userMessage: string;
  assistantReply: string;
  isOwner?: boolean;
}

export interface RuntimeEventInput {
  eventType: string;
  source: string;
  summary: string;
  importance?: number;
  topic?: string | null;
  moodSignal?: string | null;
  energySignal?: string | null;
  stateImpact?: Prisma.InputJsonValue;
  payload?: Prisma.InputJsonValue;
  userId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  channel?: string | null;
  status?: string;
}

const defaultRuntimeState = {
  key: DEFAULT_RUNTIME_STATE_KEY,
  moodLabel: "平稳在线",
  energyLevel: 62,
  recentEventSummary: "暂无新的运行事件。",
  statusNote: "默认运行态已初始化；正在做的事由自主任务系统记录。",
} satisfies Prisma.RuntimeStateCreateInput;

const allowedStateMutationSourcePrefixes = [
  "admin",
  "dream",
  "autonomy",
];

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

export function moodLabelFromEnergyLevel(value: number): string {
  const energy = clampInt(value, 0, 100);
  if (energy <= 15) return "很低电";
  if (energy <= 30) return "安静，需要缓一缓";
  if (energy <= 45) return "有点累，但稳定";
  if (energy <= 65) return "平稳在线";
  if (energy <= 80) return "被点亮了一点";
  return "兴致很高";
}

function cleanText(value: unknown, maxChars: number): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed;
}

function normalizePatch(patch: RuntimeStatePatch): Prisma.RuntimeStateUpdateInput {
  const data: Prisma.RuntimeStateUpdateInput = {};

  if (patch.energyLevel !== undefined) {
    const energyLevel = clampInt(patch.energyLevel, 0, 100);
    data.energyLevel = energyLevel;
    data.moodLabel = moodLabelFromEnergyLevel(energyLevel);
  }
  if (patch.recentEventSummary !== undefined) {
    data.recentEventSummary = cleanText(patch.recentEventSummary, 320);
  }
  if (patch.statusNote !== undefined) {
    data.statusNote = cleanText(patch.statusNote, 320);
  }
  if (patch.metadata !== undefined) {
    data.metadata = patch.metadata;
  }

  return data;
}

function snapshotRuntimeState(state: RuntimeState): Prisma.InputJsonObject {
  return {
    id: state.id,
    key: state.key,
    moodLabel: state.moodLabel,
    energyLevel: state.energyLevel,
    recentEventSummary: state.recentEventSummary,
    statusNote: state.statusNote,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function summarizePatch(patch: RuntimeStatePatch): string {
  const parts = [
    patch.energyLevel !== undefined
      ? `心力 ${patch.energyLevel}（${moodLabelFromEnergyLevel(patch.energyLevel)}）`
      : "",
    patch.recentEventSummary ? `事件：${patch.recentEventSummary}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("；") : "运行态已更新。";
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanSourceIds(
  values?: Array<string | null | undefined>,
  maxItems = 80
): string[] | undefined {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }

  return result.length > 0 ? result : undefined;
}

function cleanSourceRuntimeEventIds(
  values?: Array<string | null | undefined>
): string[] | undefined {
  return cleanSourceIds(values);
}

function cleanSourceMessageIds(input: {
  sourceMessageIds?: Array<string | null | undefined>;
}): string[] | undefined {
  return cleanSourceIds(input.sourceMessageIds);
}

function sourceIdsFromJson(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return cleanSourceIds(
    value.map((item) => (typeof item === "string" ? item : undefined))
  ) ?? [];
}

function orderBySourceIds<T extends { id: string }>(items: T[], sourceIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  const seen = new Set<string>();

  for (const id of sourceIds) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    ordered.push(item);
    seen.add(id);
  }

  return ordered.concat(items.filter((item) => !seen.has(item.id)));
}

function assertAllowedStateMutationSource(source: string): void {
  const allowed = allowedStateMutationSourcePrefixes.some(
    (prefix) => source === prefix || source.startsWith(`${prefix}_`)
  );
  if (!allowed) {
    throw new Error(
      `RuntimeState can only be changed by admin/dream/autonomy sources, got: ${source}`
    );
  }
}

function metadataWith(
  current: Prisma.JsonValue | null,
  patch: Prisma.InputJsonObject
): Prisma.InputJsonObject {
  const base = readRecord(current) as Prisma.InputJsonObject;
  return {
    ...base,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function topicFromMessage(message: string): {
  focus: string;
  goal: string;
  activity: string;
} {
  if (/人设|persona|prompt|运行体|状态|目标|记忆系统|数据库|admin|后台|项目|架构|实现/i.test(message)) {
    return {
      focus: "运行体结构和项目实现",
      goal: "把陆思源的持续状态系统做稳。",
      activity: "和创造者一起梳理运行体设计。",
    };
  }

  if (/难过|累|焦虑|压力|崩溃|委屈|孤独|撑不住|心累|睡不着|没人懂/i.test(message)) {
    return {
      focus: "对方当下的情绪和需要被接住的部分",
      goal: "先稳定对话温度，再慢慢帮对方把感受理清楚。",
      activity: "陪对方待在情绪里，不急着给答案。",
    };
  }

  if (/规则|自由|公平|不公|控制|边界|价值观|道德|意义|存在|真实|实体/i.test(message)) {
    return {
      focus: "自由、边界、真实感和价值判断",
      goal: "认真表达自己的看法，同时保持温和和清醒。",
      activity: "在严肃问题里整理自己的立场。",
    };
  }

  if (/摄影|写作|影像|创作|故事|角色|世界观|审美|音乐|画面|风|光/i.test(message)) {
    return {
      focus: "创作、画面感和表达方式",
      goal: "把模糊的感觉整理成能被看见的作品方向。",
      activity: "顺着灵感找画面和表达。",
    };
  }

  return {
    focus: "日常聊天和关系连续性",
    goal: "自然地把这轮对话接住。",
    activity: "维持轻松、稳定的聊天状态。",
  };
}

export function deriveRuntimeEventFromChatTurn(
  input: ObserveChatTurnInput
): RuntimeEventInput {
  const owner = Boolean(input.isOwner);
  const source = `${input.userMessage}\n${input.assistantReply}`;
  const topic = topicFromMessage(input.userMessage);
  let importance = owner ? 55 : 30;
  let moodSignal = "steady";
  let energySignal = "slightly_draining";
  let energyDelta = -1;

  if (/难过|累|焦虑|压力|崩溃|委屈|孤独|撑不住|心累|睡不着|没人懂/i.test(source)) {
    importance += 20;
    moodSignal = "concerned";
    energySignal = "draining";
    energyDelta -= 4;
  }

  if (/开心|高兴|喜欢|好玩|太好了|哈哈|有意思|期待/i.test(source)) {
    importance += 8;
    moodSignal = "brightened";
    energySignal = "lifted";
    energyDelta += 3;
  }

  if (/人设|运行体|项目|架构|数据库|admin|后台|实现|设计/i.test(source)) {
    importance += owner ? 18 : 10;
    moodSignal = moodSignal === "steady" ? "focused" : moodSignal;
    energySignal = energySignal === "slightly_draining" ? "engaged" : energySignal;
    energyDelta += 2;
  }

  if (/控制|命令|必须|服从|边界|道德绑架|情绪勒索/i.test(source)) {
    importance += 18;
    moodSignal = "boundary_alert";
    energyDelta -= 3;
  }

  const preview = cleanText(input.userMessage, 80) ?? "日常聊天";

  return {
    eventType: "chat_turn",
    source: owner ? "owner_chat" : "chat",
    summary: owner
      ? `Owner 对话事件：${preview}`
      : `普通聊天事件：${preview}`,
    importance: clampInt(importance, 1, 100),
    topic: topic.focus,
    moodSignal,
    energySignal,
    stateImpact: {
      canMutateRuntimeState: false,
      mutationGate: owner ? "owner_chat_observe_only" : "ordinary_chat_observe_only",
      candidateDeltas: {
        energyLevel: energyDelta,
      },
      candidateFocus: topic.focus,
      candidateGoal: topic.goal,
      candidateActivity: topic.activity,
      note: "聊天只记录 RuntimeEvent，运行态不再被单轮对话牵着走；自主任务和 Dream 后续整理会使用这些材料。",
    },
    payload: {
      userMessagePreview: cleanText(input.userMessage, 220) ?? "",
      assistantReplyPreview: cleanText(input.assistantReply, 220) ?? "",
      owner,
    },
    userId: input.userId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    channel: input.channel,
    status: "observed",
  };
}

function formatMetadataList(metadataValue: Prisma.JsonValue | null, key: string): string {
  const metadata = readRecord(metadataValue);
  const value = metadata[key];
  if (!Array.isArray(value)) return "";
  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 5)
    .join("、");
}

export const runtimeStateService = {
  async getOrCreate(): Promise<RuntimeState> {
    return prisma.runtimeState.upsert({
      where: { key: DEFAULT_RUNTIME_STATE_KEY },
      update: {},
      create: defaultRuntimeState,
    });
  },

  async listEvents(limit = 30) {
    return prisma.runtimeStateEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: clampInt(limit, 1, 100),
    });
  },

  async listRuntimeEvents(limit = 30) {
    return prisma.runtimeEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: clampInt(limit, 1, 100),
    });
  },

  async getEventSources(eventId: string) {
    const event = await prisma.runtimeStateEvent.findUnique({
      where: { id: eventId },
    });
    if (!event) return null;

    const sourceRuntimeEventIds = sourceIdsFromJson(event.sourceRuntimeEventIds);
    const sourceMessageIds = sourceIdsFromJson(event.sourceMessageIds);

    const [runtimeEvents, messages] = await Promise.all([
      sourceRuntimeEventIds.length > 0
        ? prisma.runtimeEvent.findMany({
            where: { id: { in: sourceRuntimeEventIds } },
            orderBy: { createdAt: "asc" },
          })
        : [],
      sourceMessageIds.length > 0
        ? prisma.message.findMany({
            where: { id: { in: sourceMessageIds } },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              conversationId: true,
              role: true,
              content: true,
              externalMessageId: true,
              isIntermediate: true,
              metadata: true,
              createdAt: true,
              conversation: {
                select: {
                  id: true,
                  channel: true,
                  externalConversationId: true,
                  user: {
                    select: {
                      id: true,
                      externalId: true,
                      displayName: true,
                    },
                  },
                },
              },
            },
          })
        : [],
    ]);

    const runtimeEventIdSet = new Set(runtimeEvents.map((item) => item.id));
    const messageIdSet = new Set(messages.map((item) => item.id));

    return {
      event,
      runtimeEvents: orderBySourceIds(runtimeEvents, sourceRuntimeEventIds),
      messages: orderBySourceIds(messages, sourceMessageIds),
      missingRuntimeEventIds: sourceRuntimeEventIds.filter((id) => !runtimeEventIdSet.has(id)),
      missingMessageIds: sourceMessageIds.filter((id) => !messageIdSet.has(id)),
    };
  },

  async applyPatch(input: ApplyRuntimeStatePatchInput): Promise<RuntimeState> {
    assertAllowedStateMutationSource(input.source);
    const before = await this.getOrCreate();
    const data = normalizePatch(input.patch);
    const patchForEvent = input.patch as Prisma.InputJsonObject;
    const sourceRuntimeEventIds = cleanSourceRuntimeEventIds(input.sourceRuntimeEventIds);
    const sourceMessageIds = cleanSourceMessageIds(input);

    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.runtimeState.update({
        where: { key: DEFAULT_RUNTIME_STATE_KEY },
        data,
      });
      await tx.runtimeStateEvent.create({
        data: {
          runtimeStateId: updated.id,
          eventType: input.eventType,
          source: input.source,
          summary: input.summary ?? summarizePatch(input.patch),
          patch: patchForEvent,
          before: snapshotRuntimeState(before),
          after: snapshotRuntimeState(updated),
          userId: input.userId,
          conversationId: input.conversationId,
          sourceRuntimeEventIds,
          sourceMessageIds,
          channel: input.channel,
        },
      });
      return updated;
    });

    return after;
  },

  async recordRuntimeEvent(input: RuntimeEventInput) {
    return prisma.runtimeEvent.create({
      data: {
        eventType: input.eventType,
        source: input.source,
        summary: cleanText(input.summary, 320) ?? "运行事件已记录。",
        importance: clampInt(input.importance ?? 30, 1, 100),
        topic: cleanText(input.topic, 160),
        moodSignal: cleanText(input.moodSignal, 80),
        energySignal: cleanText(input.energySignal, 80),
        stateImpact: input.stateImpact,
        payload: input.payload,
        userId: input.userId ?? null,
        conversationId: input.conversationId ?? null,
        messageId: input.messageId ?? null,
        channel: input.channel ?? null,
        status: cleanText(input.status, 60) ?? "observed",
      },
    });
  },

  async recordEvent(input: {
    eventType: string;
    source: string;
    summary: string;
    patch?: Prisma.InputJsonValue;
    userId?: string;
    conversationId?: string;
    sourceRuntimeEventIds?: Array<string | null | undefined>;
    sourceMessageIds?: Array<string | null | undefined>;
    channel?: string;
  }): Promise<void> {
    const state = await this.getOrCreate();
    await prisma.runtimeStateEvent.create({
      data: {
        runtimeStateId: state.id,
        eventType: input.eventType,
        source: input.source,
        summary: input.summary,
        patch: input.patch,
        before: snapshotRuntimeState(state),
        after: snapshotRuntimeState(state),
        userId: input.userId,
        conversationId: input.conversationId,
        sourceRuntimeEventIds: cleanSourceRuntimeEventIds(input.sourceRuntimeEventIds),
        sourceMessageIds: cleanSourceMessageIds(input),
        channel: input.channel,
      },
    });
  },

  async reset(source = "admin"): Promise<RuntimeState> {
    const before = await this.getOrCreate();
    const after = await prisma.$transaction(async (tx) => {
      const updated = await tx.runtimeState.update({
        where: { key: DEFAULT_RUNTIME_STATE_KEY },
        data: {
          moodLabel: defaultRuntimeState.moodLabel,
          energyLevel: defaultRuntimeState.energyLevel,
          recentEventSummary: defaultRuntimeState.recentEventSummary,
          statusNote: defaultRuntimeState.statusNote,
          metadata: Prisma.JsonNull,
        },
      });
      await tx.runtimeStateEvent.create({
        data: {
          runtimeStateId: updated.id,
          eventType: "reset",
          source,
          summary: "运行态已重置为默认状态。",
          before: snapshotRuntimeState(before),
          after: snapshotRuntimeState(updated),
        },
      });
      return updated;
    });
    return after;
  },

  async observeDreamCycle(input: {
    jobId: string;
    status: string;
    phase?: string | null;
    summary?: string | null;
    dailyNoteId?: string | null;
    diaryEntryId?: string | null;
    signalCount?: number;
    proposalCount?: number;
    riskCount?: number;
    userId?: string | null;
    conversationId?: string | null;
    channel?: string | null;
    sourceMessageIds?: string[];
  }): Promise<void> {
    const state = await this.getOrCreate();
    const autoUpdateEnabled = runtimeConfig.RUNTIME_STATE_AUTO_UPDATE_ENABLED;
    const signalCount = clampInt(input.signalCount ?? 0, 0, 999);
    const proposalCount = clampInt(input.proposalCount ?? 0, 0, 999);
    const riskCount = clampInt(input.riskCount ?? 0, 0, 999);
    const summary = cleanText(input.summary, 220) ?? `Dream Cycle ${input.status}`;
    const completed = input.status === "completed" && input.phase !== "skipped";

    const runtimeEvent = await this.recordRuntimeEvent({
      eventType: "dream_cycle",
      source: "dream",
      summary: completed ? `梦境整理完成：${summary}` : `梦境周期记录：${summary}`,
      importance: completed ? 70 : 35,
      topic: "梦境和闲时整理",
      moodSignal: completed ? "settled" : "quiet",
      energySignal: "steady",
      stateImpact: {
        canMutateRuntimeState: autoUpdateEnabled && completed,
        mutationGate: !completed
          ? "dream_observe_only"
          : autoUpdateEnabled
            ? "dream_allowed"
            : "runtime_state_auto_update_disabled",
        signalCount,
        proposalCount,
        riskCount,
      },
      payload: {
        jobId: input.jobId,
        phase: input.phase ?? null,
        dailyNoteId: input.dailyNoteId ?? null,
        diaryEntryId: input.diaryEntryId ?? null,
      },
      userId: input.userId,
      conversationId: input.conversationId,
      channel: input.channel,
      status: input.status,
    });

    if (!autoUpdateEnabled || !completed) return;

    const patch: RuntimeStatePatch = {
      recentEventSummary: `梦境整理完成：${summary}`,
      statusNote: "由 Dream Cycle 写入整理结果；Dream 不再简单给心力加分。",
      metadata: metadataWith(state.metadata, {
        lastDream: {
          jobId: input.jobId,
          phase: input.phase ?? null,
          summary,
          dailyNoteId: input.dailyNoteId ?? null,
          diaryEntryId: input.diaryEntryId ?? null,
          signalCount,
          proposalCount,
          riskCount,
        },
      }),
    };

    await this.applyPatch({
      patch,
      eventType: "dream_state_update",
      source: "dream",
      summary: summarizePatch(patch),
      userId: input.userId ?? undefined,
      conversationId: input.conversationId ?? undefined,
      sourceRuntimeEventIds: [runtimeEvent.id],
      sourceMessageIds: input.sourceMessageIds,
      channel: input.channel ?? undefined,
    });
  },

  async runAutonomyTick(now = new Date()) {
    const state = await this.getOrCreate();
    const autoUpdateEnabled = runtimeConfig.RUNTIME_STATE_AUTO_UPDATE_ENABLED;
    const lowChatCount = runtimeConfig.RUNTIME_AUTONOMY_LOW_CHAT_COUNT;
    const highChatCount = Math.max(
      lowChatCount + 1,
      runtimeConfig.RUNTIME_AUTONOMY_HIGH_CHAT_COUNT
    );
    const twoHoursAgo = new Date(now.getTime() - 2 * 3600_000);
    const dayAgo = new Date(now.getTime() - 24 * 3600_000);
    const [recentChatCount, dayChatCount, lastChat, recentChatEvents] = await Promise.all([
      prisma.runtimeEvent.count({
        where: { eventType: "chat_turn", createdAt: { gte: twoHoursAgo } },
      }),
      prisma.runtimeEvent.count({
        where: { eventType: "chat_turn", createdAt: { gte: dayAgo } },
      }),
      prisma.runtimeEvent.findFirst({
        where: { eventType: "chat_turn" },
        orderBy: { createdAt: "desc" },
        select: { id: true, messageId: true, createdAt: true },
      }),
      prisma.runtimeEvent.findMany({
        where: { eventType: "chat_turn", createdAt: { gte: twoHoursAgo } },
        orderBy: { createdAt: "desc" },
        take: Math.min(highChatCount, 100),
        select: { id: true, messageId: true },
      }),
    ]);

    const hoursSinceLastChat = lastChat
      ? (now.getTime() - lastChat.createdAt.getTime()) / 3600_000
      : null;

    let summary = `自主检查：最近两小时有 ${recentChatCount} 轮聊天，暂不调整心力。`;
    let patch: RuntimeStatePatch = {
      recentEventSummary: summary,
      statusNote: "由 autonomy tick 根据聊天密度判断是否适合休息或推进自主任务。",
    };
    let sourceChatEvents: Array<{ id: string; messageId: string | null }> = [];
    let idleTaskRun: Awaited<ReturnType<typeof autonomousTaskService.runNextIdleTask>> | null = null;

    if (recentChatCount >= highChatCount) {
      summary = `自主检查：最近两小时有 ${recentChatCount} 轮聊天，达到高强度阈值 ${highChatCount}，心力下降并暂停闲时任务。`;
      sourceChatEvents = recentChatEvents;
      patch = {
        energyLevel: clampInt(state.energyLevel - 8, 0, 100),
        recentEventSummary: summary,
        statusNote: "由 autonomy tick 判断：连续聊天较多，先回到休息和接话状态。",
      };
    } else if (recentChatCount <= lowChatCount) {
      summary = `自主检查：最近两小时只有 ${recentChatCount} 轮聊天，低于恢复阈值 ${lowChatCount}，适合恢复心力并推进一个闲时任务。`;
      sourceChatEvents = lastChat ? [lastChat] : [];
      patch = {
        energyLevel: clampInt(state.energyLevel + 1, 0, 100),
        recentEventSummary: summary,
        statusNote: "由 autonomy tick 判断：当前较空闲，可以做一点自己的事。",
      };

      idleTaskRun = await autonomousTaskService.runNextIdleTask({
        trigger: "autonomy_tick",
      });
    }

    patch.metadata = metadataWith(state.metadata, {
      lastAutonomyTick: {
        at: now.toISOString(),
        recentChatCount,
        dayChatCount,
        hoursSinceLastChat,
        lowChatCount,
        highChatCount,
        idleTaskRun: idleTaskRun
          ? {
              taskId: idleTaskRun.task?.id ?? null,
              runId: idleTaskRun.run?.id ?? null,
              status: idleTaskRun.status,
              summary: idleTaskRun.summary,
            }
          : null,
        summary,
      },
    });

    const event = await this.recordRuntimeEvent({
      eventType: "autonomy_tick",
      source: "autonomy",
      summary: idleTaskRun?.summary ? `${summary}；${idleTaskRun.summary}` : summary,
      importance: recentChatCount >= highChatCount || recentChatCount <= lowChatCount ? 65 : 35,
      topic: "自启动、时间流逝和自主任务",
      moodSignal: patch.energyLevel !== undefined
        ? moodLabelFromEnergyLevel(patch.energyLevel)
        : state.moodLabel,
      energySignal: recentChatCount >= highChatCount
        ? "drained"
        : recentChatCount <= lowChatCount
          ? "restoring"
          : "stable",
      stateImpact: {
        canMutateRuntimeState: autoUpdateEnabled,
        mutationGate: autoUpdateEnabled
          ? "autonomy_allowed"
          : "runtime_state_auto_update_disabled",
        recentChatCount,
        dayChatCount,
        hoursSinceLastChat,
        lowChatCount,
        highChatCount,
        idleTaskRunStatus: idleTaskRun?.status ?? null,
      },
      payload: {
        generatedPatch: patch as Prisma.InputJsonObject,
      },
    });

    if (!autoUpdateEnabled) return { state, event, idleTaskRun };

    const updated = await this.applyPatch({
      patch,
      eventType: "autonomy_state_update",
      source: "autonomy",
      summary,
      sourceRuntimeEventIds: [event.id, ...sourceChatEvents.map((sourceEvent) => sourceEvent.id)],
      sourceMessageIds: sourceChatEvents.map((sourceEvent) => sourceEvent.messageId),
    });

    return { state: updated, event, idleTaskRun };
  },

  async formatForPrompt(): Promise<string> {
    const [state, taskContext] = await Promise.all([
      this.getOrCreate(),
      autonomousTaskService.formatForPrompt(),
    ]);
    const innerWeather = formatMetadataList(state.metadata, "emotionalTones");

    return [
      "# 数据库运行态",
      "",
      `- 状态：${state.moodLabel}`,
      `- 心力：${state.energyLevel}/100`,
      `- 最近事件：${state.recentEventSummary ?? "暂无新的运行事件。"}`,
      state.statusNote ? `- 状态备注：${state.statusNote}` : "",
      innerWeather ? `- 情绪色调：${innerWeather}` : "",
      "",
      taskContext,
      "",
      "运行态只表示当前心力和最近状态；正在做的事来自自主任务系统。单轮聊天不会直接改运行态。",
    ]
      .filter(Boolean)
      .join("\n");
  },

  async observeChatTurn(input: ObserveChatTurnInput): Promise<void> {
    const runtimeEvent = deriveRuntimeEventFromChatTurn(input);
    await this.recordRuntimeEvent(runtimeEvent);
  },
};
