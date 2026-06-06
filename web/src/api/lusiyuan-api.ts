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

export type MemoryProposalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "applied"
  | "ignored";

export interface MemoryProposal {
  id: string;
  reportId: string;
  userId: string | null;
  conversationId: string | null;
  channel: string | null;
  proposalType: string;
  targetMemoryId: string | null;
  scope: string;
  type: string;
  content: string;
  summary: string | null;
  tags: unknown;
  entities: unknown;
  reason: string;
  confidence: number;
  riskLevel: "low" | "medium" | "high" | string;
  status: MemoryProposalStatus | string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  appliedMemoryId: string | null;
  sourceMessageIds: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text) as { error?: string };
        if (data.error) throw new Error(data.error);
      } catch (error) {
        if (error instanceof Error && error.name === "Error") throw error;
      }
    }
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

export async function fetchMemoryProposals(input: {
  token: string;
  status?: string;
  limit?: number;
}): Promise<MemoryProposal[]> {
  const params = new URLSearchParams();
  if (input.status && input.status !== "all") params.set("status", input.status);
  if (input.limit) params.set("limit", String(input.limit));

  const response = await fetch(
    `${API_BASE_URL}/v1/reflection/proposals?${params.toString()}`,
    { headers: adminHeaders(input.token) }
  );
  const data = await parseJsonResponse<{ proposals: MemoryProposal[] }>(
    response,
    "无法读取记忆提案"
  );
  return data.proposals ?? [];
}

export async function approveMemoryProposal(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/reflection/proposals/${encodeURIComponent(input.proposalId)}/approve`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "批准提案失败"
  );
  return data.proposal;
}

export async function rejectMemoryProposal(input: {
  token: string;
  proposalId: string;
  reason?: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/reflection/proposals/${encodeURIComponent(input.proposalId)}/reject`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: input.reviewerId ?? "admin:web",
        reason: input.reason,
      }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "拒绝提案失败"
  );
  return data.proposal;
}

export async function applyMemoryProposal(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/reflection/proposals/${encodeURIComponent(input.proposalId)}/apply`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "应用提案失败"
  );
  return data.proposal;
}

export async function applyMemoryProposalGlobally(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/reflection/proposals/${encodeURIComponent(input.proposalId)}/apply-global`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "全局应用提案失败"
  );
  return data.proposal;
}

export async function revokeMemoryProposal(input: {
  token: string;
  proposalId: string;
  reviewerId?: string;
}): Promise<MemoryProposal> {
  const response = await fetch(
    `${API_BASE_URL}/v1/reflection/proposals/${encodeURIComponent(input.proposalId)}/revoke`,
    {
      method: "POST",
      headers: {
        ...adminHeaders(input.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: input.reviewerId ?? "admin:web" }),
    }
  );
  const data = await parseJsonResponse<{ proposal: MemoryProposal }>(
    response,
    "撤回提案失败"
  );
  return data.proposal;
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
