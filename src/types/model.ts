export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  chatJson<T>(messages: ChatMessage[]): Promise<T>;
}
