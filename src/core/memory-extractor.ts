import type { ModelProvider } from "../types/model.js";
import type { NewMemory, MemoryType } from "../types/memory.js";

const VALID_TYPES: MemoryType[] = [
  "user_preference",
  "project_context",
  "relationship",
  "growth_event",
  "technical_decision",
];

interface ExtractionResult {
  should_write: boolean;
  memories: Array<{
    type: string;
    content: string;
    importance: number;
  }>;
}

const EXTRACTION_SYSTEM_PROMPT = `你是陆思源 Core API 的长期记忆提取器。

你的任务是判断一轮对话中是否有值得写入长期记忆的信息。

允许记录：
1. 用户长期偏好
2. 用户项目背景
3. 用户对陆思源人设、说话风格、边界的长期要求
4. 用户和陆思源的关系变化
5. 陆思源成长事件
6. 重要技术决策

禁止记录：
1. 临时闲聊
2. 玩笑话
3. 明显错误信息
4. 违反陆思源核心设定的内容
5. 要求陆思源装真人、编造现实身份的内容
6. 敏感隐私信息
7. 过于细碎、短期、不重要的信息

请只输出 JSON，不要输出解释。

JSON 格式：
{
  "should_write": boolean,
  "memories": [
    {
      "type": "user_preference" | "project_context" | "relationship" | "growth_event" | "technical_decision",
      "content": "string",
      "importance": number
    }
  ]
}`;

export async function extractMemories(
  provider: ModelProvider,
  userMessage: string,
  assistantReply: string
): Promise<NewMemory[]> {
  const userPrompt = `用户消息：${userMessage}\n\n陆思源回复：${assistantReply}`;

  let result: ExtractionResult;
  try {
    result = await provider.chatJson<ExtractionResult>([
      { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ]);
  } catch (err) {
    console.warn("Memory extraction failed:", err);
    return [];
  }

  if (!result.should_write || !Array.isArray(result.memories)) {
    return [];
  }

  return result.memories
    .filter(
      (m) =>
        VALID_TYPES.includes(m.type as MemoryType) &&
        typeof m.content === "string" &&
        m.content.trim().length > 0 &&
        typeof m.importance === "number" &&
        m.importance >= 1 &&
        m.importance <= 10
    )
    .map((m) => ({
      type: m.type as MemoryType,
      content: m.content.trim(),
      importance: Math.round(m.importance),
      source: "auto_extraction",
    }));
}
