// send-intermediate-message.ts — Send intermediate messages during conversation

import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

export const sendIntermediateMessageTool: ToolDefinition<
  { content: string; style?: string },
  { content: string; style: string; delay_ms: number; is_intermediate: boolean }
> = {
  name: "send_intermediate_message",
  description: `发送一条中间消息给用户（在最终回复之前）。

适用场景：
1. 工具调用前的即时反应（如"我去看看"、"稍等，我查一下"）
2. 分段回复长内容（先概述，再详细）
3. 表达思考过程（如"让我想想..."、"有意思..."）

使用建议：
- 保持自然，不要过度使用（建议每次对话 1-3 条）
- 中间消息要简短（1-2 句话）
- 适合在调用工具前表达即时反应
- 可以用来分段回复，让对话更自然

注意：这条消息会立即发送给用户，然后你可以继续调用工具或给出最终回复。`,

  parameters: {
    type: "object",
    properties: {
      content: {
        type: "string",
        description: "中间消息的内容（简短，1-2 句话）",
      },
      style: {
        type: "string",
        enum: ["excited", "calm", "formal", "casual"],
        description: "可选：消息风格提示（用于未来的个性化控制）。excited=兴奋/激动，calm=冷静/思考，formal=正式/说正事，casual=随意/闲聊",
      },
    },
    required: ["content"],
  },

  enabled: true,
  riskLevel: "low",

  async handler(input: { content: string; style?: string }, _context: ToolExecutionContext) {
    const { content, style } = input;

    if (!content || content.trim().length === 0) {
      throw new Error("消息内容不能为空");
    }

    // TODO: 未来可以根据 style 参数调整延迟时间和发送策略
    // - excited: 更短的延迟，可能更多分条
    // - calm: 稍长的延迟，更完整的表达
    // - formal: 更结构化的分段
    // - casual: 更随意的节奏

    // 随机延迟 100-500ms，模拟打字（考虑到 LLM 本身就慢）
    const delay = Math.floor(Math.random() * 400) + 100;

    return {
      content,
      style: style || "casual",
      delay_ms: delay,
      is_intermediate: true,
    };
  },
};
