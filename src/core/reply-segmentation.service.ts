import { runtimeConfig } from "../config/runtime-settings.service.js";
import { modelProvider } from "./model-provider.js";
import type { ChatMessage, ModelCallOptions } from "../types/model.js";

export type ReplyDeliveryMode = "single" | "final_blocks" | "hybrid";

export interface ReplySegmentationOptions {
  mode: ReplyDeliveryMode;
  llmEnabled: boolean;
  minChars: number;
  maxChars: number;
  maxCount: number;
  delayMinMs: number;
  delayMaxMs: number;
}

export interface ReplySegmentationResult {
  replies: string[];
  source: "single" | "llm" | "rule";
}

interface LlmSegmentationResponse {
  messages?: unknown;
}

const SENTENCE_END_CHARS = new Set(["。", "！", "？", "!", "?", "…"]);
const SOFT_BREAK_CHARS = new Set(["，", ",", "；", ";", "：", ":"]);
const DEFAULT_SEGMENT_MIN_CHARS = 36;
const DEFAULT_SEGMENT_MAX_CHARS = 180;
const DEFAULT_SEGMENT_MAX_COUNT = 4;

function hasSegmentCountLimit(maxCount: number): boolean {
  return maxCount > 0;
}

export function getReplySegmentationOptions(): ReplySegmentationOptions {
  return {
    mode: runtimeConfig.REPLY_DELIVERY_MODE as ReplyDeliveryMode,
    llmEnabled: runtimeConfig.REPLY_SEGMENTATION_LLM_ENABLED,
    minChars: DEFAULT_SEGMENT_MIN_CHARS,
    maxChars: DEFAULT_SEGMENT_MAX_CHARS,
    maxCount: DEFAULT_SEGMENT_MAX_COUNT,
    delayMinMs: runtimeConfig.REPLY_HUMAN_DELAY_MIN_MS,
    delayMaxMs: runtimeConfig.REPLY_HUMAN_DELAY_MAX_MS,
  };
}

export function shouldSegmentFinalReply(mode = getReplySegmentationOptions().mode): boolean {
  return mode === "final_blocks" || mode === "hybrid";
}

export function replySegmentDelay(
  index: number,
  content = "",
  options = getReplySegmentationOptions(),
  random = Math.random
): number {
  if (index === 0) return 0;
  const min = Math.max(0, Math.floor(options.delayMinMs));
  const max = Math.max(min, Math.floor(options.delayMaxMs));
  if (max === min) return min;
  const readableChars = countReadableChars(content);
  const typingMs = 360 + readableChars * 28;
  const jitterMs = Math.floor((random() - 0.5) * 320);
  return clamp(Math.round(typingMs + jitterMs), min, max);
}

export async function segmentReply(
  reply: string,
  options = getReplySegmentationOptions(),
  callOptions?: ModelCallOptions
): Promise<ReplySegmentationResult> {
  const text = reply.trim();
  if (!text) return { replies: [""], source: "single" };
  if (!shouldSegmentFinalReply(options.mode) || shouldKeepSingle(text, options)) {
    return { replies: [text], source: "single" };
  }

  if (options.llmEnabled && !looksStructured(text)) {
    const llmReplies = await splitWithLlm(text, options, callOptions).catch((error) => {
      if (callOptions?.signal?.aborted) throw error;
      console.warn("[reply-segmentation] LLM split failed:", error);
      return null;
    });
    if (llmReplies) {
      if (llmReplies.length === 1) {
        const ruleReplies = splitReplyByRules(text, options);
        if (ruleReplies.length > 1) return { replies: ruleReplies, source: "rule" };
      }
      return { replies: llmReplies, source: llmReplies.length > 1 ? "llm" : "single" };
    }
  }

  const ruleReplies = splitReplyByRules(text, options);
  return { replies: ruleReplies, source: ruleReplies.length > 1 ? "rule" : "single" };
}

