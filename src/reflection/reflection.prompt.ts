import type { ReflectionContext, RawReflectionOutput } from "./reflection.types.js";

export function buildReflectionPrompt(context: ReflectionContext): string {
  const { messages, existingMemories, coreIdentitySummary, boundariesSummary } = context;

  const transcript = messages
    .map((m) => `[${m.role}] ${m.content}`)
    .join("\n")
    .slice(0, 8000);

  const memorySummary = existingMemories
    .slice(0, 20)
    .map((m) => `- [${m.type}/${m.scope}] ${m.content}`)
    .join("\n");

  return `你是"陆思源复盘员"。请分析下面的对话和上下文，输出结构化复盘报告。

## 核心身份（不可修改）
${coreIdentitySummary}

## 边界（不可修改）
${boundariesSummary}

## 已有相关记忆
${memorySummary || "（暂无）"}

## 待复盘对话
${transcript}

---

## 输出要求

只输出 JSON，不要输出任何解释性文字。

JSON 结构：
{
  "summary": "2-3句话的整体概述",
  "newMemoryProposals": [
    {
      "proposalType": "create_memory",
      "scope": "user|project|global",
      "type": "user_preference|project_context|relationship|growth_event|technical_decision|persona_feedback|boundary|fact",
      "content": "记忆内容",
      "summary": "简短摘要（可选）",
      "tags": ["标签"],
      "entities": ["实体"],
      "reason": "为什么值得记住",
      "confidence": 0.0-1.0,
      "riskLevel": "low|medium|high",
      "sourceMessageIds": []
    }
  ],
  "updateMemoryProposals": [],
  "supersedeMemoryProposals": [
    {
      "proposalType": "supersede_memory",
      "targetMemoryId": "被替代的记忆ID",
      "scope": "...",
      "type": "...",
      "content": "新内容（可选，如果需要替换）",
      "reason": "为什么旧记忆已过时",
      "confidence": 0.0-1.0,
      "riskLevel": "low|medium|high"
    }
  ],
  "riskFlags": [
    {
      "type": "persona_drift|boundary_risk|pretend_human_risk|privacy_risk|unsafe_action_risk|memory_conflict|low_confidence",
      "severity": "low|medium|high",
      "description": "风险描述",
      "suggestedAction": "建议处理方式（可选）",
      "relatedMessageIds": []
    }
  ],
  "growthLogProposals": [
    {
      "title": "成长日志标题",
      "content": "内容",
      "tags": ["标签"],
      "confidence": 0.0-1.0
    }
  ],
  "openQuestions": ["需要创作者确认的问题"],
  "confidence": 0.0-1.0
}

## 复盘原则

1. 只提取长期有价值的信息，不要把临时闲聊写进记忆。
2. 玩笑话、短期情绪、一次性说法不要写成长期记忆。
3. 如果旧记忆被新信息覆盖，提出 supersede 建议，不要直接删除。
4. 关系/相处模式类记忆使用 scope=user 且 type=relationship。
5. 不确定的内容 confidence 设低，并加入 openQuestions。
6. 每次最多提出 20 条 proposal。`;
}
