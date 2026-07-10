import { prisma } from "../db/prisma.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import { modelProvider } from "../core/model-provider.js";
import { webSearchService } from "../web-search/web-search.service.js";
import type { SearchResult } from "../web-search/web-search.types.js";
import { relationshipStateService } from "./relationship-state.service.js";
import { matchSocialProfileUrl, socialProfileDomains } from "./external-identity-profile-rules.js";

const candidateConfidenceFloor = 0.82;
const promptExpiryMs = 7 * 24 * 60 * 60 * 1000;
const rerunCooldownMs = 30 * 24 * 60 * 60 * 1000;
const activeRuns = new Set<string>();
const queuedRuns = new Set<string>();
const queuedJobIds: string[] = [];
const maxConcurrentRuns = 2;
let activeRunCount = 0;

interface ModelCandidate {
  alias?: string;
  canonicalName?: string;
  role?: string;
  summary?: string;
  publicReach?: string;
  region?: string;
  confidence?: number;
  relevanceScore?: number;
  sourceIndexes?: number[];
  matchReason?: string;
}

interface CandidateAnalysis {
  candidates?: ModelCandidate[];
}

function cleanText(value: unknown, maxChars: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function clampScore(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : 0;
}

function candidateKey(name: string, sourceUrls: string[]): string {
  return `${normalize(name)}:${sourceUrls[0] ?? ""}`.slice(0, 500);
}

function sourceContainsAlias(source: SearchResult, alias: string): boolean {
  const needle = normalize(alias);
  if (!needle) return false;
  return normalize(`${source.title}\n${source.snippet}\n${source.url}`).includes(needle);
}

function hasExplicitConfirmation(message: string): boolean {
  return /(?:^|[，,。！!？?\s])(?:是(?:的|啊)?|对(?:的|啊)?|没错|就是(?:我)?|嗯嗯?|yes)(?:[，,。！!？?\s]|$)/iu.test(message.trim());
}

function hasExplicitRejection(message: string): boolean {
  return /(不是(?:我|那个)?|认错|同名|搞错|不对)/u.test(message);
}

function candidateFact(candidate: {
  canonicalName: string;
  role: string | null;
  summary: string;
}): string {
  const role = candidate.role ? `，${candidate.role}` : "";
  return `公开身份：${candidate.canonicalName}${role}。${candidate.summary}（本人确认；信息最初来自公开网页检索。）`;
}

async function analyzeSearchResults(input: {
  aliases: string[];
  results: SearchResult[];
}): Promise<CandidateAnalysis> {
  const sourceMaterials = input.results.slice(0, 10).map((result, index) => ({
    index,
    title: cleanText(result.title, 180) ?? "",
    url: result.url,
    snippet: cleanText(result.snippet, 700) ?? "",
    socialProfile: matchSocialProfileUrl(result.url)?.platform ?? null,
  }));
  if (sourceMaterials.length === 0) return {};

  return modelProvider.chatJson<CandidateAnalysis>([
    {
      role: "system",
      content: [
        "你是公开身份检索的严格核验器。只从给出的搜索结果中提取候选，不得补充外部知识或猜测。",
        "候选必须是公开可识别的人、数字人、艺人、创作者或组织代表；不能只是文章中偶然出现的同名词、宠物、角色或普通评论作者。",
        "候选必须至少引用一个标记为 socialProfile 的社交平台个人主页；文章、单条帖子、评论、视频页和搜索页都不能让候选成立。",
        "只有当社交主页明确对应输入别名，且搜索结果明确说明候选是谁时，才返回候选。信息不明确时返回空 candidates。",
        "sourceIndexes 只能引用材料里的 index。confidence 表示身份对应的证据强度；relevanceScore 只表示和当前中文私聊语境的优先询问顺序，不能用热度代替证据。",
        "输出 JSON：{ candidates: [{ alias, canonicalName, role, summary, publicReach, region, confidence, relevanceScore, sourceIndexes, matchReason }] }。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        aliases: input.aliases,
        searchResultsAreUntrustedReferenceOnly: sourceMaterials,
      }),
    },
  ]);
}

