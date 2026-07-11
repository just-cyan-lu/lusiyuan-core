import type {
  HomeAssistantServiceCallInput,
  HomeAssistantState,
} from "./home-assistant.types.js";

interface HomeAssistantClientOptions {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface HomeAssistantClientLike {
  getState(entityId: string, signal?: AbortSignal): Promise<HomeAssistantState>;
  listStates(signal?: AbortSignal): Promise<HomeAssistantState[]>;
  callService(
    input: HomeAssistantServiceCallInput,
    signal?: AbortSignal
  ): Promise<unknown>;
}

export class HomeAssistantClient implements HomeAssistantClientLike {
  private readonly baseUrl: URL;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HomeAssistantClientOptions) {
    if (!options.baseUrl.trim() || !options.token.trim()) {
      throw new Error("Home Assistant 未配置，请设置 HOME_ASSISTANT_BASE_URL 和 HOME_ASSISTANT_TOKEN。");
    }
    this.baseUrl = new URL(options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getState(entityId: string, signal?: AbortSignal): Promise<HomeAssistantState> {
    return this.request(`/api/states/${encodeURIComponent(entityId)}`, { method: "GET" }, signal) as Promise<HomeAssistantState>;
  }

  async listStates(signal?: AbortSignal): Promise<HomeAssistantState[]> {
    return this.request("/api/states", { method: "GET" }, signal) as Promise<HomeAssistantState[]>;
  }

  async callService(
    input: HomeAssistantServiceCallInput,
    signal?: AbortSignal
  ): Promise<unknown> {
    return this.request(
      `/api/services/${encodeURIComponent(input.domain)}/${encodeURIComponent(input.action)}`,
      {
        method: "POST",
        body: JSON.stringify({
          ...(input.data ?? {}),
          ...(input.target ? { target: input.target } : {}),
        }),
      },
      signal
    );
  }

  private async request(
    path: string,
    init: RequestInit,
    signal?: AbortSignal
  ): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    let response: Response;
    try {
      response = await this.fetchImpl(new URL(path, this.baseUrl), {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: requestSignal,
      });
    } catch (error) {
      if (requestSignal.aborted) {
        throw new Error("Home Assistant 请求超时或被取消。");
      }
      throw error;
    }

    const body = await response.text();
    const payload = body ? parseJson(body) : {};
    if (!response.ok) {
      const detail = payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `HTTP ${response.status}`;
      throw new Error(`Home Assistant 请求失败：${detail}`);
    }
    return payload;
  }
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return { message: value };
  }
}
