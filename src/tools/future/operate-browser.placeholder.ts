import type { ToolDefinition } from "../tool.types.js";

export const operateBrowserTool: ToolDefinition<unknown, never> = {
  name: "operate_browser",
  description: "【禁用】操作浏览器执行网页动作 — 高风险，v0.5 不实现",
  riskLevel: "high",
  enabled: false,
  handler: async () => {
    throw new Error("operate_browser is disabled in v0.5");
  },
};
