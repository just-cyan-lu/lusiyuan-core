import type { ChatRequest, ChatResponse, ConversationMessage } from "../types/chat";

export const API_BASE_URL =
  import.meta.env.VITE_LUSIYUAN_API_BASE_URL ?? "http://localhost:64100";

export interface HealthStatus {
  status: string;
}

export interface ChannelStatus {
  telegram: {
    enabled: boolean;
    mode: string | null;
  };
  weixin: {
    enabled: boolean;
    mode: string | null;
  };
}

export interface RuntimeProvider {
  name: string;
  label: string;
  active: boolean;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  model: string | null;
}

export interface RuntimeConfig {
  activeModelProvider: string;
  providers: RuntimeProvider[];
  channels: {
    telegram: {
      enabled: boolean;
      mode: string | null;
      tokenConfigured: boolean;
      proxyConfigured: boolean;
    };
    weixin: {
      enabled: boolean;
      mode: string | null;
      secretConfigured: boolean;
    };
  };
  features: Record<string, boolean>;
  safety: Record<string, boolean>;
  limits: Record<string, number>;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || fallbackMessage);
  }
  return response.json() as Promise<T>;
}

function adminHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function sendChatMessage(input: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "发送失败");
  }

  return response.json() as Promise<ChatResponse>;
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  const response = await fetch(`${API_BASE_URL}/health`);
  return parseJsonResponse<HealthStatus>(response, "无法读取健康状态");
}

export async function fetchChannelStatus(): Promise<ChannelStatus> {
  const response = await fetch(`${API_BASE_URL}/v1/channels/status`);
  return parseJsonResponse<ChannelStatus>(response, "无法读取渠道状态");
}

export async function fetchRuntimeConfig(token: string): Promise<RuntimeConfig> {
  const response = await fetch(`${API_BASE_URL}/v1/admin/runtime`, {
    headers: adminHeaders(token),
  });
  return parseJsonResponse<RuntimeConfig>(response, "无法读取运行配置");
}

export async function fetchConversationMessages(
  conversationId: string
): Promise<ConversationMessage[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v1/conversations/${encodeURIComponent(conversationId)}/messages`
    );

    if (!response.ok) return [];

    const data = (await response.json()) as { messages: ConversationMessage[] };
    return data.messages ?? [];
  } catch {
    return [];
  }
}
