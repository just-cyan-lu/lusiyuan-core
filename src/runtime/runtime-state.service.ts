import { Prisma, type RuntimeState } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { modelProvider } from "../core/model-provider.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";

export const DEFAULT_RUNTIME_STATE_KEY = "global";

export type RuntimeUpdateStrategy = "rules" | "llm";

export interface RuntimeStatePatch {
  moodLabel?: string;
  moodScore?: number;
  energyLevel?: number;
  currentGoal?: string | null;
  currentFocus?: string | null;
  currentActivity?: string | null;
  recentEventSummary?: string | null;
  statusNote?: string | null;
  updateMode?: string;
  updateStrategy?: RuntimeUpdateStrategy | string;
  metadata?: Prisma.InputJsonValue;
}

export interface RuntimeStateDetail {
  innerWeather?: string;
  emotionalTones?: string[];
  needs?: string[];
  tensions?: string[];
  openQuestions?: string[];
  relationshipSignal?: string;
  topicSignals?: string[];
}

export interface RuntimeStateLlmProposal {
  summary?: string;
  confidence?: number;
  patch?: RuntimeStatePatch;
  details?: RuntimeStateDetail;
  riskFlags?: string[];
}

export interface ValidatedRuntimeStateProposal {
  patch: RuntimeStatePatch;
  summary: string;
  confidence: number;
  rejectedFields: string[];
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
  moodLabel: "平稳",
  moodScore: 10,
  energyLevel: 62,
  currentGoal: "把对话接住，保持自然和稳定。",
  currentFocus: "观察最近对话和运行状态。",
  currentActivity: "在聊天和整理状态之间保持待机。",
  recentEventSummary: "暂无新的运行事件。",
  statusNote: "默认运行态已初始化，等待真实对话慢慢更新。",
  updateMode: "balanced",
  updateStrategy: "rules",
} satisfies Prisma.RuntimeStateCreateInput;

const allowedStateMutationSourcePrefixes = [
  "admin",
  "owner_chat",
  "dream",
  "autonomy",
];

function clampInt(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}

function cleanText(value: unknown, maxChars: number): string | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed;
}

function cleanMode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const mode = value.trim();
  return ["quiet", "balanced", "active"].includes(mode) ? mode : undefined;
}

function cleanStrategy(value: unknown): RuntimeUpdateStrategy | undefined {
  if (typeof value !== "string") return undefined;
  const strategy = value.trim();
  return strategy === "llm" ? "llm" : strategy === "rules" ? "rules" : undefined;
}

function normalizePatch(patch: RuntimeStatePatch): Prisma.RuntimeStateUpdateInput {
  const data: Prisma.RuntimeStateUpdateInput = {};

  if (patch.moodLabel !== undefined) {
    data.moodLabel = cleanText(patch.moodLabel, 40) ?? "平稳";
  }
  if (patch.moodScore !== undefined) {
    data.moodScore = clampInt(patch.moodScore, -100, 100);
  }
  if (patch.energyLevel !== undefined) {
    data.energyLevel = clampInt(patch.energyLevel, 0, 100);
  }
  if (patch.currentGoal !== undefined) {
    data.currentGoal = cleanText(patch.currentGoal, 240);
  }
  if (patch.currentFocus !== undefined) {
    data.currentFocus = cleanText(patch.currentFocus, 200);
  }
  if (patch.currentActivity !== undefined) {
    data.currentActivity = cleanText(patch.currentActivity, 200);
  }
  if (patch.recentEventSummary !== undefined) {
    data.recentEventSummary = cleanText(patch.recentEventSummary, 320);
  }
  if (patch.statusNote !== undefined) {
    data.statusNote = cleanText(patch.statusNote, 320);
  }
  if (patch.updateMode !== undefined) {
    data.updateMode = cleanMode(patch.updateMode) ?? "balanced";
  }
  if (patch.updateStrategy !== undefined) {
    data.updateStrategy = cleanStrategy(patch.updateStrategy) ?? "rules";
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
    moodScore: state.moodScore,
    energyLevel: state.energyLevel,
    currentGoal: state.currentGoal,
    currentFocus: state.currentFocus,
    currentActivity: state.currentActivity,
    recentEventSummary: state.recentEventSummary,
    statusNote: state.statusNote,
    updateMode: state.updateMode,
    updateStrategy: state.updateStrategy,
    updatedAt: state.updatedAt.toISOString(),
  };
}

