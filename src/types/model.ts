/**
 * Message content can be either plain text or multimodal (text + images)
 */
export type MessageContent = string | MessageContentPart[];

export interface MessageContentPart {
  type: "text" | "image" | "video";
  text?: string;
  image?: {
    data: string;      // base64 encoded image data (without data:image/xxx;base64, prefix)
    mimeType: string;  // e.g., "image/jpeg", "image/png", "image/webp"
    url?: string;      // optional original URL or file path
  };
  video?: {
    data?: string;      // optional base64 encoded video data
    mimeType?: string;  // e.g., "video/mp4", "video/mov"
    url: string;        // URL or data URL
  };
}

export interface MiniMaxMessageMetadata {
  reasoningContent?: string;
  reasoningDetails?: unknown[];
  audioContent?: string;
  name?: string;
}

export interface ChatMessageProviderMetadata {
  minimax?: MiniMaxMessageMetadata;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    index?: number;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  providerMetadata?: ChatMessageProviderMetadata;
}

export interface ToolDefinitionForLLM {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export interface ProviderCapabilities {
  /**
   * Whether this provider can return content alongside tool_calls in the same response.
   * Some providers (e.g., MiniMax) always return empty content when making tool calls.
   */
  supportsContentWithToolCalls: boolean;
  /**
   * Whether this provider can receive multimodal content parts from our chat
   * representation without stripping images.
   */
  supportsVision: boolean;
  /**
   * Whether to ask for a short natural-language reaction when tool calls contain
   * no visible text. MiniMax-M3 often returns only thinking content before tools.
   */
  requestsToolReactionFallback: boolean;
}

export interface ModelCallOptions {
  signal?: AbortSignal;
}

export interface ModelProvider {
  capabilities: ProviderCapabilities;
  chat(messages: ChatMessage[], options?: ModelCallOptions): Promise<string>;
  chatJson<T>(messages: ChatMessage[], options?: ModelCallOptions): Promise<T>;
  chatWithTools(
    messages: ChatMessage[],
    tools: ToolDefinitionForLLM[],
    options?: ModelCallOptions
  ): Promise<{
    content: string | null;
    rawContent?: string | null;
    providerMetadata?: ChatMessageProviderMetadata;
    tool_calls?: Array<{
      id: string;
      type: "function";
      index?: number;
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }>;
}
