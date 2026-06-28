export interface PageContent {
  url: string;
  title?: string;
  content: string;
  tool: "jina" | "playwright" | "chrome-devtools-mcp";
  screenshotBase64?: string;  // base64 encoded PNG screenshot
}

export interface ReadPageOptions {
  url: string;
  screenshot?: boolean;
  preferTool?: "jina" | "playwright";
  signal?: AbortSignal;
}
