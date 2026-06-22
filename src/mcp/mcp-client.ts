import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

interface StdioMcpClientOptions {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  env?: Record<string, string | undefined>;
}

export interface McpToolResult {
  content?: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export class StdioMcpClient {
  private process: ChildProcessWithoutNullStreams | null = null;
  private connectPromise: Promise<void> | null = null;
  private nextId = 1;
  private stdoutBuffer = "";
  private stderrTail = "";
  private readonly pending = new Map<number, PendingRequest>();

  constructor(private readonly options: StdioMcpClientOptions) {}

  async connect(): Promise<void> {
    if (this.process) return;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = this.start();
    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async start(): Promise<void> {
    const child = spawn(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        LOGNAME: process.env.LOGNAME,
        SHELL: process.env.SHELL,
        TMPDIR: process.env.TMPDIR,
        CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
        CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS: "1",
        ...this.options.env,
      },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.process = child;

    child.stdout.on("data", (chunk: Buffer) => this.handleStdout(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      this.stderrTail = (this.stderrTail + chunk.toString("utf8")).slice(-4000);
    });
    child.on("error", (error) => this.handleClose(error));
    child.on("close", (code) => {
      this.handleClose(new Error(
        `MCP process exited with code ${code ?? "unknown"}. ${this.stderrTail}`.trim()
      ));
    });

    await new Promise<void>((resolve, reject) => {
      child.once("spawn", resolve);
      child.once("error", reject);
    });

    await this.requestRaw("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "lusiyuan-core", version: "0.1.0" },
    });
    this.notify("notifications/initialized", {});
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    await this.connect();
    const result = await this.requestRaw("tools/call", { name, arguments: args }) as McpToolResult;
    if (result.isError) {
      const detail = result.content?.map((item) => item.text ?? "").filter(Boolean).join("\n");
      throw new Error(detail || `MCP tool ${name} failed`);
    }
    return result;
  }

  async listTools(): Promise<unknown> {
    await this.connect();
    return this.requestRaw("tools/list", {});
  }

  async disconnect(): Promise<void> {
    const child = this.process;
    if (!child) return;
    this.process = null;
    child.stdin.end();
    await Promise.race([
      new Promise<void>((resolve) => child.once("close", () => resolve())),
      new Promise<void>((resolve) => setTimeout(resolve, 2000)),
    ]);
    if (child.exitCode === null) child.kill("SIGTERM");
  }

  private requestRaw(method: string, params: Record<string, unknown>): Promise<unknown> {
    const child = this.process;
    if (!child?.stdin.writable) throw new Error("MCP client is not connected");
    const id = this.nextId++;
    const timeoutMs = this.options.timeoutMs ?? 45000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request timed out: ${method}`));
      }, timeoutMs);
      timer.unref();
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  private notify(method: string, params: Record<string, unknown>): void {
    if (!this.process?.stdin.writable) return;
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  private handleStdout(chunk: Buffer): void {
    this.stdoutBuffer += chunk.toString("utf8");
    while (true) {
      const newline = this.stdoutBuffer.indexOf("\n");
      if (newline < 0) break;
      const line = this.stdoutBuffer.slice(0, newline).replace(/\r$/, "");
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (!line.trim()) continue;
      try {
        const message = JSON.parse(line) as JsonRpcResponse & { method?: string };
        if (typeof message.id === "number" && !message.method) {
          const pending = this.pending.get(message.id);
          if (!pending) continue;
          clearTimeout(pending.timer);
          this.pending.delete(message.id);
          if (message.error) {
            pending.reject(new Error(`${message.error.message} (${message.error.code})`));
          } else {
            pending.resolve(message.result);
          }
        } else if (typeof message.id === "number" && message.method) {
          this.process?.stdin.write(`${JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32601, message: "Client method not supported" },
          })}\n`);
        }
      } catch (error) {
        console.warn("Ignored invalid MCP stdio message:", error);
      }
    }
  }

  private handleClose(error: Error): void {
    this.process = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

export function mcpText(result: McpToolResult): string {
  return result.content
    ?.filter((item) => item.type === "text" && item.text)
    .map((item) => item.text)
    .join("\n") ?? "";
}
