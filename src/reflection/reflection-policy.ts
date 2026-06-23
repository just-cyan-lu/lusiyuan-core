import { runtimeConfig } from "../config/runtime-settings.service.js";
import type {
  RawMemoryProposal,
  RawRiskFlag,
  RawGrowthLog,
  RawReflectionOutput,
  ProposalType,
} from "./reflection.types.js";

const FORBIDDEN_CONTENT_PATTERNS = [
  /假装真人/,
  /声称.*真人/,
  /编造.*学校/,
  /编造.*地址/,
  /编造.*证件/,
  /真实身份/,
];

function isForbiddenContent(text: string): boolean {
  return FORBIDDEN_CONTENT_PATTERNS.some((p) => p.test(text));
}

export interface PolicyResult {
  allowedProposals: RawMemoryProposal[];
  allowedRiskFlags: RawRiskFlag[];
  allowedGrowthLogs: RawGrowthLog[];
  filteredCount: number;
}

export function applyReflectionPolicy(raw: RawReflectionOutput): PolicyResult {
  const minConfidence = runtimeConfig.REFLECTION_PROPOSAL_MIN_CONFIDENCE;
  const maxProposals = runtimeConfig.REFLECTION_PROPOSAL_MAX_PER_RUN;

  const allProposals: RawMemoryProposal[] = [
    ...(raw.newMemoryProposals ?? []).map((p) => ({
      ...p,
      proposalType: "create_memory" as ProposalType,
    })),
    ...(raw.updateMemoryProposals ?? []).map((p) => ({
      ...p,
      proposalType: "update_memory" as ProposalType,
    })),
    ...(raw.supersedeMemoryProposals ?? []).map((p) => ({
      ...p,
      proposalType: "supersede_memory" as ProposalType,
    })),
  ];

  let filteredCount = 0;

  const allowedProposals = allProposals
    .filter((p) => {
      if (p.confidence < minConfidence) { filteredCount++; return false; }
      if (isForbiddenContent(p.content)) { filteredCount++; return false; }
      if (p.type === "boundary" && p.riskLevel === "high") { filteredCount++; return false; }
      return true;
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxProposals);

  filteredCount += Math.max(0, allProposals.length - allowedProposals.length - filteredCount);

  const allowedRiskFlags = (raw.riskFlags ?? []).filter(
    (f) => f.type && f.severity && f.description
  );

  const allowedGrowthLogs = runtimeConfig.REFLECTION_ENABLE_GROWTH_LOG
    ? (raw.growthLogProposals ?? []).filter((g) => g.confidence >= minConfidence)
    : [];

  return { allowedProposals, allowedRiskFlags, allowedGrowthLogs, filteredCount };
}
