export interface CdpPageContent {
  url: string;
  title?: string;
  content: string;
  tool: "cdp";
}

export interface CdpReadOptions {
  url: string;
  waitMs?: number;
}