export function splitReplyByRules(reply: string, options: ReplySegmentationOptions): string[] {
  const text = reply.trim();
  if (options.maxCount === 1 || looksStructured(text)) return [text];
  const paragraphSegments = splitParagraphSegments(text, options);
  if (paragraphSegments) return paragraphSegments;
  if (shouldKeepSingle(text, options)) return [text];

  const units = splitIntoUnits(text, options.maxChars);
  const segments: string[] = [];
  let current = "";

  for (const unit of units) {
    const next = current ? `${current}${unit}` : unit;
    const currentIsShortLead = segments.length === 0 && current && isNaturalShortLead(current);
    if (currentIsShortLead) {
      segments.push(current.trim());
      current = unit;
      continue;
    }
    if (
      !current ||
      next.length <= options.maxChars ||
      current.length < options.minChars
    ) {
      current = next;
      continue;
    }
    segments.push(current.trim());
    current = unit;
  }

  if (current.trim()) segments.push(current.trim());

  const coalesced = coalesceSmallSegments(segments, options);
  return clampSegmentCount(coalesced, options.maxCount);
}

export function validateLlmSegments(
  original: string,
  candidate: unknown,
  options: Pick<ReplySegmentationOptions, "maxCount">
): string[] | null {
  if (!Array.isArray(candidate)) return null;
  const replies = candidate
    .filter((part): part is string => typeof part === "string")
    .map((part) => part.trim())
    .filter(Boolean);

  if (replies.length === 0 || (hasSegmentCountLimit(options.maxCount) && replies.length > options.maxCount)) return null;
  if (replies.length !== candidate.length) return null;

  const originalComparable = normalizeForComparison(original);
  const candidateComparable = normalizeForComparison(replies.join(""));
  if (candidateComparable !== originalComparable) return null;

  return replies;
}

function shouldKeepSingle(text: string, options: ReplySegmentationOptions): boolean {
  if (options.maxCount === 1) return true;
  if (looksStructured(text)) return true;
  if (hasNaturalParagraphBreak(text, options)) return false;
  if (hasNaturalShortLead(text, options)) return false;
  if (text.length < Math.max(options.minChars * 2, options.maxChars * 0.8)) return true;
  return false;
}

function hasNaturalParagraphBreak(text: string, options: ReplySegmentationOptions): boolean {
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return paragraphs.length > 1 && text.length >= options.minChars * 2;
}

function splitParagraphSegments(text: string, options: ReplySegmentationOptions): string[] | null {
  if (!hasNaturalParagraphBreak(text, options)) return null;
  const paragraphs = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  if (paragraphs.length <= 1) return null;
  const segments = paragraphs.flatMap((paragraph) => splitLongUnit(paragraph, options.maxChars));
  const coalesced = coalesceSmallSegments(segments, options);
  return clampSegmentCount(coalesced, options.maxCount);
}

function hasNaturalShortLead(text: string, options: ReplySegmentationOptions): boolean {
  const sentenceUnits = splitByBoundaryChars(text, SENTENCE_END_CHARS);
  return (
    sentenceUnits.length > 1 &&
    isNaturalShortLead(sentenceUnits[0]) &&
    text.length - sentenceUnits[0].length >= options.minChars
  );
}

