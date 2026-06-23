export type XiaohongshuReplyRisk = "ready" | "review" | "skip";
export type XiaohongshuPostType =
  | "daily"
  | "making"
  | "technical"
  | "thought"
  | "showcase"
  | "announcement"
  | "interactive";
export type XiaohongshuCommentType =
  | "compliment"
  | "daily_joke"
  | "emotional"
  | "identity_question"
  | "romance_boundary"
  | "tech_question"
  | "private_contact"
  | "criticism"
  | "unclear";
export type XiaohongshuAwareness = "aware" | "unaware" | "uncertain";
export type XiaohongshuReplyVoice = "siyuan" | "creator" | "hybrid" | "no_reply";
export type XiaohongshuBoundary = "none" | "soft" | "clear";

export interface XiaohongshuReplyConfig {
  version: number;
  accessMode: "off" | "owner_only" | "on";
  accountMode: "siyuan_first" | "creator_first" | "mixed";
  maxReplyChars: number;
  prompt: string;
}

export interface XiaohongshuReplyInput {
  postTitle: string;
  postCaption?: string | null;
  postType: XiaohongshuPostType | string;
  comment: string;
  threadContext?: string | null;
}

export interface XiaohongshuReplyOutput {
  risk: XiaohongshuReplyRisk;
  comment_type: XiaohongshuCommentType;
  awareness: XiaohongshuAwareness;
  voice: XiaohongshuReplyVoice;
  boundary: XiaohongshuBoundary;
  reply: string;
  reason: string;
}
