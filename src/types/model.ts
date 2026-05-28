/**
 * Message content can be either plain text or multimodal (text + images)
 */
export type MessageContent = string | MessageContentPart[];

export interface MessageContentPart {
  type: "text" | "image";
  text?: string;
  image?: {
    data: string;      // base64 encoded image data (without data:image/xxx;base64, prefix)
    mimeType: string;  // e.g., "image/jpeg", "image/png", "image/webp"
    url?: string;      // optional original URL or file path
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: MessageContent;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
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

export interface ModelProvider {
  chat(messages: ChatMessage[]): Promise<string>;
  chatJson<T>(messages: ChatMessage[]): Promise<T>;
  chatWithTools(
    messages: ChatMessage[],
    tools: ToolDefinitionForLLM[]
  ): Promise<{
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
  }>;
}
