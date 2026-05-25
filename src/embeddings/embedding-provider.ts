export interface EmbeddingProvider {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
  readonly model: string;
  readonly dimensions: number;
  readonly providerName: string;
}
