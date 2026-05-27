export interface PageContent {
  url: string;
  title?: string;
  content: string;
  tool: "jina" | "playwright" | "cdp";
  screenshotPath?: string;
}

export interface ReadPageOptions {
  url: string;
  screenshot?: boolean;
  preferTool?: "jina" | "playwright";
}
