import { externalInboxService } from "../../external-inbox/external-inbox.service.js";
import { env } from "../../utils/env.js";
import type { ToolDefinition, ToolExecutionContext } from "../tool.types.js";

interface SyncExternalInboxInput {
  platform: "xiaohongshu";
}

interface SyncExternalInboxOutput {
  platform: string;
  fetched: number;
  saved: number;
  skipped: number;
}

async function syncHandler(
  input: SyncExternalInboxInput,
  _context: ToolExecutionContext
): Promise<SyncExternalInboxOutput> {
  return externalInboxService.sync(input.platform);
}

interface ListExternalInboxInput {
  platform?: "xiaohongshu";
  limit?: number;
}

interface ListExternalInboxOutput {
  items: Array<{
    id: string;
    platform: string;
    type: string;
    sourceId: string;
    title?: string | null;
    content: string;
    author?: string | null;
    url?: string | null;
    syncedAt: Date;
  }>;
}

async function listHandler(
  input: ListExternalInboxInput,
  _context: ToolExecutionContext
): Promise<ListExternalInboxOutput> {
  const items = await externalInboxService.list(input.platform, input.limit);
  return { items };
}

export const syncExternalInboxTool: ToolDefinition<
  SyncExternalInboxInput,
  SyncExternalInboxOutput
> = {
  name: "sync_external_inbox",
  description:
    "同步外部平台的 inbox/通知/评论。目前支持小红书（xiaohongshu）。需要先用 CDP 连接到已登录的 Chrome。返回抓取、保存、跳过的条目数量。",
  riskLevel: "low",
  ownerOnly: true,
  enabled: env.EXTERNAL_INBOX_ENABLED,
  handler: syncHandler,
};

export const listExternalInboxTool: ToolDefinition<
  ListExternalInboxInput,
  ListExternalInboxOutput
> = {
  name: "list_external_inbox",
  description:
    "列出已同步的外部平台 inbox 条目。可选按平台过滤，可选限制返回数量（默认 50）。",
  riskLevel: "low",
  ownerOnly: true,
  enabled: env.EXTERNAL_INBOX_ENABLED,
  handler: listHandler,
};
