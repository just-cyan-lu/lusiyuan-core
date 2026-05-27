export interface InboxItem {
  platform: string;
  sourceId: string;
  type: "comment" | "mention" | "dm_summary";
  content: string;
  authorName?: string;
  postTitle?: string;
  postUrl?: string;
}

export interface SyncResult {
  platform: string;
  fetched: number;
  saved: number;
  skipped: number;
}
