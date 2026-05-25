export class McpClient {
  async connect(_config: unknown): Promise<void> {
    throw new Error("MCP is not enabled in v0.5");
  }

  async disconnect(): Promise<void> {
    // no-op in placeholder
  }
}

export const mcpClient = new McpClient();
