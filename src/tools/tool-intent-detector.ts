import { modelProvider } from "../core/model-provider.js";
import { toolRegistry } from "./tool-registry.js";

export interface DetectedToolIntent {
  toolName: string;
  input: Record<string, unknown>;
  confidence: number;
  reasoning?: string;
}

interface DetectionResult {
  intents: DetectedToolIntent[];
}

export class ToolIntentDetector {
  async detect(
    userMessage: string,
    assistantDraft: string,
    userId: string
  ): Promise<DetectedToolIntent[]> {
    const tools = toolRegistry.listEnabled();
    if (tools.length === 0) return [];

    const toolList = tools
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");

    const result = await modelProvider.chatJson<DetectionResult>([
      {
        role: "system",
        content: `你是一个工具意图检测器。分析用户消息和助手的回复，判断助手是否需要调用工具来完成任务。

可用工具：
${toolList}

**关键判断规则：**
- 如果助手说"我去看看"、"让我查一下"、"我搜索一下"等表达，说明他需要工具
- 如果用户要求查看外部平台（小红书、网页、URL），助手必须用工具，不能假装
- 如果助手的回复中包含具体的外部信息（通知内容、搜索结果），但这些信息不在对话历史中，说明他需要工具

返回 JSON 格式：
{
  "intents": [
    {
      "toolName": "工具名称",
      "input": { "参数": "值" },
      "confidence": 0.0-1.0,
      "reasoning": "为什么需要这个工具"
    }
  ]
}

如果不需要任何工具，返回 { "intents": [] }。
只返回置信度 >= 0.7 的工具调用。每条消息最多返回 3 个工具。`,
      },
      {
        role: "user",
        content: `用户消息：${userMessage.slice(0, 1000)}\n\n助手回复：${assistantDraft.slice(0, 1000)}`,
      },
    ]);

    const intents = result.intents ?? [];
    const filtered = intents
      .filter((i) => i.confidence >= 0.7 && toolRegistry.get(i.toolName))
      .slice(0, 3);

    console.log(`[tool-intent] detected ${filtered.length} intents:`, filtered.map(i => i.toolName));

    return filtered;
  }
}

export const toolIntentDetector = new ToolIntentDetector();
