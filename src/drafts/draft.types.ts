export type DraftType =
  | "reply"
  | "social_post"
  | "article"
  | "script"
  | "message"
  | "other";

export type DraftStatus = "draft" | "reviewed" | "approved" | "rejected" | "sent";

export interface CreateDraftInput {
  type: DraftType;
  title?: string;
  content: string;
  targetPlatform?: string;
  targetContext?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  conversationId?: string;
  channel?: string;
  createdByTool?: string;
}
