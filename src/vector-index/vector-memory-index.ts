export interface SimilarMemoryResult {
  memoryId: string;
  score: number;
}

export interface UpsertEmbeddingInput {
  memoryId: string;
  embedding: number[];
  provider: string;
  model: string;
  dimensions: number;
  contentHash: string;
}

export interface SearchSimilarInput {
  queryEmbedding: number[];
  personId: string;
  provider: string;
  model: string;
  dimensions: number;
  topK: number;
}

export interface VectorMemoryIndex {
  upsertMemoryEmbedding(input: UpsertEmbeddingInput): Promise<void>;
  searchSimilarMemories(input: SearchSimilarInput): Promise<SimilarMemoryResult[]>;
  deleteMemoryEmbedding(memoryId: string, provider: string, model: string, dimensions: number): Promise<void>;
}
