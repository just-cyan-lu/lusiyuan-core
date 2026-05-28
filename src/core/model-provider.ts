import OpenAI from "openai";
import { env } from "../utils/env.js";
import type { ChatMessage, ModelProvider, ToolDefinitionForLLM, MessageContent, MessageContentPart } from "../types/model.js";

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

/**
 * Convert our internal MessageContent format to OpenAI's format.
 * OpenAI uses: { type: "text", text: "..." } | { type: "image_url", image_url: { url: "data:..." } }
 */
function convertContentToOpenAI(content: MessageContent): string | Array<OpenAI.Chat.Completions.ChatCompletionContentPart> {
  if (typeof content === "string") {
    return content;
  }

  // Multimodal content
  return content.map((part) => {
    if (part.type === "text") {
      return {
        type: "text" as const,
        text: part.text ?? "",
      };
    } else {
      // image
      const dataUrl = `data:${part.image!.mimeType};base64,${part.image!.data}`;
      return {
        type: "image_url" as const,
        image_url: {
          url: dataUrl,
        },
      };
    }
  });
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

  /**
   * Convert our ChatMessage[] to OpenAI's format, handling multimodal content.
   */
  private convertMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      const base = {
        role: msg.role,
        content: convertContentToOpenAI(msg.content),
      };

      if (msg.tool_call_id) {
        return { ...base, tool_call_id: msg.tool_call_id } as OpenAI.Chat.Completions.ChatCompletionMessageParam;
      }

      if (msg.tool_calls) {
        return {
          ...base,
          tool_calls: msg.tool_calls as OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
        } as OpenAI.Chat.Completions.ChatCompletionMessageParam;
      }

      return base as OpenAI.Chat.Completions.ChatCompletionMessageParam;
    });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(messages),
    });
    const raw = response.choices[0]?.message?.content ?? "";
    console.log("[chat raw]\n" + raw + "\n[/chat raw]");
    return stripThinkTags(raw);
  }

  async chatJson<T>(messages: ChatMessage[]): Promise<T> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(messages),
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

  async chatWithTools(
    messages: ChatMessage[],
    tools: ToolDefinitionForLLM[]
  ): Promise<{
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
  }> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: this.convertMessages(messages),
      tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
    });

    const message = response.choices[0]?.message;
    if (!message) {
      return { content: "" };
    }

    const content = message.content ? stripThinkTags(message.content) : null;
    const tool_calls = message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: tc.type as "function",
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));

    console.log("[chat with tools]", {
      content: content?.slice(0, 100),
      tool_calls: tool_calls?.map((tc) => tc.function.name),
    });

    return { content, tool_calls };
  }
}

export const modelProvider: ModelProvider = new OpenAICompatibleProvider();
