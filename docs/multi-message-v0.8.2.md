# 多条回复功能 — v0.8.2

## 概述

v0.8.2 为陆思源引入多条回复能力，让 AI 可以像真人一样分多次发送消息，而不是一次性输出所有内容。

这个功能通过 `send_intermediate_message` 工具实现，由 LLM 自主决定何时分条回复，不是固定模式。

---

## 设计理念

### 为什么需要多条回复？

真人聊天时，通常会：
1. 先回复即时反应（"真的吗？我去看看"）
2. 然后执行操作（查看、搜索）
3. 最后回复详细结果

传统 AI 会把所有内容一次性输出，显得机械。多条回复让对话更自然。

### 设计原则

- **LLM 自主控制**：不是固定模式，由 LLM 判断何时需要分条
- **适度使用**：通过 prompt 引导，避免滥用（建议每次对话 1-3 条）
- **短延迟**：100-500ms 随机延迟，考虑到 LLM 本身就慢
- **扩展性**：预留 `style` 参数，未来可根据情绪/场景调整策略

---

## 核心组件

### 1. send_intermediate_message 工具

**位置**: `src/tools/builtin/send-intermediate-message.ts`

**功能**: 发送一条中间消息给用户（在最终回复之前）

**参数**:
```typescript
{
  content: string;        // 消息内容（简短，1-2 句话）
  style?: string;         // 可选：消息风格（excited/calm/formal/casual）
}
```

**返回**:
```typescript
{
  content: string;
  style: string;
  delay_ms: number;       // 100-500ms 随机延迟
  is_intermediate: true;
}
```

**风险级别**: `low`

### 2. 数据库支持

**表**: `Message`

**新增字段**: `isIntermediate: Boolean @default(false)`

用于标记中间消息，保留完整对话历史。

### 3. Chat Service 集成

**位置**: `src/core/chat.service.ts`

**流程**:
1. 检测到 `send_intermediate_message` 工具调用
2. 存储消息到数据库（`isIntermediate: true`）
3. 通过 `onIntermediateMessage` 回调发送消息
4. 继续执行后续工具调用或生成最终回复

### 4. Channel 集成

**Telegram**: `src/channels/telegram/telegram.bot.ts`

实现 `onIntermediateMessage` 回调：
```typescript
onIntermediateMessage: async (content: string, delayMs: number) => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  await ctx.reply(content);
}
```

**Weixin**: 待实现（需要在 weixin.route.ts 中添加类似回调）

### 5. Persona 指导

**位置**: `persona/tool_usage.md`

详细说明：
- 什么时候使用（工具调用前、分段回复、表达思考）
- 使用建议（保持自然、适度使用、简短）
- 示例场景
- 风格参数说明（未来扩展）

---

## 使用场景

### 场景 1: 工具调用前的即时反应

```
用户: "去看看小红书评论，有很多人评论你"

思源: send_intermediate_message("真的吗？我去看看")
思源: sync_external_inbox(...)
思源: "看到了！有 3 条新评论，有人说..."
```

### 场景 2: 分段回复长内容

```
用户: "你觉得 AI 会取代人类吗？"

思源: send_intermediate_message("让我想想...")
思源: "我觉得这个问题要分几个层面看..."（详细回复）
```

### 场景 3: 表达思考过程

```
用户: "帮我分析一下这个设计方案"

思源: send_intermediate_message("有意思...")
思源: send_intermediate_message("嗯，这样的话...")
思源: "我觉得这个方案..."（详细分析）
```

---

## 技术实现

### 回调机制

**ChatInput 接口**:
```typescript
interface ChatInput {
  // ... 其他字段
  onIntermediateMessage?: (content: string, delayMs: number) => Promise<void>;
}
```

**优点**:
- 解耦：chat.service 不需要知道如何发送消息
- 灵活：不同 channel 可以有不同的实现
- 可测试：可以 mock 回调进行测试

