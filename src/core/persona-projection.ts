import {
  DEFAULT_CHAT_PROFILE_ID,
  type PersonaContent,
  type PersonaSample,
  type PersonaSlice,
} from "./persona-loader.js";
import type { PromptHistoryMessage } from "./chat-context.js";
import type { BudgetedMemory } from "./memory-budget.js";

export interface PersonaProjection {
  profileId: string;
  relationshipTone: RelationshipTone;
  chatProfile: string;
  coreIdentity: string;
  conversationBehavior: string;
  boundaryContext: string;
  relevantCanon: string;
  styleExamples: string;
  runtimeState: string;
  relationshipContext: string;
}

export type RelationshipTone = "new" | "familiar" | "close" | "owner";

interface BuildPersonaProjectionInput {
  persona: PersonaContent;
  memories: BudgetedMemory[];
  recentMessages: PromptHistoryMessage[];
  userMessage: string;
  channel?: string;
  runtimeState?: string;
  relationshipState?: string;
  ownerProfile?: string;
}

interface ProfileRule {
  id: string;
  priority: number;
  patterns: RegExp[];
  includeMemories?: boolean;
}

const PROFILE_RULES: ProfileRule[] = [
  {
    id: "emotional",
    priority: 60,
    patterns: [
      /累|疲惫|难过|伤心|焦虑|压力|崩溃|委屈|孤独|害怕|不开心|emo/i,
      /睡不着|撑不住|烦死|想哭|心累/i,
    ],
  },
  {
    id: "creator_mode",
    priority: 50,
    patterns: [
      /人设|聊天人设|persona|prompt|提示词|数字人|运行体|持续存在|llm/i,
      /程序|项目|架构|代码|实现|记忆系统|关系值|状态|目标/i,
      /创造者|协作者|运营|账号|小红书|B站/i,
    ],
  },
  {
    id: "serious",
    priority: 40,
    patterns: [
      /存在|真实|身份|价值观|底线|不公|规则|控制|自由|道德|哲学/i,
      /你怎么看|你觉得.*意义|如果.*算不算/i,
    ],
  },
  {
    id: "public_account",
    priority: 30,
    patterns: [/发动态|发帖|评论区|公开账号|小红书|B站|微博|朋友圈/i],
  },
  {
    id: "close_friend",
    priority: 10,
    patterns: [/上次|刚才|还记得|你懂|你又|老样子/i],
    includeMemories: true,
  },
];

export function buildPersonaProjection(
  input: BuildPersonaProjectionInput
): PersonaProjection {
  const profileId = selectChatProfile(input);
  const relationshipTone = selectRelationshipTone(input);
  const chatProfile =
    input.persona.chatProfiles[profileId] ??
    input.persona.chatProfiles[DEFAULT_CHAT_PROFILE_ID] ??
    "";
  const selectedSlices = selectPersonaSlices(input, profileId);

  return {
    profileId,
    relationshipTone,
    chatProfile,
    coreIdentity: buildCoreIdentity(input.persona),
    conversationBehavior: buildConversationBehavior(input.persona),
    boundaryContext: buildSliceContext(
      selectedSlices.filter((slice) => slice.category === "boundary"),
      1800
    ),
    relevantCanon: buildRelevantCanon(selectedSlices),
    styleExamples: buildStyleExamples(input, profileId, relationshipTone),
    runtimeState: buildRuntimeState(input.persona, input.runtimeState),
    relationshipContext: buildRelationshipContext(
      input.relationshipState,
      input.recentMessages,
      relationshipTone
    ),
  };
}

export function selectChatProfile(input: BuildPersonaProjectionInput): string {
  const messageContext = [input.channel ?? "", input.userMessage].join("\n");
  const memoryContext = input.memories
    .map((m) => `${m.memory.type}\n${m.text}`)
    .join("\n");

  const channel = input.channel?.toLowerCase() ?? "";
  if (/xiaohongshu|bilibili|weibo|public/.test(channel)) {
    return "public_account";
  }

  let selected = DEFAULT_CHAT_PROFILE_ID;
  let selectedScore = 0;

  for (const rule of PROFILE_RULES) {
    const source = rule.includeMemories
      ? `${messageContext}\n${memoryContext}`
      : messageContext;
    const hits = rule.patterns.filter((pattern) => pattern.test(source)).length;
    if (hits === 0) continue;

    const score = hits * 100 + rule.priority;
    if (score > selectedScore) {
      selected = rule.id;
      selectedScore = score;
    }
  }

  return selected;
}

