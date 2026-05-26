import OpenAI from "openai";
import { env } from "../utils/env.js";
import type { ChatMessage, ModelProvider } from "../types/model.js";

/**
 * Strip <think>...</think> blocks emitted by reasoning models.
 * Handles three cases:
 *   1. Complete blocks: removed entirely
 *   2. Stray </think> + duplicate output: take everything after the last </think>
 *   3. Unclosed <think> (model truncated mid-thought): take everything before it
 */
function stripThinkTags(text: string): string {
  // Remove complete <think>...</think> blocks
  let result = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  // If any stray </think> remains, take everything after the last one
  const lastClose = result.lastIndexOf("</think>");
  if (lastClose !== -1) {
    result = result.slice(lastClose + "</think>".length);
  }
  // If an unclosed <think> remains, take everything before it
  const openTag = result.indexOf("<think>");
  if (openTag !== -1) {
    result = result.slice(0, openTag);
  }
  return result.trim();
}

class OpenAICompatibleProvider implements ModelProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    this.client = new OpenAI({
      baseURL: env.MODEL_BASE_URL,
      apiKey: env.MODEL_API_KEY,
    });
    this.model = env.MODEL_NAME;
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
    });
    const raw = response.choices[0]?.message?.content ?? "";
    console.log("[chat raw]\n" + raw + "\n[/chat raw]");
    return stripThinkTags(raw);
  }

  async chatJson<T>(messages: ChatMessage[]): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
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