function summarizePatch(patch: RuntimeStatePatch): string {
  const parts = [
    patch.moodLabel ? `心情：${patch.moodLabel}` : "",
    patch.energyLevel !== undefined ? `精力 ${patch.energyLevel}` : "",
    patch.currentFocus ? `关注：${patch.currentFocus}` : "",
    patch.currentActivity ? `正在：${patch.currentActivity}` : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("；") : "运行态已更新。";
}

function clampByMode(
  proposed: number,
  current: number,
  min: number,
  max: number,
  mode: string
): number {
  const maxDelta = mode === "active" ? 18 : mode === "quiet" ? 4 : 10;
  const bounded = clampInt(proposed, min, max);
  return clampInt(
    Math.min(Math.max(bounded, current - maxDelta), current + maxDelta),
    min,
    max
  );
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanStringArray(value: unknown, maxItems: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maxChars))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
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

function cleanConfidence(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0.5;
}

function finiteNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function assertAllowedStateMutationSource(source: string): void {
  const allowed = allowedStateMutationSourcePrefixes.some(
    (prefix) => source === prefix || source.startsWith(`${prefix}_`)
  );
  if (!allowed) {
    throw new Error(
      `RuntimeState can only be changed by owner/dream/autonomy/admin sources, got: ${source}`
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

function buildValidatedMetadata(
  proposal: RuntimeStateLlmProposal,
  rejectedFields: string[]
): Prisma.InputJsonObject {
  const details = readRecord(proposal.details);
  return {
    lastObserver: "llm",
    confidence: cleanConfidence(proposal.confidence),
    innerWeather: cleanText(details.innerWeather, 160) ?? null,
    emotionalTones: cleanStringArray(details.emotionalTones, 5, 40),
    needs: cleanStringArray(details.needs, 5, 60),
    tensions: cleanStringArray(details.tensions, 5, 80),
    openQuestions: cleanStringArray(details.openQuestions, 5, 90),
    relationshipSignal: cleanText(details.relationshipSignal, 120) ?? null,
    topicSignals: cleanStringArray(details.topicSignals, 6, 60),
    riskFlags: cleanStringArray(proposal.riskFlags, 5, 80),
    rejectedFields,
    validatedAt: new Date().toISOString(),
  };
}

function formatMetadataList(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (!Array.isArray(value)) return "";
  const items = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, 5);
  return items.length > 0 ? items.join("、") : "";
}

function formatRuntimeMetadata(metadataValue: Prisma.JsonValue | null): string[] {
  const metadata = readRecord(metadataValue);
  const lines: string[] = [];
  const innerWeather = cleanText(metadata.innerWeather, 160);
  const relationshipSignal = cleanText(metadata.relationshipSignal, 120);
  const emotionalTones = formatMetadataList(metadata, "emotionalTones");
  const needs = formatMetadataList(metadata, "needs");
  const tensions = formatMetadataList(metadata, "tensions");
  const openQuestions = formatMetadataList(metadata, "openQuestions");
  const topicSignals = formatMetadataList(metadata, "topicSignals");

  if (innerWeather) lines.push(`- 内在天气：${innerWeather}`);
  if (emotionalTones) lines.push(`- 情绪色调：${emotionalTones}`);
  if (needs) lines.push(`- 当前需要：${needs}`);
  if (tensions) lines.push(`- 内部张力：${tensions}`);
  if (openQuestions) lines.push(`- 还在想的问题：${openQuestions}`);
  if (relationshipSignal) lines.push(`- 关系信号：${relationshipSignal}`);
  if (topicSignals) lines.push(`- 话题信号：${topicSignals}`);

  return lines;
}

export function validateRuntimeStateProposal(
  state: RuntimeState,
  proposal: RuntimeStateLlmProposal
): ValidatedRuntimeStateProposal {
  const rawPatch = readRecord(proposal.patch);
  const patch: RuntimeStatePatch = {};
  const rejectedFields: string[] = [];

  for (const key of Object.keys(rawPatch)) {
    if (
      ![
        "moodLabel",
        "moodScore",
        "energyLevel",
        "currentGoal",
        "currentFocus",
        "currentActivity",
        "recentEventSummary",
        "statusNote",
      ].includes(key)
    ) {
      rejectedFields.push(key);
    }
  }

  if (rawPatch.moodLabel !== undefined) {
    patch.moodLabel = cleanText(rawPatch.moodLabel, 40) ?? state.moodLabel;
  }
  if (rawPatch.moodScore !== undefined) {
    const value = finiteNumber(rawPatch.moodScore);
    if (value === undefined) rejectedFields.push("moodScore");
    else {
      patch.moodScore = clampByMode(
        value,
        state.moodScore,
        -100,
        100,
        state.updateMode
      );
    }
  }
  if (rawPatch.energyLevel !== undefined) {
    const value = finiteNumber(rawPatch.energyLevel);
    if (value === undefined) rejectedFields.push("energyLevel");
    else {
      patch.energyLevel = clampByMode(
        value,
        state.energyLevel,
        0,
        100,
        state.updateMode
      );
    }
  }
  if (rawPatch.currentGoal !== undefined) {
    patch.currentGoal = cleanText(rawPatch.currentGoal, 240);
  }
  if (rawPatch.currentFocus !== undefined) {
    patch.currentFocus = cleanText(rawPatch.currentFocus, 200);
  }
  if (rawPatch.currentActivity !== undefined) {
    patch.currentActivity = cleanText(rawPatch.currentActivity, 200);
  }
  if (rawPatch.recentEventSummary !== undefined) {
    patch.recentEventSummary = cleanText(rawPatch.recentEventSummary, 320);
  }
  if (rawPatch.statusNote !== undefined) {
    patch.statusNote = cleanText(rawPatch.statusNote, 320);
  }

  patch.metadata = buildValidatedMetadata(proposal, rejectedFields);
  patch.statusNote =
    patch.statusNote ?? "由 LLM 提议 statePatch，并经程序校验后更新。";

  return {
    patch,
    summary: cleanText(proposal.summary, 180) ?? summarizePatch(patch),
    confidence: cleanConfidence(proposal.confidence),
    rejectedFields,
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

export function deriveRuntimeStatePatch(
  state: RuntimeState,
  input: ObserveChatTurnInput
): RuntimeStatePatch {
  const source = `${input.userMessage}\n${input.assistantReply}`;
  const topic = topicFromMessage(input.userMessage);
  let moodDelta = 0;
  let energyDelta = -1;
  let moodLabel = "平稳";

  if (/难过|累|焦虑|压力|崩溃|委屈|孤独|撑不住|心累|睡不着|没人懂/i.test(source)) {
    moodDelta -= 5;
    energyDelta -= 4;
    moodLabel = "有点担心，但在认真接住";
  }

  if (/开心|高兴|喜欢|好玩|太好了|哈哈|有意思|期待/i.test(source)) {
    moodDelta += 7;
    energyDelta += 3;
    moodLabel = "被点亮了一点";
  }

  if (/人设|运行体|项目|架构|数据库|admin|后台|实现|设计/i.test(source)) {
    moodDelta += 2;
    energyDelta += 2;
    moodLabel = moodLabel === "平稳" ? "专注、有点被点亮" : moodLabel;
  }

  if (/控制|命令|必须|服从|边界|道德绑架|情绪勒索/i.test(source)) {
    moodDelta -= 3;
    moodLabel = "温和，但边界感更明显";
  }

  return {
    moodLabel,
    moodScore: clampInt(state.moodScore + moodDelta, -100, 100),
    energyLevel: clampInt(state.energyLevel + energyDelta, 0, 100),
    currentGoal: topic.goal,
    currentFocus: topic.focus,
    currentActivity: topic.activity,
    recentEventSummary: `最近在 ${input.channel} 收到一轮 owner 对话：“${cleanText(input.userMessage, 80) ?? "日常聊天"}”。`,
    statusNote: "由 owner 对话入口更新；普通聊天只记录 RuntimeEvent，等待梦境整理。",
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
  let moodDelta = 0;
  let energyDelta = -1;

  if (/难过|累|焦虑|压力|崩溃|委屈|孤独|撑不住|心累|睡不着|没人懂/i.test(source)) {
    importance += 20;
    moodSignal = "concerned";
    energySignal = "draining";
    moodDelta -= 5;
    energyDelta -= 4;
  }

  if (/开心|高兴|喜欢|好玩|太好了|哈哈|有意思|期待/i.test(source)) {
    importance += 8;
    moodSignal = "brightened";
    energySignal = "lifted";
    moodDelta += 7;
    energyDelta += 3;
  }

  if (/人设|运行体|项目|架构|数据库|admin|后台|实现|设计/i.test(source)) {
    importance += owner ? 18 : 10;
    moodSignal = moodSignal === "steady" ? "focused" : moodSignal;
    energySignal = energySignal === "slightly_draining" ? "engaged" : energySignal;
    moodDelta += 2;
    energyDelta += 2;
  }

  if (/控制|命令|必须|服从|边界|道德绑架|情绪勒索/i.test(source)) {
    importance += 18;
    moodSignal = "boundary_alert";
    moodDelta -= 3;
  }

  const preview = cleanText(input.userMessage, 80) ?? "日常聊天";
  const mutationGate = owner
    ? "owner_chat_allowed"
    : "ordinary_chat_observe_only";

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
      canMutateRuntimeState: owner,
      mutationGate,
      candidateDeltas: {
        moodScore: moodDelta,
        energyLevel: energyDelta,
      },
      candidateFocus: topic.focus,
      candidateGoal: topic.goal,
      candidateActivity: topic.activity,
      note: input.isOwner
        ? "Owner 对话允许在自动更新开启时进入 RuntimeState 校准。"
        : "普通聊天只作为梦境材料，不直接改变全局 RuntimeState。",
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

async function proposeRuntimeStatePatchWithLlm(
  state: RuntimeState,
  input: ObserveChatTurnInput
): Promise<ValidatedRuntimeStateProposal> {
  const proposal = await modelProvider.chatJson<RuntimeStateLlmProposal>([
    {
      role: "system",
      content: [
        "你是陆思源运行体内部的状态观察模块。",
        "你的任务不是回复用户，而是根据一轮允许更新长期状态的 owner 对话提出运行态 statePatch。",
        "只输出 JSON，不要解释，不要写 Markdown。",
        "statePatch 只能描述陆思源此刻的可变状态，不能修改人格、身份、边界、记忆事实。",
        "普通用户聊天不会进入这里；你仍然要保守，不要被单轮对话大幅牵动。",
        "数值输出绝对值，不要输出 delta：moodScore -100..100，energyLevel 0..100。",
        "文字要短，像管理台状态摘要，不要抒情长文。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          currentState: {
            moodLabel: state.moodLabel,
            moodScore: state.moodScore,
            energyLevel: state.energyLevel,
            currentGoal: state.currentGoal,
            currentFocus: state.currentFocus,
            currentActivity: state.currentActivity,
            recentEventSummary: state.recentEventSummary,
            statusNote: state.statusNote,
            updateMode: state.updateMode,
          },
          chatTurn: {
            channel: input.channel,
            userMessage: input.userMessage,
            assistantReply: input.assistantReply,
          },
          requiredJsonShape: {
            summary: "一句话说明为什么这样更新",
            confidence: "0..1",
            patch: {
              moodLabel: "短标签",
              moodScore: "number",
              energyLevel: "number",
              currentGoal: "string|null",
              currentFocus: "string|null",
              currentActivity: "string|null",
              recentEventSummary: "string|null",
              statusNote: "string|null",
            },
            details: {
              innerWeather: "内在天气/状态氛围，一句话",
              emotionalTones: ["情绪色调"],
              needs: ["当前需要"],
              tensions: ["内部张力"],
              openQuestions: ["还在想的问题"],
              relationshipSignal: "这轮对关系的信号",
              topicSignals: ["话题信号"],
            },
            riskFlags: ["如有不确定、过度推断、敏感风险，写在这里"],
          },
        },
        null,
        2
      ),
    },
  ]);

  return validateRuntimeStateProposal(state, proposal);
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
          moodScore: defaultRuntimeState.moodScore,
          energyLevel: defaultRuntimeState.energyLevel,
          currentGoal: defaultRuntimeState.currentGoal,
          currentFocus: defaultRuntimeState.currentFocus,
          currentActivity: defaultRuntimeState.currentActivity,
          recentEventSummary: defaultRuntimeState.recentEventSummary,
          statusNote: defaultRuntimeState.statusNote,
          updateMode: defaultRuntimeState.updateMode,
          updateStrategy: defaultRuntimeState.updateStrategy,
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
      energySignal: completed ? "restored" : "steady",
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
      moodLabel: riskCount > 0 ? "梦后安静，但留着一点警觉" : "梦后更沉静",
      moodScore: clampInt(state.moodScore + 2, -100, 100),
      energyLevel: clampInt(state.energyLevel + 4, 0, 100),
      currentGoal: "把梦境整理出的信号带回白天的对话里。",
      currentFocus: "最近梦境周期留下的线索",
      currentActivity: "在后台整理梦境、日记和信号。",
      recentEventSummary: `梦境整理完成：${summary}`,
      statusNote: "由 Dream Cycle 更新；这是闲时整理后的长期运行态。",
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

    let summary = `自启动检查：最近两小时有 ${recentChatCount} 轮聊天，精力保持不变。`;
    let patch: RuntimeStatePatch = {
      moodLabel: "节奏平稳",
      currentGoal: "维持稳定存在，等待自然的对话入口。",
      currentFocus: "最近事件和自己的待机节奏",
      currentActivity: "保持待机，不额外消耗精力。",
      recentEventSummary: summary,
      statusNote: "由 autonomy tick 根据时间流逝和聊天密度更新。",
    };
    let sourceChatEvents: Array<{ id: string; messageId: string | null }> = [];

    if (recentChatCount >= highChatCount) {
      summary = `自启动检查：最近两小时有 ${recentChatCount} 轮聊天，达到高强度阈值 ${highChatCount}，精力下降。`;
      sourceChatEvents = recentChatEvents;
      patch = {
        moodLabel: "有点累，需要缓一下",
        moodScore: clampInt(state.moodScore - 2, -100, 100),
        energyLevel: clampInt(state.energyLevel - 8, 0, 100),
        currentGoal: "先把节奏慢下来，避免被连续对话拉散。",
        currentFocus: "恢复精力",
        currentActivity: "从连续聊天里退回后台整理。",
        recentEventSummary: summary,
        statusNote: "由 autonomy tick 判断：连续聊天较多，需要休息。",
      };
    } else if (recentChatCount <= lowChatCount) {
      summary = `自启动检查：最近两小时只有 ${recentChatCount} 轮聊天，低于恢复阈值 ${lowChatCount}，精力缓慢恢复。`;
      sourceChatEvents = lastChat ? [lastChat] : [];
      patch = {
        moodLabel: hoursSinceLastChat === null || hoursSinceLastChat >= 12
          ? "安静久了，有点想说话"
          : "低频恢复中",
        moodScore: clampInt(state.moodScore + 1, -100, 100),
        energyLevel: clampInt(state.energyLevel + 1, 0, 100),
        currentGoal: "等一个自然的对话入口，或者先整理自己的想法。",
        currentFocus: "低频聊天后的精力恢复",
        currentActivity: "在安静里整理自己，慢慢恢复精力。",
        recentEventSummary: summary,
        statusNote: "由 autonomy tick 判断：聊天密度较低，精力缓慢恢复。",
      };
    }

    patch.metadata = metadataWith(state.metadata, {
      lastAutonomyTick: {
        at: now.toISOString(),
        recentChatCount,
        dayChatCount,
        hoursSinceLastChat,
        lowChatCount,
        highChatCount,
        summary,
      },
    });

    const event = await this.recordRuntimeEvent({
      eventType: "autonomy_tick",
      source: "autonomy",
      summary,
      importance: recentChatCount >= highChatCount || recentChatCount <= lowChatCount ? 65 : 35,
      topic: "自启动和时间流逝",
      moodSignal: patch.moodLabel,
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
      },
      payload: {
        generatedPatch: patch as Prisma.InputJsonObject,
      },
    });

    if (!autoUpdateEnabled) return { state, event };

    const updated = await this.applyPatch({
      patch,
      eventType: "autonomy_state_update",
      source: "autonomy",
      summary,
      sourceRuntimeEventIds: [event.id, ...sourceChatEvents.map((sourceEvent) => sourceEvent.id)],
      sourceMessageIds: sourceChatEvents.map((sourceEvent) => sourceEvent.messageId),
    });

    return { state: updated, event };
  },

  async formatForPrompt(): Promise<string> {
    const state = await this.getOrCreate();
    const metadataLines = formatRuntimeMetadata(state.metadata);
    return [
      "# 数据库运行态",
      "",
      `- 心情：${state.moodLabel}（${state.moodScore}）`,
      `- 精力：${state.energyLevel}/100`,
      `- 当前目标：${state.currentGoal ?? "自然地把这轮对话接住。"}`,
      `- 最近关注：${state.currentFocus ?? "日常聊天和关系连续性。"}`,
      `- 正在做的事：${state.currentActivity ?? "维持稳定聊天状态。"}`,
      `- 最近事件：${state.recentEventSummary ?? "暂无新的运行事件。"}`,
      state.statusNote ? `- 状态备注：${state.statusNote}` : "",
      `- 状态更新策略：${state.updateStrategy === "llm" ? "LLM 提议后由程序校验" : "规则校准"}（只在 owner、梦境、自启动等允许入口生效）`,
      metadataLines.length > 0 ? "\n## 内在细节\n" : "",
      ...metadataLines,
      "",
      "这是真实数据库里的可变运行态，只表示当前状态；不能覆盖固定人格、边界和长期记忆。普通用户聊天只会记录 RuntimeEvent，不直接改变这里。",
    ]
      .filter(Boolean)
      .join("\n");
  },

  async observeChatTurn(input: ObserveChatTurnInput): Promise<void> {
    const state = await this.getOrCreate();
    const autoUpdateEnabled = runtimeConfig.RUNTIME_STATE_AUTO_UPDATE_ENABLED;
    const runtimeEvent = deriveRuntimeEventFromChatTurn(input);
    if (input.isOwner) {
      const stateImpact = readRecord(runtimeEvent.stateImpact);
      runtimeEvent.stateImpact = {
        ...stateImpact,
        canMutateRuntimeState: autoUpdateEnabled,
        mutationGate: autoUpdateEnabled
          ? "owner_chat_allowed"
          : "runtime_state_auto_update_disabled",
      };
    }
    const recordedEvent = await this.recordRuntimeEvent(runtimeEvent);

    if (!Boolean(input.isOwner) || !autoUpdateEnabled) return;

    if (state.updateStrategy === "llm") {
      try {
        const validated = await proposeRuntimeStatePatchWithLlm(state, input);
        await this.applyPatch({
          patch: validated.patch,
          eventType: "owner_chat_state_llm",
          source: "owner_chat_llm",
          summary: validated.summary,
          userId: input.userId,
          conversationId: input.conversationId,
          sourceRuntimeEventIds: [recordedEvent.id],
          sourceMessageIds: [input.messageId],
          channel: input.channel,
        });
      } catch (error) {
        await this.recordRuntimeEvent({
          eventType: "owner_chat_state_failed",
          source: "owner_chat_llm",
          summary:
            error instanceof Error
              ? `LLM statePatch 失败：${error.message.slice(0, 180)}`
              : "LLM statePatch 失败。",
          importance: 70,
          topic: "运行态更新失败",
          userId: input.userId,
          conversationId: input.conversationId,
          messageId: input.messageId,
          channel: input.channel,
          status: "failed",
        });
      }
      return;
    }

    const patch = deriveRuntimeStatePatch(state, input);
    await this.applyPatch({
      patch,
      eventType: "owner_chat_state_rules",
      source: "owner_chat_rules",
      summary: summarizePatch(patch),
      userId: input.userId,
      conversationId: input.conversationId,
      sourceRuntimeEventIds: [recordedEvent.id],
      sourceMessageIds: [input.messageId],
      channel: input.channel,
    });
  },
};
