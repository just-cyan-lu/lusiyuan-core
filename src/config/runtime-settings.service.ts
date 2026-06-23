import type { Prisma } from "@prisma/client";
import cron from "node-cron";
import { prisma } from "../db/prisma.js";
import {
  isRuntimeSettingKey,
  runtimeSettingDefinitions,
  type RuntimeSettingKey,
  type RuntimeSettingValues,
} from "./runtime-settings.registry.js";

type SettingValue = boolean | number | string;
type ChangeListener = (keys: RuntimeSettingKey[]) => void | Promise<void>;

function validateValue(key: RuntimeSettingKey, value: unknown): SettingValue {
  const definition = runtimeSettingDefinitions[key];
  if (definition.type === "boolean") {
    if (typeof value !== "boolean") throw new Error(`${key} must be boolean`);
    return value;
  }
  if (definition.type === "integer" || definition.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${key} must be a number`);
    if (definition.type === "integer" && !Number.isInteger(value)) throw new Error(`${key} must be an integer`);
    if ("min" in definition && definition.min !== undefined && value < definition.min) throw new Error(`${key} must be at least ${definition.min}`);
    if ("max" in definition && definition.max !== undefined && value > definition.max) throw new Error(`${key} must be at most ${definition.max}`);
    return value;
  }
  if (typeof value !== "string") throw new Error(`${key} must be a string`);
  if (definition.type === "select" && "options" in definition && definition.options && !definition.options.includes(value as never)) {
    throw new Error(`${key} must be one of: ${definition.options.join(", ")}`);
  }
  if ((key === "DREAM_CRON" || key === "RUNTIME_AUTONOMY_CRON") && !cron.validate(value)) {
    throw new Error(`${key} is not a valid cron expression`);
  }
  if (key === "DREAM_TIMEZONE" || key === "RUNTIME_AUTONOMY_TIMEZONE") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
    } catch {
      throw new Error(`${key} is not a valid time zone`);
    }
  }
  if (key === "CHROME_DEVTOOLS_MCP_BROWSER_URL") {
    const url = new URL(value);
    if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
      throw new Error(`${key} must point to local Chrome`);
    }
  }
  return value;
}

class RuntimeSettingsService {
  private values = new Map<RuntimeSettingKey, SettingValue>();
  private listeners = new Set<ChangeListener>();
  private initialized = false;

  constructor() {
    for (const [key, definition] of Object.entries(runtimeSettingDefinitions)) {
      this.values.set(key as RuntimeSettingKey, definition.defaultValue);
    }
  }

  async initialize(): Promise<void> {
    const rows = await prisma.systemSetting.findMany();
    for (const row of rows) {
      if (!isRuntimeSettingKey(row.key)) continue;
      try {
        this.values.set(row.key, validateValue(row.key, row.value));
      } catch (error) {
        console.warn(`[runtime-settings] ignored invalid database value for ${row.key}:`, error);
      }
    }
    this.initialized = true;
    console.log(`[runtime-settings] loaded ${rows.length} database overrides`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  get<K extends RuntimeSettingKey>(key: K): RuntimeSettingValues[K] {
    return this.values.get(key) as RuntimeSettingValues[K];
  }

  list() {
    return Object.entries(runtimeSettingDefinitions).map(([rawKey, definition]) => {
      const key = rawKey as RuntimeSettingKey;
      return { key, ...definition, value: this.get(key) };
    });
  }

  subscribe(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  withTemporaryValues<T>(input: Partial<RuntimeSettingValues>, operation: () => T): T {
    const previous = new Map<RuntimeSettingKey, SettingValue>();
    for (const [rawKey, rawValue] of Object.entries(input)) {
      if (!isRuntimeSettingKey(rawKey)) throw new Error(`Unknown runtime setting: ${rawKey}`);
      previous.set(rawKey, this.get(rawKey));
      this.values.set(rawKey, validateValue(rawKey, rawValue));
    }
    try {
      return operation();
    } finally {
      for (const [key, value] of previous) this.values.set(key, value);
    }
  }

  async updateMany(
    input: Record<string, unknown>,
    context: { changedBy?: string; source?: string } = {}
  ) {
    const changes = Object.entries(input).map(([key, rawValue]) => {
      if (!isRuntimeSettingKey(key)) throw new Error(`Unknown runtime setting: ${key}`);
      return { key, oldValue: this.get(key), newValue: validateValue(key, rawValue) };
    }).filter((change) => change.oldValue !== change.newValue);

    const candidate = new Map(this.values);
    for (const change of changes) candidate.set(change.key, change.newValue);
    if (Number(candidate.get("CHROME_DEVTOOLS_MCP_SETTLE_MIN_MS")) > Number(candidate.get("CHROME_DEVTOOLS_MCP_SETTLE_MAX_MS"))) {
      throw new Error("Chrome MCP 最短稳定等待不能大于最长稳定等待");
    }
    if (Number(candidate.get("REFLECTION_DEFAULT_MESSAGE_LIMIT")) > Number(candidate.get("REFLECTION_MAX_MESSAGE_LIMIT"))) {
      throw new Error("Reflection 默认消息数不能大于最大消息数");
    }
    if (Number(candidate.get("REPLY_SEGMENT_MIN_CHARS")) > Number(candidate.get("REPLY_SEGMENT_MAX_CHARS"))) {
      throw new Error("回复分条最小字符不能大于最大字符");
    }
    if (Number(candidate.get("REPLY_HUMAN_DELAY_MIN_MS")) > Number(candidate.get("REPLY_HUMAN_DELAY_MAX_MS"))) {
      throw new Error("回复分条最短停顿不能大于最长停顿");
    }

    if (changes.length === 0) {
      return { changedKeys: [] as RuntimeSettingKey[], applyErrors: [] as string[] };
    }

    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.systemSetting.upsert({
          where: { key: change.key },
          create: {
            key: change.key,
            value: change.newValue as Prisma.InputJsonValue,
            updatedBy: context.changedBy,
          },
          update: {
            value: change.newValue as Prisma.InputJsonValue,
            updatedBy: context.changedBy,
          },
        });
        await tx.systemSettingEvent.create({
          data: {
            key: change.key,
            oldValue: change.oldValue as Prisma.InputJsonValue,
            newValue: change.newValue as Prisma.InputJsonValue,
            changedBy: context.changedBy,
            source: context.source ?? "admin",
          },
        });
      }
    });

    for (const change of changes) this.values.set(change.key, change.newValue);
    const changedKeys = changes.map((change) => change.key);
    const applyErrors: string[] = [];
    for (const listener of this.listeners) {
      try {
        await listener(changedKeys);
      } catch (error) {
        applyErrors.push(error instanceof Error ? error.message : String(error));
      }
    }
    return { changedKeys, applyErrors };
  }
}

export const runtimeSettingsService = new RuntimeSettingsService();

export const runtimeConfig = new Proxy({} as RuntimeSettingValues, {
  get(_target, property) {
    if (typeof property !== "string" || !isRuntimeSettingKey(property)) return undefined;
    return runtimeSettingsService.get(property);
  },
});
