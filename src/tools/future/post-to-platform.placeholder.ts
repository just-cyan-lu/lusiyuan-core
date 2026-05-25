import type { ToolDefinition } from "../tool.types.js";

export const postToPlatformTool: ToolDefinition<unknown, never> = {
  name: "post_to_platform",
  description: "【禁用】在社交平台发布内容 — 高风险，v0.5 不实现",
  riskLevel: "high",
  enabled: false,
  handler: async () => {
    throw new Error("post_to_platform is disabled in v0.5");
  },
};
