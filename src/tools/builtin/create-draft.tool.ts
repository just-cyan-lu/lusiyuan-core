import { draftService } from "../../drafts/draft.service.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";
import type { DraftType } from "../../drafts/draft.types.js";

interface CreateDraftInput {
  type: DraftType;
  title?: string;
  content: string;
  targetPlatform?: string;
  targetContext?: string;
}

interface CreateDraftOutput {
  draftId: string;
  type: string;
  title?: string | null;
  content: string;
  status: "draft";
  createdAt: string;
}

async function handler(
  input: CreateDraftInput,
  context: ToolExecutionContext
): Promise<CreateDraftOutput> {
  const content = input.content.slice(0, 5000);
  const draft = await draftService.createDraft({
    type: input.type,
    title: input.title,
    content,
    targetPlatform: input.targetPlatform,
    targetContext: input.targetContext,
    userId: context.userId,
    conversationId: context.conversationId,
    channel: context.channel,
    createdByTool: "create_draft",
  });

  return {
    draftId: draft.id,
    type: draft.type,
    title: draft.title,
    content: draft.content,
    status: "draft",
    createdAt: draft.createdAt.toISOString(),
  };
}

export const createDraftTool: ToolDefinition<
  CreateDraftInput,
  CreateDraftOutput
> = {
  name: "create_draft",
  description: "创建草稿（回复、文章、脚本等），不发送，仅保存供用户审核",
  riskLevel: "low",
  enabled: true,
  handler,
};
