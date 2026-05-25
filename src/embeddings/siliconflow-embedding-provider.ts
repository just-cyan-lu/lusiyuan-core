import { env } from "../utils/env.js";
import type { EmbeddingProvider } from "./embedding-provider.js";

export class SiliconFlowEmbeddingProvider implements EmbeddingProvider {
  readonly providerName = "siliconflow";
  readonly model: string;
  readonly dimensions: number;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor() {
    this.baseUrl = env.EMBEDDING_BASE_URL;
    this.apiKey = env.EMBEDDING_API_KEY;
    this.model = env.EMBEDDING_MODEL;
    this.dimensions = env.EMBEDDING_DIMENSIONS;
  }

  async embedText(text: string): Promise<number[]> {
    const results = await this.embedTexts([text]);
    return results[0];
  }

  async embedTexts(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
        dimensions: this.dimensions,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `SiliconFlow embedding API error ${response.status}: ${body}`
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
    };

    const sorted = [...data.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  }
}

export const embeddingProvider = new SiliconFlowEmbeddingProvider();
