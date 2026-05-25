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
        content: `你是一个工具意图检测器。根据用户消息和助手草稿回复，判断是否需要调用工具。
可用工具：
${toolList}

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
        content: `用户消息：${userMessage.slice(0, 1000)}\n\n助手草稿：${assistantDraft.slice(0, 1000)}`,
      },
    ]);

    const intents = result.intents ?? [];
    return intents
      .filter((i) => i.confidence >= 0.7 && toolRegistry.get(i.toolName))
      .slice(0, 3);
  }
}

export const toolIntentDetector = new ToolIntentDetector();
