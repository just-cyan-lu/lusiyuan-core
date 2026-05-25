import type { ToolDefinition } from "../tool.types.js";

export const readPrivateInboxTool: ToolDefinition<unknown, never> = {
  name: "read_private_inbox",
  description: "【禁用】读取私信收件箱 — 高风险，v0.5 不实现",
  riskLevel: "high",
  enabled: false,
  handler: async () => {
    throw new Error("read_private_inbox is disabled in v0.5");
  },
};
