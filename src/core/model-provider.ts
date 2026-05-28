import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../utils/env.js";
import type { ChatMessage, ModelProvider, ToolDefinitionForLLM, MessageContent, MessageContentPart } from "../types/model.js";

interface ProviderConfig {
  type: "openai-compatible" | "anthropic";
  baseURL: string;
  apiKey: string;
  model: string;
}

/**
 * Get the active provider configuration based on ACTIVE_MODEL_PROVIDER.
 */
function getActiveProviderConfig(): ProviderConfig {
  const active = env.ACTIVE_MODEL_PROVIDER.toLowerCase();

  // Map provider name to config
  const configMap: Record<string, { baseURL: string; apiKey: string; model: string; type: ProviderConfig["type"] }> = {
    openai: { baseURL: env.OPENAI_BASE_URL, apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, type: "openai-compatible" },
    anthropic: { baseURL: env.ANTHROPIC_BASE_URL, apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL, type: "anthropic" },
    glm: { baseURL: env.GLM_BASE_URL, apiKey: env.GLM_API_KEY, model: env.GLM_MODEL, type: "openai-compatible" },
    qwen: { baseURL: env.QWEN_BASE_URL, apiKey: env.QWEN_API_KEY, model: env.QWEN_MODEL, type: "openai-compatible" },
    deepseek: { baseURL: env.DEEPSEEK_BASE_URL, apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL, type: "openai-compatible" },
    minimax: { baseURL: env.MINIMAX_BASE_URL, apiKey: env.MINIMAX_API_KEY, model: env.MINIMAX_MODEL, type: "openai-compatible" },
  };

  const config = configMap[active];
  if (!config) {
    // Fallback to legacy single-provider config
    if (env.MODEL_BASE_URL && env.MODEL_API_KEY && env.MODEL_NAME) {
      return { type: "openai-compatible", baseURL: env.MODEL_BASE_URL, apiKey: env.MODEL_API_KEY, model: env.MODEL_NAME };
    }
    throw new Error(`Unknown ACTIVE_MODEL_PROVIDER: ${active}. Supported: ${Object.keys(configMap).join(", ")}`);
  }

  if (!config.baseURL || !config.apiKey || !config.model) {
    throw new Error(`Incomplete configuration for provider "${active}". Check ${active.toUpperCase()}_BASE_URL, ${active.toUpperCase()}_API_KEY, ${active.toUpperCase()}_MODEL`);
  }

  return { type: config.type, baseURL: config.baseURL, apiKey: config.apiKey, model: config.model };
}

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
  private providerName: string;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
    this.model = config.model;
    this.providerName = env.ACTIVE_MODEL_PROVIDER;
  }

  /**
   * Convert our ChatMessage[] to OpenAI's format, handling multimodal content.
   * For MiniMax (which doesn't support vision), strip images from content.
   */
  private convertMessages(messages: ChatMessage[]): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
    const isMiniMax = this.providerName === "minimax";

    return messages.map((msg) => {
      let content = msg.content;

      // Strip images for MiniMax
      if (isMiniMax && Array.isArray(content)) {
        const textParts = content.filter((part) => part.type === "text");
        content = textParts.length > 0 ? textParts.map((p) => p.text ?? "").join("\n") : "";
      }

      const base = {
        role: msg.role,
        content: convertContentToOpenAI(content),
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

// ---------------------------------------------------------------------------
// Anthropic provider
// ---------------------------------------------------------------------------

/**
 * Convert our internal MessageContent to Anthropic's content block format.
 */
function convertContentToAnthropic(content: MessageContent): string | Anthropic.Messages.ContentBlockParam[] {
  if (typeof content === "string") {
    return content;
  }
  return content.map((part): Anthropic.Messages.ContentBlockParam => {
    if (part.type === "text") {
      return { type: "text", text: part.text ?? "" };
    } else {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: part.image!.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: part.image!.data,
        },
      };
    }
  });
}

class AnthropicProvider implements ModelProvider {
  private client: Anthropic;
  private model: string;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      baseURL: config.baseURL || undefined,
      apiKey: config.apiKey,
    });
    this.model = config.model;
  }

  private convertMessages(messages: ChatMessage[]): {
    system?: string;
    msgs: Anthropic.Messages.MessageParam[];
  } {
    let system: string | undefined;
    const msgs: Anthropic.Messages.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // Anthropic takes system as a top-level param, not in messages
        system = typeof msg.content === "string" ? msg.content : msg.content.map((p) => p.text ?? "").join("\n");
        continue;
      }

      if (msg.role === "tool") {
        // Tool results in Anthropic format
        msgs.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.tool_call_id!,
              content: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content),
            },
          ],
        });
        continue;
      }

      if (msg.role === "assistant" && msg.tool_calls) {
        // Assistant tool use
        const blocks: Anthropic.Messages.ContentBlockParam[] = [];
        if (msg.content) {
          const text = typeof msg.content === "string" ? msg.content : msg.content.map((p) => p.text ?? "").join("");
          if (text) blocks.push({ type: "text", text });
        }
        for (const tc of msg.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || "{}"),
          });
        }
        msgs.push({ role: "assistant", content: blocks });
        continue;
      }

      msgs.push({
        role: msg.role as "user" | "assistant",
        content: convertContentToAnthropic(msg.content),
      });
    }

    return { system, msgs };
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const { system, msgs } = this.convertMessages(messages);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: msgs,
    });
    const raw = response.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.Messages.TextBlock).text).join("");
    console.log("[chat raw]\n" + raw + "\n[/chat raw]");
    return stripThinkTags(raw);
  }

  async chatJson<T>(messages: ChatMessage[]): Promise<T> {
    const { system, msgs } = this.convertMessages(messages);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: msgs,
    });
    const raw = response.content.filter((b) => b.type === "text").map((b) => (b as Anthropic.Messages.TextBlock).text).join("");
    const cleaned = stripThinkTags(raw);
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
    const { system, msgs } = this.convertMessages(messages);
    const anthropicTools: Anthropic.Messages.Tool[] = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Anthropic.Messages.Tool.InputSchema,
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: msgs,
      tools: anthropicTools,
    });

    const textBlocks = response.content.filter((b) => b.type === "text");
    const toolUseBlocks = response.content.filter((b) => b.type === "tool_use");

    const content = textBlocks.length > 0
      ? stripThinkTags(textBlocks.map((b) => (b as Anthropic.Messages.TextBlock).text).join(""))
      : null;

    const tool_calls = toolUseBlocks.length > 0
      ? toolUseBlocks.map((b) => {
          const tu = b as Anthropic.Messages.ToolUseBlock;
          return {
            id: tu.id,
            type: "function" as const,
            function: {
              name: tu.name,
              arguments: JSON.stringify(tu.input),
            },
          };
        })
      : undefined;

    console.log("[chat with tools]", {
      content: content?.slice(0, 100),
      tool_calls: tool_calls?.map((tc) => tc.function.name),
    });

    return { content, tool_calls };
  }
}

// ---------------------------------------------------------------------------
// Factory: pick provider based on ACTIVE_MODEL_PROVIDER
// ---------------------------------------------------------------------------

function createModelProvider(): ModelProvider {
  const config = getActiveProviderConfig();
  console.log(`[model-provider] active: ${env.ACTIVE_MODEL_PROVIDER}, model: ${config.model}`);

  if (config.type === "anthropic") {
    return new AnthropicProvider(config);
  }
  return new OpenAICompatibleProvider(config);
}

export const modelProvider: ModelProvider = createModelProvider();