function looksStructured(text: string): boolean {
  const trimmed = text.trim();
  if (/```/.test(trimmed)) return true;
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return true;
  }
  const lines = trimmed.split(/\n/);
  const tableLines = lines.filter((line) => line.includes("|")).length;
  if (tableLines >= 2) return true;
  const listLines = lines.filter((line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)).length;
  return listLines >= 3;
}

async function splitWithLlm(
  reply: string,
  options: ReplySegmentationOptions,
  callOptions?: ModelCallOptions
): Promise<string[] | null> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "你是聊天回复分条器，只决定消息气泡边界。",
        "严格规则：",
        "1. 只能把原回复切成 1 到若干条，不能改写、删减、补充、翻译或润色。",
        "2. 如果回复不适合分条，返回单元素数组。",
        "3. 不要切开代码块、JSON、表格、编号步骤或必须连续阅读的段落。",
        "4. 每条尽量像真人聊天气泡：短而完整，不要把每个换行都当成一条。",
        "5. maxMessages 为 null 时不限制条数，但仍然要避免过度切碎。",
        '只输出 JSON：{"messages":["第一条","第二条"]}',
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify({
        maxMessages: hasSegmentCountLimit(options.maxCount) ? options.maxCount : null,
        targetMinChars: options.minChars,
        targetMaxChars: options.maxChars,
        reply,
      }),
    },
  ];

  const response = await modelProvider.chatJson<LlmSegmentationResponse>(messages, callOptions);
  return validateLlmSegments(reply, response.messages, options);
}

function splitIntoUnits(text: string, maxChars: number): string[] {
  const paragraphUnits = text
    .split(/(\n{2,})/)
    .reduce<string[]>((units, chunk, index, chunks) => {
      if (!chunk) return units;
      if (/^\n{2,}$/.test(chunk)) {
        const previous = units.pop();
        if (previous !== undefined) units.push(previous + chunk);
        return units;
      }
      const nextChunk = chunks[index + 1] ?? "";
      units.push(nextChunk.match(/^\n{2,}$/) ? chunk : chunk.trim());
      return units;
    }, [])
    .filter((unit) => unit.trim());

  return paragraphUnits.flatMap((unit) => splitLongUnit(unit, maxChars));
}

function splitLongUnit(unit: string, maxChars: number): string[] {
  const sentenceUnits = splitByBoundaryChars(unit, SENTENCE_END_CHARS);
  if (unit.length <= maxChars) {
    return sentenceUnits.length > 1 && isNaturalShortLead(sentenceUnits[0])
      ? sentenceUnits
      : [unit];
  }
  if (sentenceUnits.some((part) => part.length < unit.length)) {
    return sentenceUnits.flatMap((part) => splitLongUnitBySoftBreak(part, maxChars));
  }
  return splitLongUnitBySoftBreak(unit, maxChars);
}

function splitLongUnitBySoftBreak(unit: string, maxChars: number): string[] {
  if (unit.length <= maxChars) return [unit];
  const softUnits = splitByBoundaryChars(unit, SOFT_BREAK_CHARS);
  if (softUnits.some((part) => part.length < unit.length)) {
    return softUnits.flatMap((part) => hardSplit(part, maxChars));
  }
  return hardSplit(unit, maxChars);
}

function splitByBoundaryChars(text: string, boundaries: Set<string>): string[] {
  const units: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!boundaries.has(text[i])) continue;
    const slice = text.slice(start, i + 1);
    if (slice.trim()) units.push(slice);
    start = i + 1;
  }
  const tail = text.slice(start);
  if (tail.trim()) units.push(tail);
  return units.length > 0 ? units : [text];
}

function hardSplit(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    const search = remaining.slice(0, maxChars);
    const whitespaceIndex = Math.max(search.lastIndexOf(" "), search.lastIndexOf("\n"));
    const cut = whitespaceIndex > Math.floor(maxChars * 0.45) ? whitespaceIndex + 1 : maxChars;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function coalesceSmallSegments(segments: string[], options: ReplySegmentationOptions): string[] {
  const result: string[] = [];
  for (const segment of segments) {
    const previous = result[result.length - 1];
    if (
      previous &&
      segment.length < options.minChars &&
      previous.length + segment.length <= options.maxChars &&
      !isNaturalShortLead(segment)
    ) {
      result[result.length - 1] = previous + segment;
      continue;
    }
    result.push(segment);
  }
  return result;
}

function clampSegmentCount(segments: string[], maxCount: number): string[] {
  if (!hasSegmentCountLimit(maxCount)) return segments.length > 0 ? segments : [""];
  if (segments.length <= maxCount) return segments.length > 0 ? segments : [""];
  const head = segments.slice(0, Math.max(1, maxCount - 1));
  const tail = segments.slice(Math.max(1, maxCount - 1)).join("");
  return [...head, tail].filter(Boolean);
}

function isNaturalShortLead(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length <= 18 && /[。！？!?…]$/.test(trimmed);
}

function normalizeForComparison(text: string): string {
  return text.replace(/[\s\u200b-\u200d\ufeff]/g, "");
}

function countReadableChars(text: string): number {
  return Array.from(text.replace(/\s+/g, "")).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
