# Tool & Action Layer — v0.5

## 概述

v0.5 为陆思源引入结构化的工具调用层，让 AI 在回复时可以读取内部数据（记忆、项目状态、对话历史），并生成草稿供人工审核。

工具调用**不会**自动发送消息或操作外部平台。

---

## 核心组件

### ToolDefinition

每个工具实现 `ToolDefinition<TInput, TOutput>` 接口：

```typescript
{
  name: string;
  description: string;          // 用于 AI 判断何时调用
  riskLevel: "low" | "medium" | "high";
  ownerOnly?: boolean;
  enabled: boolean;
  handler: (input, context) => Promise<TOutput>;
}
```

### ActionPolicy

`ActionPolicy.canExecute()` 在每次调用前检查：

1. 工具是否 enabled
2. 工具是否 ownerOnly，调用者是否为 owner
3. `TOOLS_ENABLED` 全局开关
4. 高风险工具始终拦截
5. 中风险工具需要 `TOOLS_ALLOW_MEDIUM_RISK=true`

### ToolExecutor

- 调用 ActionPolicy 检查
- 执行 handler，有 `TOOL_TIMEOUT_MS` 超时保护
- 写入 ToolCallLog（fire-and-forget）

### ToolIntentDetector

模型驱动的意图检测，不用关键词匹配。  
读取当前启用的工具列表，让模型判断用户消息是否需要调用工具，返回工具名 + 参数 + 置信度。只有置信度 ≥ 0.7 的意图才会执行。

### Draft

`create_draft` 工具只把内容写入数据库，不发送。用户通过 API 审核后手动操作。

### ToolCallLog

每次工具调用都记录到 `ToolCallLog` 表：工具名、状态、是否拦截、执行时长、输入/输出（可配置）。

---

## 五个低风险工具

| 工具名 | 描述 |
|--------|------|
| `get_current_project_status` | 获取项目当前版本进展 |
| `search_memories` | 语义搜索用户长期记忆 |
| `create_draft` | 创建草稿，不发送 |
| `list_recent_decisions` | 列出最近技术决策 |
| `summarize_recent_conversation` | 总结近期对话内容 |

---

## 四个高风险工具（禁用）

以下工具在 v0.5 只有 placeholder，`enabled: false`，handler 直接 throw：

| 工具名 | 原因 |
|--------|------|
| `send_message` | 向外部发送消息，风险太高 |
| `post_to_platform` | 在平台发布内容，不可撤销 |
| `operate_browser` | 操作浏览器，范围不可控 |
| `read_private_inbox` | 读取私信，隐私边界 |

即使设置 `TOOLS_ALLOW_HIGH_RISK=true`，ActionPolicy 也会拦截这些工具。

---

## 未来接入路线

### MCP（v0.7 计划）

`src/mcp/` 目录已预留位置：
- `mcp-client.placeholder.ts` — 连接 MCP server
- `mcp-tool-provider.placeholder.ts` — 从 MCP server 加载工具

接入后，MCP 工具可直接注册到 `ToolRegistry`，走同一条 ActionPolicy + ToolExecutor 流水线。

### OpenClaw Action Gateway（v0.8 计划）

高风险外部动作将通过 OpenClaw 网关执行，需要独立授权层，不在核心聊天流程内。

---

## 环境变量

```env
TOOLS_ENABLED=false                  # 全局开关
TOOLS_AUTO_EXECUTE_LOW_RISK=true     # 低风险自动执行
TOOLS_ALLOW_MEDIUM_RISK=false        # 中风险需要手动开启
TOOLS_ALLOW_HIGH_RISK=false          # 高风险始终禁用（placeholder 也拦截）
DRAFTS_ENABLED=true                  # 草稿功能开关
TOOL_MAX_CALLS_PER_MESSAGE=3         # 单条消息最多调用次数
TOOL_TIMEOUT_MS=10000                # 工具超时（ms）
TOOL_LOG_INPUT_OUTPUT=true           # 是否记录输入/输出到 ToolCallLog
MCP_ENABLED=false                    # MCP 预留，v0.5 不实现
```

---

## API 端点

```
GET  /v1/tools                          列出所有工具
POST /v1/tools/:toolName/execute        手动触发工具调用
GET  /v1/tool-logs                      查看调用日志
GET  /v1/drafts                         列出草稿
GET  /v1/drafts/:draftId                获取单个草稿
PATCH /v1/drafts/:draftId/status        更新草稿状态
```
