import type { ToolDefinition } from "./tool.types.js";
import type { ToolDefinitionForLLM } from "../types/model.js";

/**
 * Convert internal tool definitions to OpenAI function calling format.
 */
export function convertToolsForLLM(
  tools: ToolDefinition[]
): ToolDefinitionForLLM[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      // Use tool's own parameters if defined, otherwise fall back to legacy hardcoded schema
      parameters: tool.parameters || inferParametersSchema(tool.name),
    },
  }));
}

/**
 * Infer parameter schema for each tool.
 * TODO: This should ideally be defined alongside each tool definition.
 */
function inferParametersSchema(toolName: string): {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
} {
  switch (toolName) {
    case "web_search":
      return {
        type: "object",
        properties: {
          query: { type: "string", description: "搜索关键词" },
        },
        required: ["query"],
      };

    case "read_page":
      return {
        type: "object",
        properties: {
          url: { type: "string", description: "要读取的网页 URL" },
          tool: {
            type: "string",
            enum: ["jina", "playwright", "cdp"],
            description:
              "使用的工具：\n" +
              "- jina（默认）：快速，适合公开网页\n" +
              "- playwright：本地浏览器，支持 JS 渲染\n" +
              "- cdp：连接用户已登录的 Chrome，**必须用于需要登录的页面**（如小红书通知、微博私信等）",
          },
          wait_ms: {
            type: "number",
            description:
              "等待页面加载的毫秒数，动态页面（如小红书、社交媒体）建议 3000-5000",
          },
          screenshot: {
            type: "boolean",
            description: "是否截图（仅 playwright 支持）",
          },
        },
        required: ["url"],
      };

    default:
      // Fallback for unknown tools
      return {
        type: "object",
        properties: {},
      };
  }
}