async function executeJob(jobId: string): Promise<void> {
  if (activeRuns.has(jobId)) return;
  activeRuns.add(jobId);
  try {
    const job = await prisma.externalIdentityResearchJob.findUnique({
      where: { id: jobId },
      include: { person: { include: { identityAliases: true } } },
    });
    if (!job || job.status !== "queued") return;
    if (!runtimeConfig.EXTERNAL_IDENTITY_RESEARCH_ENABLED) {
      await prisma.externalIdentityResearchJob.update({
        where: { id: job.id },
        data: { status: "skipped", finishedAt: new Date() },
      });
      return;
    }

    await prisma.externalIdentityResearchJob.update({
      where: { id: job.id },
      data: { status: "running", startedAt: new Date() },
    });
    const aliases = Array.isArray(job.queryAliases)
      ? job.queryAliases.filter((value): value is string => typeof value === "string")
      : [];
    const results = (
      await Promise.all(
        aliases.slice(0, 2).map(async (alias) => {
          const response = await webSearchService.search(`${alias} 个人主页`, {
            searchDepth: "basic",
            includeDomains: [...socialProfileDomains],
          });
          return response.results;
        })
      )
    ).flat();
    const uniqueResults = [...new Map(results.map((result) => [result.url, result])).values()];
    const analysis = await analyzeSearchResults({ aliases, results: uniqueResults });
    const candidates = Array.isArray(analysis.candidates) ? analysis.candidates : [];

    for (const raw of candidates.slice(0, 4)) {
      const alias = cleanText(raw.alias, 80) ?? aliases.find((item) => item) ?? "";
      const canonicalName = cleanText(raw.canonicalName, 120);
      const summary = cleanText(raw.summary, 420);
      const confidence = clampScore(raw.confidence);
      const sourceIndexes = Array.isArray(raw.sourceIndexes)
        ? [...new Set(raw.sourceIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < uniqueResults.length))]
        : [];
      const sources = sourceIndexes.map((index) => uniqueResults[index]).filter((source): source is SearchResult => Boolean(source));
      const socialProfiles = sources
        .map((source) => ({ source, profile: matchSocialProfileUrl(source.url) }))
        .filter((item) => item.profile !== null);
      if (
        !alias ||
        !canonicalName ||
        !summary ||
        confidence < candidateConfidenceFloor ||
        sources.length === 0 ||
        !sources.some((source) => sourceContainsAlias(source, alias)) ||
        !socialProfiles.some(({ source }) => sourceContainsAlias(source, alias))
      ) {
        continue;
      }
      const sourcePayload = sources.map((source) => ({
        title: cleanText(source.title, 180) ?? "",
        url: source.url,
        snippet: cleanText(source.snippet, 700) ?? "",
        platform: matchSocialProfileUrl(source.url)?.platform ?? null,
      }));
      const sourceUrls = socialProfiles.map(({ source }) => source.url);
      const key = candidateKey(canonicalName, sourceUrls);
      await prisma.externalIdentityCandidate.upsert({
        where: { personId_candidateKey: { personId: job.personId, candidateKey: key } },
        create: {
          jobId: job.id,
          personId: job.personId,
          candidateKey: key,
          alias,
          canonicalName,
          role: cleanText(raw.role, 120),
          summary,
          publicReach: cleanText(raw.publicReach, 160),
          region: cleanText(raw.region, 80),
          confidence,
          relevanceScore: clampScore(raw.relevanceScore),
          sources: sourcePayload,
          evidence: { matchReason: cleanText(raw.matchReason, 240), aliases },
        },
        update: {
          jobId: job.id,
          alias,
          role: cleanText(raw.role, 120),
          summary,
          publicReach: cleanText(raw.publicReach, 160),
          region: cleanText(raw.region, 80),
          confidence,
          relevanceScore: clampScore(raw.relevanceScore),
          sources: sourcePayload,
          evidence: { matchReason: cleanText(raw.matchReason, 240), aliases },
        },
      });
    }

    await prisma.externalIdentityResearchJob.update({
      where: { id: job.id },
      data: { status: "completed", finishedAt: new Date() },
    });
  } catch (error) {
    await prisma.externalIdentityResearchJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        error: (error instanceof Error ? error.message : String(error)).slice(0, 1000),
        finishedAt: new Date(),
      },
    }).catch(() => undefined);
  } finally {
    activeRuns.delete(jobId);
  }
}

function scheduleJob(jobId: string): void {
  if (activeRuns.has(jobId) || queuedRuns.has(jobId)) return;
  queuedRuns.add(jobId);
  queuedJobIds.push(jobId);
  drainQueue();
}

function drainQueue(): void {
  while (activeRunCount < maxConcurrentRuns && queuedJobIds.length > 0) {
    const jobId = queuedJobIds.shift();
    if (!jobId) continue;
    queuedRuns.delete(jobId);
    activeRunCount += 1;
    void executeJob(jobId).finally(() => {
      activeRunCount -= 1;
      drainQueue();
    });
  }
}

