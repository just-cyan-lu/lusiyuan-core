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
            enum: ["jina", "playwright", "chrome-devtools-mcp"],
            description:
              "可选读取工具；不确定时可以不传，由系统自动选择：\n" +
              "- jina：公开文档、文章、博客、新闻等静态内容\n" +
              "- playwright：公开但依赖 JS 渲染的页面；被选中时可同时截图\n" +
              "- chrome-devtools-mcp：仅 Owner 可用；需要登录态的真实 Chrome 页面，被选中时可同时截图，不会自动关闭页面",
          },
          wait_ms: {
            type: "number",
            description:
              "等待页面加载的毫秒数，动态页面（如小红书、社交媒体）建议 3000-5000",
          },
          screenshot: {
            type: "boolean",
            description: "是否让当前选中的浏览器读取器同时返回截图；Jina 不支持截图。",
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