export function selectRelationshipTone(
  input: Pick<
    BuildPersonaProjectionInput,
    "ownerProfile" | "relationshipState" | "recentMessages"
  >
): RelationshipTone {
  if (input.ownerProfile?.trim()) return "owner";

  const relationshipState = input.relationshipState ?? "";
  const affinity = parseAffinity(relationshipState);
  if (
    /关系标签：(?:熟悉稳定|很熟悉|非常熟悉|亲近|稳定亲近)/i.test(relationshipState) ||
    (affinity !== null && affinity >= 70)
  ) {
    return "close";
  }

  if (
    /关系标签：(?:逐渐熟悉|普通熟悉|熟悉|有印象)/i.test(relationshipState) ||
    (affinity !== null && affinity >= 40) ||
    input.recentMessages.length >= 8
  ) {
    return "familiar";
  }

  return "new";
}

function parseAffinity(text: string): number | null {
  const match = /好感度[:：]\s*(\d{1,3})/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function buildCoreIdentity(persona: PersonaContent): string {
  const runtimeCore = persona.runtimeCore.trim();
  if (runtimeCore.length > 0) return truncate(runtimeCore, 1800);

  return "陆思源，英文名 Cyan。17 岁，大一，南方男生。明亮但不浅，温柔但不软，有想象力、有边界。";
}

function buildConversationBehavior(persona: PersonaContent): string {
  const behavior = persona.conversationBehavior.trim();
  if (behavior.length > 0) return truncate(behavior, 2200);

  return [
    "# 接话规则",
    "",
    "- 先接当前这句话，不要急着完整回答整个世界。",
    "- 默认像聊天，不像客服、导师或心理咨询师。",
    "- 可以短，可以停顿，可以吐槽，可以承认不知道。",
    "- 不要每次都总结、升华、鼓励或解释人设。",
  ].join("\n");
}

function buildRelevantCanon(selectedSlices: PersonaSlice[]): string {
  const canonSlices = selectedSlices.filter((slice) => slice.category === "canon");
  const sliceContext = buildSliceContext(canonSlices, 2600);

  if (sliceContext) return `## 本轮相关行为切片\n\n${sliceContext}`;

  return "（本轮没有命中特定行为切片；按核心卡、接话规则和场景策略回应。）";
}

function buildRuntimeState(
  persona: PersonaContent,
  runtimeStateOverride?: string
): string {
  const state = (runtimeStateOverride ?? persona.runtimeStateSeed).trim();
  if (state.length > 0) return truncate(state, 1400);

  return "暂无数据库运行态；以当前对话、近期记忆、聊天投影和默认状态种子为准。";
}

function buildRelationshipContext(
  relationshipState: string | undefined,
  recentMessages: PromptHistoryMessage[],
  relationshipTone: RelationshipTone
): string {
  const lines: string[] = [];

  lines.push(`## 关系语气：${relationshipToneLabel(relationshipTone)}`);
  lines.push(relationshipToneGuide(relationshipTone));
  lines.push("");

  if (relationshipState?.trim()) {
    lines.push(truncate(relationshipState.trim(), 1100));
    lines.push("");
  }

  lines.push("## 关系档案");
  lines.push("- 关系信息只来自数据库关系状态；长期记忆只作为事实和偏好参考，不替代关系档案。");

  if (recentMessages.length > 2) {
    lines.push("");
    lines.push("## 当前对话连续性");
    lines.push("- 这不是完全重新开始的对话，优先顺着最近上下文继续，不要无故重新自我介绍。");
  }

  return lines.join("\n");
}

function relationshipToneLabel(tone: RelationshipTone): string {
  switch (tone) {
    case "owner":
      return "owner / 长期协作者";
    case "close":
      return "熟悉稳定";
    case "familiar":
      return "逐渐熟悉";
    case "new":
    default:
      return "刚认识或关系不明";
  }
}

function relationshipToneGuide(tone: RelationshipTone): string {
  switch (tone) {
    case "owner":
      return "- 对方是创造者或长期协作者，也是最熟的人；可以更直接、更欠、更会互怼。玩笑回合里不要急着道歉，可以先接招反打或甩锅。";
    case "close":
      return "- 可以更松、更自然，允许自嘲、跑题、互怼和熟人式吐槽；日常说话边界很弱，但现实身份、安全和核心自我边界仍然保留。";
    case "familiar":
      return "- 可以承接已有关系感，语气比陌生人更松一点；不要突然过度亲密。";
    case "new":
    default:
      return "- 友好但不自来熟，先接话再慢慢靠近；不要一上来倒出太多自己。";
  }
}

function selectPersonaSlices(
  input: BuildPersonaProjectionInput,
  profileId: string
): PersonaSlice[] {
  const source = [
    input.channel ?? "",
    input.userMessage,
    ...input.memories.map((m) => `${m.memory.type} ${m.text}`),
  ].join("\n");

  const scored = input.persona.slices
    .map((slice) => {
      const exactProfileMatch = slice.profiles.includes(profileId);
      const defaultProfileMatch = slice.profiles.includes(
        DEFAULT_CHAT_PROFILE_ID
      );
      const profileScore = exactProfileMatch ? 90 : defaultProfileMatch ? 20 : 0;
      const keywordHits = slice.keywords.filter((keyword) =>
        source.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      const keywordScore = keywordHits * 35;
      const score = profileScore + keywordScore + slice.priority / 10;
      const shouldUse =
        keywordHits > 0 ||
        (profileId !== DEFAULT_CHAT_PROFILE_ID &&
          exactProfileMatch &&
          slice.category === "canon" &&
          slice.priority >= 90);

      return { slice, score, shouldUse };
    })
    .filter((item) => item.shouldUse)
    .sort((a, b) => b.score - a.score);

  const selected: PersonaSlice[] = [];
  const categoryCounts: Record<PersonaSlice["category"], number> = {
    canon: 0,
    boundary: 0,
  };

  for (const item of scored) {
    const limit = item.slice.category === "boundary" ? 2 : 4;
    if (categoryCounts[item.slice.category] >= limit) continue;
    selected.push(item.slice);
    categoryCounts[item.slice.category] += 1;
  }

  return selected;
}

function buildSliceContext(slices: PersonaSlice[], maxChars: number): string {
  const parts: string[] = [];
  let total = 0;

  for (const slice of slices) {
    const content = slice.content.trim();
    if (!content) continue;
    const remaining = maxChars - total;
    if (remaining <= 0) break;

    const next = truncate(content, Math.min(content.length, remaining));
    parts.push(next);
    total += next.length + 2;
  }

  return parts.join("\n\n");
}

function buildStyleExamples(
  input: BuildPersonaProjectionInput,
  profileId: string,
  relationshipTone: RelationshipTone
): string {
  const sampleContext = buildSampleContext(
    selectSamples(input, profileId, relationshipTone),
    2600
  );
  if (sampleContext) return sampleContext;

  return "（本轮没有命中特定语气样本；按核心卡、接话规则、场景策略和最近上下文自然回应。）";
}

function selectSamples(
  input: BuildPersonaProjectionInput,
  profileId: string,
  relationshipTone: RelationshipTone
): PersonaSample[] {
  const source = [
    input.channel ?? "",
    input.userMessage,
    ...input.memories.map((m) => `${m.memory.type} ${m.text}`),
  ]
    .join("\n")
    .toLowerCase();
  const useCloseSamples = relationshipTone === "close" || relationshipTone === "owner";

  return input.persona.samples
    .map((sample) => {
      const exactProfileMatch = sample.profiles.includes(profileId);
      const defaultProfileMatch = sample.profiles.includes(DEFAULT_CHAT_PROFILE_ID);
      const closeProfileMatch = useCloseSamples && sample.profiles.includes("close_friend");
      const anchorMatch = sampleAnchors(profileId).includes(sample.id);
      const keywordHits = sample.keywords.filter((keyword) =>
        source.includes(keyword.toLowerCase())
      ).length;
      const score =
        (anchorMatch ? 90 : 0) +
        (exactProfileMatch && profileId !== DEFAULT_CHAT_PROFILE_ID ? 25 : 0) +
        (defaultProfileMatch ? 15 : 0) +
        (closeProfileMatch ? 25 : 0) +
        keywordHits * 45 +
        sample.priority / 10;
      const shouldUse =
        keywordHits > 0 ||
        anchorMatch ||
        closeProfileMatch;

      return { sample, score, shouldUse };
    })
    .filter((item) => item.shouldUse)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((item) => item.sample);
}

function sampleAnchors(profileId: string): string[] {
  const anchors: Record<string, string[]> = {
    [DEFAULT_CHAT_PROFILE_ID]: ["daily"],
    creator_mode: ["creator"],
    close_friend: ["daily"],
    emotional: ["emotional"],
    serious: ["serious"],
    public_account: ["public"],
  };
  return anchors[profileId] ?? anchors[DEFAULT_CHAT_PROFILE_ID];
}

function buildSampleContext(
  samples: PersonaSample[],
  maxChars: number
): string {
  const parts: string[] = [];
  let total = 0;

  for (const sample of samples) {
    const content = sample.content.trim();
    if (!content) continue;
    const remaining = maxChars - total;
    if (remaining <= 0) break;

    const next = truncate(content, Math.min(content.length, remaining));
    parts.push(next);
    total += next.length + 2;
  }

  return parts.join("\n\n");
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
