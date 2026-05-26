import OpenAI from "openai";
import { env } from "../utils/env.js";
import type { ChatMessage, ModelProvider } from "../types/model.js";

/**
 * Strip <think>...</think> blocks emitted by reasoning models.
 * Also handles stray </think> tags and duplicate output: some models output
 * the answer once inside/after the think block, then a bare </think>, then
 * the answer again. Taking everything after the last </think> deduplicates.
 */
function stripThinkTags(text: string): string {
  // Remove complete <think>...</think> blocks first
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  // If any stray </think> remains, take everything after the last one
  const lastClose = result.lastIndexOf("</think>");
  if (lastClose !== -1) {
    result = result.slice(lastClose + "</think>".length);
  }
  return result.trim();
}

class OpenAICompatibleProvider implements ModelProvider {
  private client: OpenAI;
  private model: string;
  private extractionModel: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: env.MODEL_BASE_URL,
      apiKey: env.MODEL_API_KEY,
    });
    this.model = env.MODEL_NAME;
    this.extractionModel = env.MEMORY_EXTRACTION_MODEL_NAME;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });
    const raw = response.choices[0]?.message?.content ?? "";
    return stripThinkTags(raw);
  }

  async chatJson<T>(messages: ChatMessage[]): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.extractionModel,
      messages,
      response_format: { type: "json_object" },
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const cleaned = stripThinkTags(raw);
    // Extract JSON object/array if model wrapped it in prose
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    const jsonStr = jsonMatch ? jsonMatch[0] : cleaned;
    try {
      return JSON.parse(jsonStr || "{}") as T;
    } catch {
      console.warn("chatJson parse failed, raw response:", raw.slice(0, 500));
      return JSON.parse("{}") as T;
    }
  }
}

export const modelProvider: ModelProvider = new OpenAICompatibleProvider();
