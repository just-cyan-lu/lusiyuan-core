import type { ToolDefinition } from "../tool.types.js";

export const sendMessageTool: ToolDefinition<unknown, never> = {
  name: "send_message",
  description: "【禁用】向外部平台发送消息 — 高风险，v0.5 不实现",
  riskLevel: "high",
  enabled: false,
  handler: async () => {
    throw new Error("send_message is disabled in v0.5");
  },
};
