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
    return this.tools.get(name);
  }

  listEnabled(): AnyToolDefinition[] {
    return [...this.tools.values()].filter((t) => t.enabled);
  }

  listAll(): AnyToolDefinition[] {
    return [...this.tools.values()];
  }
}

export const toolRegistry = new ToolRegistry();
