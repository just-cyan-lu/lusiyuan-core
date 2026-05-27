export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
  score?: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  answer?: string;
}
