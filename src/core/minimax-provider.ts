import type { ChatMessageProviderMetadata, MiniMaxMessageMetadata } from "../types/model.js";

export interface MiniMaxRuntimeOptions {
  thinkingType: "adaptive" | "disabled";
  reasoningSplit: boolean;
  maxCompletionTokens?: number;
}

export function isMiniMaxProvider(providerName: string): boolean {
  return providerName.toLowerCase() === "minimax";
}

export function isMiniMaxM3Model(model: string): boolean {
  return model.trim().toLowerCase() === "minimax-m3";
}

export function buildMiniMaxRequestFields(
  providerName: string,
  model: string,
  options: MiniMaxRuntimeOptions
): Record<string, unknown> {
  if (!isMiniMaxProvider(providerName) || !isMiniMaxM3Model(model)) {
    return {};
  }

  return {
    thinking: { type: options.thinkingType },
    reasoning_split: options.reasoningSplit,
    ...(options.maxCompletionTokens
      ? { max_completion_tokens: options.maxCompletionTokens }
      : {}),
  };
}

function getStringField(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  return typeof val === "string" ? val : undefined;
}

function getArrayField(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const val = obj[key];
  return Array.isArray(val) ? val : undefined;
}

export function extractMiniMaxMessageMetadata(
  message: Record<string, unknown>
): MiniMaxMessageMetadata | undefined {
  const metadata: MiniMaxMessageMetadata = {};
  const reasoningContent = getStringField(message, "reasoning_content");
  const reasoningDetails = getArrayField(message, "reasoning_details");
  const audioContent = getStringField(message, "audio_content");
  const name = getStringField(message, "name");

  if (reasoningContent) metadata.reasoningContent = reasoningContent;
  if (reasoningDetails) metadata.reasoningDetails = reasoningDetails;
  if (audioContent !== undefined) metadata.audioContent = audioContent;
  if (name) metadata.name = name;

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

export function applyMiniMaxMetadata(
  message: Record<string, unknown>,
  metadata?: ChatMessageProviderMetadata
): void {
  const minimax = metadata?.minimax;
  if (!minimax) return;

  if (minimax.reasoningContent) {
    message.reasoning_content = minimax.reasoningContent;
  }
  if (minimax.reasoningDetails) {
    message.reasoning_details = minimax.reasoningDetails;
  }
  if (minimax.audioContent !== undefined) {
    message.audio_content = minimax.audioContent;
  }
  if (minimax.name) {
    message.name = minimax.name;
  }
}
