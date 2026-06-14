import type { Message } from "@prisma/client";
import {
  DEFAULT_CHAT_PROFILE_ID,
  type PersonaContent,
  type PersonaSlice,
} from "./persona-loader.js";
import type { BudgetedMemory } from "./memory-budget.js";

export interface PersonaProjection {
  profileId: string;
  chatProfile: string;
  coreIdentity: string;
  boundaryContext: string;
  relevantCanon: string;
  styleExamples: string;
  runtimeState: string;
  relationshipContext: string;
}

interface BuildPersonaProjectionInput {
  persona: PersonaContent;
  memories: BudgetedMemory[];
  recentMessages: Message[];
  userMessage: string;
  channel?: string;
  runtimeState?: string;
  relationshipState?: string;
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
  const chatProfile =
    input.persona.chatProfiles[profileId] ??
    input.persona.chatProfiles[DEFAULT_CHAT_PROFILE_ID] ??
    "";
  const selectedSlices = selectPersonaSlices(input, profileId);

  return {
    profileId,
    chatProfile,
    coreIdentity: buildCoreIdentity(input.persona),
    boundaryContext: buildSliceContext(
      selectedSlices.filter((slice) => slice.category === "boundary"),
      1800
    ),
    relevantCanon: buildRelevantCanon(input.persona, profileId, selectedSlices),
    styleExamples: buildStyleExamples(input.persona, profileId),
    runtimeState: buildRuntimeState(input.persona, input.runtimeState),
    relationshipContext: buildRelationshipContext(
      input.relationshipState,
      input.memories,
      input.recentMessages
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

  if (selected !== DEFAULT_CHAT_PROFILE_ID) return selected;

  if (/关系标签：(?:熟悉稳定|亲近且信任)|亲近感：[7-9]\d|信任度：[7-9]\d/i.test(input.relationshipState ?? "")) {
    return "close_friend";
  }

  const hasCloseRelationship = input.memories.some((m) => {
    const text = `${m.memory.type}\n${m.text}`;
    return (
      m.memory.type === "relationship" &&
      /熟|亲近|信任|创造者|协作者|朋友|共同/i.test(text)
    );
  });

  return hasCloseRelationship ? "close_friend" : DEFAULT_CHAT_PROFILE_ID;
}

function buildCoreIdentity(persona: PersonaContent): string {
  const runtimeCore = persona.runtimeCore.trim();
  if (runtimeCore.length > 0) return truncate(runtimeCore, 2600);

  return [
    truncate(persona.identity, 1400),
    "",
    "## 常驻核心记忆",
    truncate(persona.coreMemory, 1200),
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRelevantCanon(
  persona: PersonaContent,
  profileId: string,
  selectedSlices: PersonaSlice[]
): string {
  const languageBase = pickSections(persona.speakingStyle, ["核心原则", "节奏"], 1200);
  const canonSlices = selectedSlices.filter((slice) => slice.category === "canon");
  const sliceContext = buildSliceContext(canonSlices, 2600);

  return [
    languageBase ? `## 语言基底\n\n${languageBase}` : "",
    sliceContext ? `## 本轮相关人设\n\n${sliceContext}` : "",
    sliceContext ? "" : buildLegacyRelevantCanon(persona, profileId),
  ]
    .filter(Boolean)
    .join("\n\n");
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
  memories: BudgetedMemory[],
  recentMessages: Message[]
): string {
  const lines: string[] = [];
  const relationshipMemories = memories.filter(
    (m) => m.memory.type === "relationship"
  );

  if (relationshipState?.trim()) {
    lines.push(truncate(relationshipState.trim(), 1100));
    lines.push("");
  }

  if (relationshipMemories.length > 0) {
    lines.push("## 关系记忆");
    for (const memory of relationshipMemories.slice(0, 3)) {
      lines.push(`- ${memory.text}`);
    }
  } else {
    lines.push("## 关系记忆");
    lines.push("- 暂无明确关系状态；按自然、礼貌、慢热但不冷淡的方式相处。");
  }

  if (recentMessages.length > 2) {
    lines.push("");
    lines.push("## 当前对话连续性");
    lines.push("- 这不是完全重新开始的对话，优先顺着最近上下文继续，不要无故重新自我介绍。");
  }

  return lines.join("\n");
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
        (profileId !== DEFAULT_CHAT_PROFILE_ID && exactProfileMatch) ||
        (slice.category === "boundary" &&
          (exactProfileMatch || defaultProfileMatch));

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

function buildStyleExamples(persona: PersonaContent, profileId: string): string {
  const headingMap: Record<string, string[]> = {
    [DEFAULT_CHAT_PROFILE_ID]: ["刚认识", "有趣话题"],
    creator_mode: ["创意和项目", "边界"],
    close_friend: ["熟人", "情绪表达"],
    emotional: ["情绪表达"],
    serious: ["边界", "有趣话题"],
    public_account: ["有趣话题", "创意和项目"],
  };
  const headings = headingMap[profileId] ?? headingMap[DEFAULT_CHAT_PROFILE_ID];
  const examples = pickSections(persona.examples, headings, 1100);
  return examples || truncate(persona.examples, 900);
}

function buildLegacyRelevantCanon(
  persona: PersonaContent,
  profileId: string
): string {
  if (profileId === "serious") {
    return pickSections(persona.personality, ["冲突模式", "规则观和价值观"], 2000);
  }
  if (profileId === "emotional") {
    return pickSections(persona.personality, ["情感方式", "人际关系"], 2000);
  }
  if (profileId === "creator_mode") {
    return pickSections(persona.personality, ["认知方式", "创作能力"], 2000);
  }
  return pickSections(persona.personality, ["基础结论"], 1000);
}

function pickSections(
  markdown: string,
  headingIncludes: string[],
  maxChars: number
): string {
  const lines = markdown.split(/\r?\n/);
  const sections: string[] = [];

  for (const heading of headingIncludes) {
    const start = lines.findIndex((line) => {
      const parsed = parseHeading(line);
      return parsed !== null && parsed.text.includes(heading);
    });
    if (start === -1) continue;

    const currentHeading = parseHeading(lines[start]);
    if (!currentHeading) continue;

    let end = start + 1;
    while (end < lines.length) {
      const nextHeading = parseHeading(lines[end]);
      if (nextHeading && nextHeading.level <= currentHeading.level) break;
      end += 1;
    }

    sections.push(lines.slice(start, end).join("\n").trim());
  }

  return truncate(sections.join("\n\n"), maxChars);
}

function parseHeading(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.+)$/.exec(line.trim());
  if (!match) return null;
  return { level: match[1].length, text: match[2] };
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