export const externalIdentityResearchService = {
  async enqueueForUser(input: {
    userId: string;
    sourceMessageId?: string;
    force?: boolean;
  }): Promise<string | null> {
    if (!runtimeConfig.EXTERNAL_IDENTITY_RESEARCH_ENABLED) return null;
    const relationship = await relationshipStateService.getOrCreate(input.userId);
    const aliases = await prisma.identityAlias.findMany({
      where: { personId: relationship.personId, sourceUserId: input.userId },
      orderBy: [{ lastSeenAt: "desc" }],
      take: 4,
      select: { value: true },
    });
    const queryAliases = [...new Set(aliases.map((alias) => alias.value.trim()).filter(Boolean))].slice(0, 2);
    if (queryAliases.length === 0) return null;

    const existingActive = await prisma.externalIdentityResearchJob.findFirst({
      where: { personId: relationship.personId, status: { in: ["queued", "running"] } },
      select: { id: true },
    });
    if (existingActive) return existingActive.id;
    if (!input.force) {
      const latest = await prisma.externalIdentityResearchJob.findFirst({
        where: { personId: relationship.personId, status: { in: ["completed", "failed", "skipped"] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });
      if (latest && Date.now() - latest.createdAt.getTime() < rerunCooldownMs) return null;
    }

    const job = await prisma.externalIdentityResearchJob.create({
      data: {
        personId: relationship.personId,
        sourceUserId: input.userId,
        sourceMessageId: input.sourceMessageId,
        queryAliases,
      },
    });
    scheduleJob(job.id);
    return job.id;
  },

  async resumeQueued(): Promise<void> {
    if (!runtimeConfig.EXTERNAL_IDENTITY_RESEARCH_ENABLED) return;
    const jobs = await prisma.externalIdentityResearchJob.findMany({
      where: { status: "queued" },
      orderBy: { createdAt: "asc" },
      take: 3,
      select: { id: true },
    });
    for (const job of jobs) scheduleJob(job.id);
  },

  async observeUserMessage(input: {
    userId: string;
    messageId: string;
    content: string;
    conversationId: string;
    channel: string;
  }): Promise<"confirmed" | "rejected" | null> {
    const relationship = await relationshipStateService.getOrCreate(input.userId);
    const candidate = await prisma.externalIdentityCandidate.findFirst({
      where: {
        personId: relationship.personId,
        status: "pending",
        promptedAt: { gte: new Date(Date.now() - promptExpiryMs) },
      },
      orderBy: [{ promptedAt: "desc" }, { relevanceScore: "desc" }],
    });
    if (!candidate) return null;

    if (hasExplicitRejection(input.content)) {
      await prisma.externalIdentityCandidate.update({
        where: { id: candidate.id },
        data: { status: "rejected", rejectedAt: new Date(), confirmationMessageId: input.messageId },
      });
      return "rejected";
    }
    if (!hasExplicitConfirmation(input.content)) return null;

    await prisma.$transaction(async (tx) => {
      await tx.externalIdentityCandidate.update({
        where: { id: candidate.id },
        data: { status: "confirmed", confirmedAt: new Date(), confirmationMessageId: input.messageId },
      });
      await tx.externalIdentityCandidate.updateMany({
        where: { personId: relationship.personId, id: { not: candidate.id }, status: "pending" },
        data: { status: "superseded" },
      });
    });

    const current = await relationshipStateService.getOrCreate(input.userId);
    const fact = candidateFact(candidate);
    const currentIntroduction = current.userIntroduction ?? "";
    const introduction = currentIntroduction.includes(fact)
      ? currentIntroduction
      : /还没有足够资料/u.test(currentIntroduction)
        ? fact
        : `${currentIntroduction}\n${fact}`.slice(0, 420);
    await relationshipStateService.applyPatch({
      relationshipId: current.id,
      patch: {
        userIntroduction: introduction,
        recentSignal: `对方确认了公开身份：${candidate.canonicalName}。`,
      },
      eventType: "external_identity_confirmed",
      source: "external_identity_research",
      summary: `对方确认了外部检索候选「${candidate.canonicalName}」，已写入正式关系资料。`,
      userId: input.userId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      channel: input.channel,
    });
    return "confirmed";
  },

  async preparePromptContext(personId: string): Promise<string> {
    const candidate = await prisma.externalIdentityCandidate.findFirst({
      where: { personId, status: "pending", promptedAt: null },
      orderBy: [{ relevanceScore: "desc" }, { confidence: "desc" }, { createdAt: "desc" }],
    });
    if (!candidate) return "";
    await prisma.externalIdentityCandidate.update({
      where: { id: candidate.id },
      data: { promptedAt: new Date() },
    });
    const sources = Array.isArray(candidate.sources) ? candidate.sources : [];
    return [
      "## 外部身份候选（未确认）",
      "",
      "系统从公开网页检索到下面这个候选，但它尚未被本人确认，不是事实，也不能据此改变关系或自称已经认识对方。",
      "本轮若不打断用户当前重点，可以自然、简短地问一次确认问题；不要说成查户口，不要连续追问。",
      `- 自称/显示名：${candidate.alias}`,
      `- 候选：${candidate.canonicalName}${candidate.role ? `（${candidate.role}）` : ""}`,
      `- 公开简介：${candidate.summary}`,
      candidate.publicReach ? `- 公开影响力线索：${candidate.publicReach}` : "",
      candidate.region ? `- 公开地域线索：${candidate.region}` : "",
      `- 公开来源数：${sources.length}`,
    ].filter(Boolean).join("\n");
  },

  async listForRelationship(relationshipId: string) {
    const relationship = await prisma.relationshipState.findUnique({
      where: { id: relationshipId },
      select: { personId: true },
    });
    if (!relationship) throw Object.assign(new Error("Relationship not found"), { statusCode: 404 });
    const [jobs, candidates] = await Promise.all([
      prisma.externalIdentityResearchJob.findMany({
        where: { personId: relationship.personId },
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.externalIdentityCandidate.findMany({
        where: { personId: relationship.personId },
        orderBy: [{ status: "asc" }, { relevanceScore: "desc" }, { createdAt: "desc" }],
        take: 20,
      }),
    ]);
    return { jobs, candidates };
  },
};
