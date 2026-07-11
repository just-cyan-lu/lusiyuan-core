interface GuardEntry {
  totalCalls: number;
  mutationCalls: number;
  expiresAt: number;
}

export class HomeToolExecutionGuard {
  private readonly entries = new Map<string, GuardEntry>();

  consume(input: {
    key: string;
    mutation: boolean;
    maxCalls: number;
    maxMutations: number;
    ttlMs?: number;
  }): void {
    const now = Date.now();
    this.cleanup(now);
    const entry = this.entries.get(input.key) ?? {
      totalCalls: 0,
      mutationCalls: 0,
      expiresAt: now + (input.ttlMs ?? 5 * 60_000),
    };

    if (entry.totalCalls >= input.maxCalls) {
      throw new Error("本条消息的 Home Assistant 调用次数已达上限。");
    }
    if (input.mutation && entry.mutationCalls >= input.maxMutations) {
      throw new Error("本条消息的 Home Assistant 状态变更次数已达上限。");
    }

    entry.totalCalls += 1;
    if (input.mutation) entry.mutationCalls += 1;
    this.entries.set(input.key, entry);
  }

  private cleanup(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
