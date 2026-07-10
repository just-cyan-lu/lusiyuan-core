import type { ExpressionLearningRule } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../db/prisma.js";

export const EXPRESSION_RULES_PERSONA_PATH = "persona/expression_rules.md";
const expressionRulesAbsolutePath = path.resolve(process.cwd(), EXPRESSION_RULES_PERSONA_PATH);
const defaultExpressionRulesFile = `# 已发布表达规则

这里由表达学习管理页维护长期稳定的全局表达规则。不要在这里放具体题目、对话事实或仅适用于单一场景的回复样本。

<!-- expression-learning-managed-rules -->
`;

export type ExpressionLearningPublicationState =
  | "unpublished"
  | "synced"
  | "outdated"
  | "file_modified"
  | "missing";

export function hashExpressionLearningRuleBlock(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function ruleKindLabel(kind: string): string {
  return kind === "avoid" ? "避免" : kind === "prefer" ? "表达偏好" : "回复策略";
}

export function renderExpressionLearningRuleBlock(
  rule: Pick<ExpressionLearningRule, "id" | "ruleText" | "kind" | "strength">
): string {
  const strength = rule.strength === "hard" ? "必须遵守" : "尽量遵守";
  const text = rule.ruleText.replace(/\s+/g, " ").trim();
  return [
    `<!-- expression-rule:${rule.id} -->`,
    `- **${strength} · ${ruleKindLabel(rule.kind)}**：${text}`,
    `<!-- /expression-rule:${rule.id} -->`,
  ].join("\n");
}

function ruleBlockBounds(content: string, ruleId: string): { start: number; end: number } | null {
  const startMarker = `<!-- expression-rule:${ruleId} -->`;
  const endMarker = `<!-- /expression-rule:${ruleId} -->`;
  const start = content.indexOf(startMarker);
  if (start < 0) return null;
  const endStart = content.indexOf(endMarker, start + startMarker.length);
  if (endStart < 0) return null;
  return { start, end: endStart + endMarker.length };
}

export function extractExpressionLearningRuleBlock(content: string, ruleId: string): string | null {
  const bounds = ruleBlockBounds(content, ruleId);
  return bounds ? content.slice(bounds.start, bounds.end) : null;
}

export function upsertExpressionLearningRuleBlock(content: string, ruleId: string, block: string): string {
  const bounds = ruleBlockBounds(content, ruleId);
  if (bounds) return `${content.slice(0, bounds.start)}${block}${content.slice(bounds.end)}`;
  return `${content.trimEnd()}\n\n${block}\n`;
}

export function removeExpressionLearningRuleBlock(content: string, ruleId: string): string {
  const bounds = ruleBlockBounds(content, ruleId);
  if (!bounds) return content;
  return `${content.slice(0, bounds.start)}${content.slice(bounds.end)}`
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd() + "\n";
}

async function readExpressionRulesFile(): Promise<string | null> {
  try {
    return await readFile(expressionRulesAbsolutePath, "utf8");
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return null;
    throw error;
  }
}

async function writeExpressionRulesFile(content: string): Promise<void> {
  await mkdir(path.dirname(expressionRulesAbsolutePath), { recursive: true });
  const temporaryPath = `${expressionRulesAbsolutePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, "utf8");
  await rename(temporaryPath, expressionRulesAbsolutePath);
}

export function inspectExpressionLearningRulePublication(
  rule: Pick<ExpressionLearningRule,
    "id" | "ruleText" | "kind" | "strength" | "publishedAt" |
    "publishedPath" | "publishedContentHash">,
  fileContent: string | null
): { state: ExpressionLearningPublicationState; path: string | null } {
  if (!rule.publishedAt) return { state: "unpublished", path: null };
  if (!fileContent) return { state: "missing", path: rule.publishedPath };
  const actualBlock = extractExpressionLearningRuleBlock(fileContent, rule.id);
  if (!actualBlock) return { state: "missing", path: rule.publishedPath };
  const actualHash = hashExpressionLearningRuleBlock(actualBlock);
  if (!rule.publishedContentHash || actualHash !== rule.publishedContentHash) {
    return { state: "file_modified", path: rule.publishedPath };
  }
  const expectedHash = hashExpressionLearningRuleBlock(renderExpressionLearningRuleBlock(rule));
  return {
    state: expectedHash === rule.publishedContentHash ? "synced" : "outdated",
    path: rule.publishedPath,
  };
}

export async function attachExpressionLearningPublicationStates<T extends ExpressionLearningRule>(
  rules: T[]
): Promise<Array<T & { publication: { state: ExpressionLearningPublicationState; path: string | null } }>> {
  const fileContent = rules.some((rule) => rule.publishedAt)
    ? await readExpressionRulesFile()
    : null;
  return rules.map((rule) => ({
    ...rule,
    publication: inspectExpressionLearningRulePublication(rule, fileContent),
  }));
}

export async function publishExpressionLearningRule(ruleId: string, force = false) {
  const rule = await prisma.expressionLearningRule.findUniqueOrThrow({ where: { id: ruleId } });
  if (rule.status !== "active" || rule.scope !== "global") {
    throw Object.assign(new Error("只有已启用的全局规则可以发布到人设"), { statusCode: 400 });
  }
  const currentContent = await readExpressionRulesFile() ?? defaultExpressionRulesFile;
  const currentBlock = extractExpressionLearningRuleBlock(currentContent, rule.id);
  if (currentBlock && !force) {
    const currentHash = hashExpressionLearningRuleBlock(currentBlock);
    if (!rule.publishedContentHash || currentHash !== rule.publishedContentHash) {
      throw Object.assign(new Error("人设文件中的规则块已被人工修改，请确认后再覆盖"), { statusCode: 409 });
    }
  }
  const block = renderExpressionLearningRuleBlock(rule);
  await writeExpressionRulesFile(upsertExpressionLearningRuleBlock(currentContent, rule.id, block));
  const updated = await prisma.expressionLearningRule.update({
    where: { id: rule.id },
    data: {
      publishedPath: EXPRESSION_RULES_PERSONA_PATH,
      publishedRuleKey: rule.id,
      publishedContentHash: hashExpressionLearningRuleBlock(block),
      publishedAt: new Date(),
    },
  });
  return {
    ...updated,
    publication: { state: "synced" as const, path: EXPRESSION_RULES_PERSONA_PATH },
  };
}

export async function unpublishExpressionLearningRule(ruleId: string, force = false) {
  const rule = await prisma.expressionLearningRule.findUniqueOrThrow({ where: { id: ruleId } });
  const currentContent = await readExpressionRulesFile();
  if (currentContent) {
    const currentBlock = extractExpressionLearningRuleBlock(currentContent, rule.id);
    if (currentBlock && !force) {
      const currentHash = hashExpressionLearningRuleBlock(currentBlock);
      if (!rule.publishedContentHash || currentHash !== rule.publishedContentHash) {
        throw Object.assign(new Error("人设文件中的规则块已被人工修改，请确认后再撤回"), { statusCode: 409 });
      }
    }
    if (currentBlock) {
      await writeExpressionRulesFile(removeExpressionLearningRuleBlock(currentContent, rule.id));
    }
  }
  const updated = await prisma.expressionLearningRule.update({
    where: { id: rule.id },
    data: {
      publishedPath: null,
      publishedRuleKey: null,
      publishedContentHash: null,
      publishedAt: null,
    },
  });
  return {
    ...updated,
    publication: { state: "unpublished" as const, path: null },
  };
}
