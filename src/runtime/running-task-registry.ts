import { randomUUID } from "node:crypto";

export type RunningTaskKind = "chat" | "dream" | "maintenance";
export type RunningTaskStatus = "running" | "cancelling";

export interface RunningTask {
  id: string;
  kind: RunningTaskKind;
  label: string;
  status: RunningTaskStatus;
  source: string | null;
  channel: string | null;
  userId: string | null;
  conversationId: string | null;
  startedAt: string;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
  ageMs: number;
}

interface RunningTaskRecord {
  id: string;
  kind: RunningTaskKind;
  label: string;
  status: RunningTaskStatus;
  source: string | null;
  channel: string | null;
  userId: string | null;
  conversationId: string | null;
  startedAt: Date;
  cancelRequestedAt: Date | null;
  cancelReason: string | null;
  controller: AbortController;
}

export interface StartRunningTaskInput {
  id?: string;
  kind: RunningTaskKind;
  label: string;
  source?: string | null;
  channel?: string | null;
  userId?: string | null;
  conversationId?: string | null;
}

export interface RunningTaskHandle {
  id: string;
  signal: AbortSignal;
  task(): RunningTask;
  cancel(reason?: string): RunningTask;
  finish(): void;
}

export class TaskCancelledError extends Error {
  readonly code = "TASK_CANCELLED";

  constructor(message = "Task cancelled") {
    super(message);
    this.name = "TaskCancelledError";
  }
}

function publicTask(record: RunningTaskRecord): RunningTask {
  return {
    id: record.id,
    kind: record.kind,
    label: record.label,
    status: record.status,
    source: record.source,
    channel: record.channel,
    userId: record.userId,
    conversationId: record.conversationId,
    startedAt: record.startedAt.toISOString(),
    cancelRequestedAt: record.cancelRequestedAt?.toISOString() ?? null,
    cancelReason: record.cancelReason,
    ageMs: Date.now() - record.startedAt.getTime(),
  };
}

export function throwIfTaskCancelled(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  const reason = signal.reason;
  if (reason instanceof Error) throw reason;
  throw new TaskCancelledError(typeof reason === "string" ? reason : undefined);
}

export function isTaskCancellationError(
  error: unknown,
  signal?: AbortSignal
): boolean {
  if (error instanceof TaskCancelledError) return true;
  if (!signal?.aborted) return false;
  if (!(error instanceof Error)) return true;
  return (
    error.name === "AbortError" ||
    error.name === "TaskCancelledError" ||
    error.message.toLowerCase().includes("abort") ||
    error.message.toLowerCase().includes("cancel")
  );
}

class RunningTaskRegistry {
  private tasks = new Map<string, RunningTaskRecord>();

  start(input: StartRunningTaskInput): RunningTaskHandle {
    const id = input.id ?? randomUUID();
    if (this.tasks.has(id)) {
      throw new Error(`Running task already exists: ${id}`);
    }

    const record: RunningTaskRecord = {
      id,
      kind: input.kind,
      label: input.label,
      status: "running",
      source: input.source ?? null,
      channel: input.channel ?? null,
      userId: input.userId ?? null,
      conversationId: input.conversationId ?? null,
      startedAt: new Date(),
      cancelRequestedAt: null,
      cancelReason: null,
      controller: new AbortController(),
    };

    this.tasks.set(id, record);

    return {
      id,
      signal: record.controller.signal,
      task: () => publicTask(record),
      cancel: (reason?: string) => this.cancel(id, reason) ?? publicTask(record),
      finish: () => this.finish(id),
    };
  }

  list(): RunningTask[] {
    return [...this.tasks.values()]
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .map(publicTask);
  }

  get(id: string): RunningTask | null {
    const record = this.tasks.get(id);
    return record ? publicTask(record) : null;
  }

  signal(id: string): AbortSignal | null {
    return this.tasks.get(id)?.controller.signal ?? null;
  }

  cancel(id: string, reason = "cancelled"): RunningTask | null {
    const record = this.tasks.get(id);
    if (!record) return null;

    record.status = "cancelling";
    record.cancelRequestedAt = record.cancelRequestedAt ?? new Date();
    record.cancelReason = reason;
    if (!record.controller.signal.aborted) {
      record.controller.abort(new TaskCancelledError(reason));
    }
    return publicTask(record);
  }

  finish(id: string): void {
    this.tasks.delete(id);
  }
}

export const runningTaskRegistry = new RunningTaskRegistry();
