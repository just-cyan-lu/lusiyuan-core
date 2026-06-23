import type { ToolDefinition } from "./tool.types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyToolDefinition = ToolDefinition<any, any>;

export class ToolRegistry {
  private tools = new Map<string, AnyToolDefinition>();

  register(tool: AnyToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): AnyToolDefinition | undefined {
    const tool = this.tools.get(name);
    return tool ? this.resolve(tool) : undefined;
  }

  listEnabled(): AnyToolDefinition[] {
    return [...this.tools.values()].map((tool) => this.resolve(tool)).filter((tool) => tool.enabled);
  }

  listAll(): AnyToolDefinition[] {
    return [...this.tools.values()].map((tool) => this.resolve(tool));
  }

  private resolve(tool: AnyToolDefinition): AnyToolDefinition {
    return tool.runtimeAccess ? { ...tool, ...tool.runtimeAccess() } : tool;
  }
}

export const toolRegistry = new ToolRegistry();
