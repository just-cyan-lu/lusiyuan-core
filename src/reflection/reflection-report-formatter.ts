import { modelProvider } from "../core/model-provider.js";
import type { RawReflectionOutput } from "./reflection.types.js";
import { buildReflectionPrompt } from "./reflection.prompt.js";
import type { ReflectionContext } from "./reflection.types.js";

export async function runReflectionAnalysis(
  context: ReflectionContext
): Promise<RawReflectionOutput> {
  const prompt = buildReflectionPrompt(context);

  const raw = await modelProvider.chatJson<Partial<RawReflectionOutput>>([
    { role: "system", content: "你是陆思源复盘员，只输出 JSON，不输出任何其他内容。" },
    { role: "user", content: prompt },
  ]);

  return {
    summary: raw.summary ?? "（无摘要）",
    newMemoryProposals: raw.newMemoryProposals ?? [],
    updateMemoryProposals: raw.updateMemoryProposals ?? [],
    supersedeMemoryProposals: raw.supersedeMemoryProposals ?? [],
    riskFlags: raw.riskFlags ?? [],
    growthLogProposals: raw.growthLogProposals ?? [],
    openQuestions: raw.openQuestions ?? [],
    confidence: raw.confidence ?? 0.5,
  };
}
