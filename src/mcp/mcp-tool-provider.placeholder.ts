export class McpToolProvider {
  async loadTools(): Promise<never[]> {
    throw new Error("MCP is not enabled in v0.5");
  }
}

export const mcpToolProvider = new McpToolProvider();
