import { createHash } from "node:crypto";
import { env } from "../utils/env.js";
import { runtimeConfig } from "../config/runtime-settings.service.js";
import type { ToolExecutionContext } from "../tools/tool.types.js";
import {
  HomeAssistantClient,
  type HomeAssistantClientLike,
} from "./home-assistant-client.js";
import { HomeToolExecutionGuard } from "./home-tool-execution-guard.js";
import type {
  HomeAssistantServiceCallInput,
  HomeAssistantState,
} from "./home-assistant.types.js";

export interface QueryHomeStateInput {
  entity_id?: string;
  domain?: string;
}

export interface ControlHomeInput extends HomeAssistantServiceCallInput {}

interface IdempotentResult {
  value: ControlHomeOutput;
  expiresAt: number;
}

export interface QueryHomeStateOutput {
  entities: HomeAssistantState[];
}

export interface ControlHomeOutput {
  executed: true;
  domain: string;
  action: string;
  response: unknown;
  reused?: boolean;
}

export class HomeAutomationService {
  private readonly guard = new HomeToolExecutionGuard();
  private readonly actionResults = new Map<string, IdempotentResult>();

  constructor(
    private readonly clientFactory: () => HomeAssistantClientLike = () =>
      new HomeAssistantClient({
        baseUrl: env.HOME_ASSISTANT_BASE_URL,
        token: env.HOME_ASSISTANT_TOKEN,
      })
  ) {}

  async queryState(
    input: QueryHomeStateInput,
    context: ToolExecutionContext
  ): Promise<QueryHomeStateOutput> {
    this.guard.consume({
      key: contextKey(context),
      mutation: false,
      maxCalls: runtimeConfig.HOME_ASSISTANT_MAX_CALLS_PER_TURN,
      maxMutations: runtimeConfig.HOME_ASSISTANT_MAX_MUTATIONS_PER_TURN,
    });
    const client = this.clientFactory();
    if (input.entity_id) {
      return { entities: [await client.getState(input.entity_id, context.signal)] };
    }
    const entities = await client.listStates(context.signal);
    return {
      entities: input.domain
        ? entities.filter((entity) => entity.entity_id.startsWith(`${input.domain}.`))
        : entities,
    };
  }

  async control(
    input: ControlHomeInput,
    context: ToolExecutionContext
  ): Promise<ControlHomeOutput> {
    if (!input.domain?.trim() || !input.action?.trim()) {
      throw new Error("Home Assistant 控制需要 domain 和 action。");
    }
    if (!allowedDomains().has("*") && !allowedDomains().has(input.domain)) {
      throw new Error(`Home Assistant domain 未启用：${input.domain}`);
    }

    const key = actionKey(context, input);
    const cached = this.actionResults.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.value, reused: true };
    }

    this.guard.consume({
      key: contextKey(context),
      mutation: true,
      maxCalls: runtimeConfig.HOME_ASSISTANT_MAX_CALLS_PER_TURN,
      maxMutations: runtimeConfig.HOME_ASSISTANT_MAX_MUTATIONS_PER_TURN,
    });
    const response = await this.clientFactory().callService(input, context.signal);
    const value: ControlHomeOutput = {
      executed: true,
      domain: input.domain,
      action: input.action,
      response,
    };
    this.cleanupResults();
    this.actionResults.set(key, { value, expiresAt: Date.now() + 5 * 60_000 });
    return value;
  }

  private cleanupResults(): void {
    const now = Date.now();
    for (const [key, result] of this.actionResults) {
      if (result.expiresAt <= now) this.actionResults.delete(key);
    }
  }
}

function allowedDomains(): Set<string> {
  return new Set(
    runtimeConfig.HOME_ASSISTANT_ALLOWED_DOMAINS
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function contextKey(context: ToolExecutionContext): string {
  return context.messageId ?? context.requestId ?? context.conversationId ?? `${context.channel}:${context.userId}`;
}

function actionKey(context: ToolExecutionContext, input: ControlHomeInput): string {
  return createHash("sha256")
    .update(`${contextKey(context)}:${stableJson(input)}`)
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export const homeAutomationService = new HomeAutomationService();
