import type { ToolExecutionResult } from "./tool.types.js";

export function formatToolResults(
  results: ToolExecutionResult<unknown>[]
): string {
  if (results.length === 0) return "";

  const lines: string[] = ["## 工具调用结果\n"];

  for (const r of results) {
    if (r.blocked) {
      lines.push(`**${r.toolName}**: 已拦截 — ${r.blockReason ?? "权限不足"}`);
    } else if (!r.ok) {
      lines.push(`**${r.toolName}**: 执行失败 — ${r.error ?? "未知错误"}`);
    } else {
      const output = r.output != null ? JSON.stringify(r.output, null, 2) : "{}";
      lines.push(`**${r.toolName}**:\n\`\`\`json\n${output.slice(0, 2000)}\n\`\`\``);
    }
  }

  return lines.join("\n\n");
}