### 延迟策略

**当前实现**: 100-500ms 随机延迟

**未来扩展** (TODO):
```typescript
// 根据 style 参数调整延迟
// - excited: 更短的延迟（50-200ms），更多分条
// - calm: 稍长的延迟（200-600ms），更完整的表达
// - formal: 更结构化的分段
// - casual: 更随意的节奏
```

### 消息存储

所有中间消息都存入数据库：
- 保留完整对话历史
- 标记 `isIntermediate: true`
- 可用于 Reflection 分析（可选择性过滤）

---

## 扩展性设计

### style 参数（未来）

预留了 `style` 参数，用于根据情绪/场景调整分条策略：

| Style | 场景 | 策略 |
|-------|------|------|
| `excited` | 兴奋/激动 | 更短延迟，更多短句 |
| `calm` | 冷静/思考 | 稍长延迟，更完整表达 |
| `formal` | 说正事 | 更结构化的分段 |
| `casual` | 闲聊 | 更随意的节奏 |

**实现位置**: `src/tools/builtin/send-intermediate-message.ts` 中的 TODO 注释

### 频率控制（未来）

当前通过 prompt 引导自然使用，未来可以：
- 根据对话历史动态调整建议频率
- 根据用户反馈学习最佳分条策略
- 在不同场景下应用不同的频率策略

---

## 环境变量

无新增环境变量。依赖现有的 `TOOLS_ENABLED` 开关。

---

## 数据库迁移

```bash
pnpm db:migrate
# Migration name: add_intermediate_message_support
```

**变更**:
- `Message` 表添加 `isIntermediate Boolean @default(false)` 字段

---

## 文件清单

### 新增文件
- `src/tools/builtin/send-intermediate-message.ts` — 工具实现
- `persona/tool_usage.md` — 工具使用指南

### 修改文件
- `prisma/schema.prisma` — 添加 `isIntermediate` 字段
- `src/types/chat.ts` — 添加 `onIntermediateMessage` 回调
- `src/core/chat.service.ts` — 处理中间消息发送
- `src/channels/telegram/telegram.bot.ts` — 实现回调
- `src/tools/builtin/index.ts` — 注册工具
- `src/core/persona-loader.ts` — 加载 tool_usage.md
- `src/core/prompt-builder.ts` — 将 toolUsage 加入 system prompt

---

## 测试建议

### 手动测试

1. **基础功能**:
   - 发送："去看看小红书评论"
   - 观察是否先回复"我去看看"，再回复具体内容

2. **自然使用**:
   - 发送各种问题，观察思源是否自然地使用分条回复
   - 检查是否过度使用（每句话都分条）

3. **延迟效果**:
   - 观察中间消息的延迟是否自然（100-500ms）

### 自动化测试（未来）

- Mock `onIntermediateMessage` 回调
- 验证中间消息是否正确存储到数据库
- 验证 `isIntermediate` 标记是否正确

---

## 已知限制

1. **Weixin 未实现**: 需要在 `weixin.route.ts` 中添加回调实现
2. **无频率硬限制**: 完全依赖 LLM 自主判断，可能被滥用
3. **无情绪检测**: `style` 参数目前未使用，需要情绪识别系统

---

## 未来改进

| 项目 | 优先级 | 说明 |
|------|--------|------|
| Weixin 集成 | 高 | 实现 `onIntermediateMessage` 回调 |
| 情绪识别 | 中 | 自动检测对话情绪，设置 `style` 参数 |
| 频率控制 | 中 | 根据 `style` 动态调整延迟和频率 |
| 用户偏好 | 低 | 允许用户设置是否启用多条回复 |
| 统计分析 | 低 | 分析中间消息使用频率和效果 |

---

## 相关文档

- [Tool & Action Layer — v0.5](./tool-action-layer-v0.5.md)
- [Dream Cycle — v0.75](./dream-cycle-v0.75.md)
