import type { Memory } from "@prisma/client";

export type MemoryTier = "temp" | "short" | "mid" | "long";

export interface MemoryReinforcementInput {
  existing?: Pick<
    Memory,
    | "tier"
    | "tierMentionCount"
    | "tierEnteredAt"
    | "mentionDayKeys"
    | "lastMentionedAt"
    | "scope"
  > | null;
  scope?: string | null;
  proposedTier?: string | null;
  forceTier?: boolean;
  sourceDayKeys?: string[] | null;
  lastMentionedAt?: Date | null;
  now?: Date;
}

export interface MemoryReinforcementResult {
  tier: MemoryTier;
  tierMentionCount: number;
  tierEnteredAt: Date | null;
  mentionDayKeys: string[];
  lastMentionedAt: Date | null;
}

export interface MemoryAgingInput {
  now?: Date;
  activeDayCountSinceWindowStart?: number | null;
}

export interface MemoryAgingPatch {
  tier?: MemoryTier;
  tierMentionCount?: number;
  tierEnteredAt?: Date | null;
  status?: "active" | "archived";
  reason: string;
}

const tierPromotionThresholds: Partial<Record<MemoryTier, number>> = {
  temp: 1,
  short: 5,
  mid: 5,
};

const tierWindowActiveDays: Record<MemoryTier, number> = {
  temp: 5,
  short: 10,
  mid: 60,
  long: 365,
};

const nextTier: Partial<Record<MemoryTier, MemoryTier>> = {
  temp: "short",
  short: "mid",
  mid: "long",
};

const agingFallbackTier: Partial<Record<MemoryTier, MemoryTier>> = {
  short: "temp",
  mid: "short",
  long: "mid",
};

export function normalizeMemoryTier(value: unknown): MemoryTier {
  if (value === "short" || value === "mid" || value === "long") return value;
  return "temp";
}

export function dayKeyFromDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) result.push(item.trim());
  }
  return Array.from(new Set(result)).sort();
}

export function mergeDayKeys(...values: Array<unknown>): string[] {
  const result = new Set<string>();
  for (const value of values) {
    for (const item of getStringArray(value)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(item)) result.add(item);
    }
  }
  return Array.from(result).sort();
}

function clampMentionCount(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function clampActiveDayCount(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.floor(parsed));
}

function latestDate(...dates: Array<Date | null | undefined>): Date | null {
  return dates.reduce<Date | null>((latest, date) => {
    if (!date) return latest;
    if (!latest || date > latest) return date;
    return latest;
  }, null);
}

function effectiveNewDayKeys(existingDayKeys: string[], sourceDayKeys: string[]): string[] {
  const seen = new Set(existingDayKeys);
  return sourceDayKeys.filter((dayKey) => !seen.has(dayKey));
}

function enteredAtFor(existing: MemoryReinforcementInput["existing"], now: Date): Date | null {
  return existing?.tierEnteredAt ?? existing?.lastMentionedAt ?? now;
}

export function buildMemoryReinforcement(
  input: MemoryReinforcementInput
): MemoryReinforcementResult {
  const now = input.now ?? new Date();
  const scope = input.scope ?? input.existing?.scope ?? "person";
  const existingTier = normalizeMemoryTier(input.existing?.tier);
  const proposedTier = normalizeMemoryTier(input.proposedTier);
  const existingDayKeys = getStringArray(input.existing?.mentionDayKeys);
  const sourceDayKeys = mergeDayKeys(input.sourceDayKeys);
  const newDayKeys = effectiveNewDayKeys(existingDayKeys, sourceDayKeys);
  const mentionDayKeys = mergeDayKeys(existingDayKeys, sourceDayKeys);
  const newMentionCount = input.existing ? newDayKeys.length : 0;
  const hasNewMention = newDayKeys.length > 0 || !input.existing;
  const lastMentionedAt = hasNewMention
    ? latestDate(input.existing?.lastMentionedAt, input.lastMentionedAt, now)
    : input.existing?.lastMentionedAt ?? null;

  if (scope !== "person") {
    return {
      tier: proposedTier,
      tierMentionCount: clampMentionCount(input.existing?.tierMentionCount),
      tierEnteredAt: input.existing?.tierEnteredAt ?? null,
      mentionDayKeys,
      lastMentionedAt,
    };
  }

  const previousCount = input.existing
    ? clampMentionCount(input.existing.tierMentionCount)
    : 0;

  if (input.forceTier) {
    const forcedTier = proposedTier;
    const changedTier = forcedTier !== existingTier;
    const tierMentionCount = changedTier ? 0 : previousCount + newMentionCount;
    const tierEnteredAt = changedTier ? now : enteredAtFor(input.existing, now);
    return {
      tier: forcedTier,
      tierMentionCount,
      tierEnteredAt,
      mentionDayKeys,
      lastMentionedAt,
    };
  }

  let tier = input.existing ? existingTier : "temp";
  let tierMentionCount = previousCount + newMentionCount;
  let tierEnteredAt = enteredAtFor(input.existing, now);

  const threshold = tierPromotionThresholds[tier];
  if (threshold !== undefined && tierMentionCount >= threshold) {
    tier = nextTier[tier] ?? tier;
    tierMentionCount = 0;
    tierEnteredAt = lastMentionedAt ?? now;
  }

  return {
    tier,
    tierMentionCount,
    tierEnteredAt,
    mentionDayKeys,
    lastMentionedAt,
  };
}

export function buildMemoryAgingPatch(
  memory: Pick<
    Memory,
    | "scope"
    | "status"
    | "tier"
    | "tierMentionCount"
    | "tierEnteredAt"
    | "lastMentionedAt"
  >,
  input: MemoryAgingInput = {}
): MemoryAgingPatch | null {
  if (memory.scope !== "person" || memory.status !== "active") return null;
  const now = input.now ?? new Date();
  const tier = normalizeMemoryTier(memory.tier);
  const activeDayCount = clampActiveDayCount(input.activeDayCountSinceWindowStart);
  const windowActiveDays = tierWindowActiveDays[tier];
  if (activeDayCount === null || activeDayCount < windowActiveDays) return null;

  if (tier === "temp") {
    return {
      status: "archived",
      tierMentionCount: 0,
      tierEnteredAt: memory.tierEnteredAt ?? memory.lastMentionedAt ?? now,
      reason: "临时记忆在 5 个活跃聊天日内没有再次有效提及，自动归档。",
    };
  }

  const fallbackTier = agingFallbackTier[tier];
  if (!fallbackTier) return null;

  return {
    tier: fallbackTier,
    tierMentionCount: 0,
    tierEnteredAt: now,
    reason:
      tier === "long"
        ? "长期记忆在 365 个活跃聊天日内没有再次有效提及，自动降为中期。"
        : tier === "mid"
          ? "中期记忆在 60 个活跃聊天日内没有再次有效提及，自动降为短期。"
          : "短期记忆在 10 个活跃聊天日内没有再次有效提及，自动降为临时。",
  };
}
