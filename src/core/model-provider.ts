import OpenAI from "openai";
import { env } from "../utils/env.js";
import type { ChatMessage, ModelProvider } from "../types/model.js";

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
    return response.choices[0]?.message?.content ?? "";
  }

  async chatJson<T>(messages: ChatMessage[]): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.extractionModel,
      messages,
      response_format: { type: "json_object" },
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    // Strip <think>...</think> blocks emitted by reasoning models before parsing
    const cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    return JSON.parse(cleaned || "{}") as T;
  }
}

export const modelProvider: ModelProvider = new OpenAICompatibleProvider();
