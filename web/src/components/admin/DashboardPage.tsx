import { useEffect, useMemo, useState } from "react";
import {
  fetchChannelStatus,
  fetchHealthStatus,
  fetchRuntimeConfig,
  fetchRuntimeState,
  type ChannelStatus,
  type HealthStatus,
  type RuntimeConfig,
  type RuntimeProvider,
  type RuntimeState,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface DashboardPageProps {
  adminToken: string;
}

interface DashboardState {
  health: HealthStatus | null;
  channels: ChannelStatus | null;
  runtime: RuntimeConfig | null;
  runtimeState: RuntimeState | null;
  error: string | null;
  loading: boolean;
}

const featureLabels: Record<string, string> = {
  memoryRetrieval: "记忆检索",
  tools: "工具调用",
  reflection: "Reflection",
  dream: "Dream",
  dreamAutoRun: "Dream 自动运行",
  webSearch: "Web Search",
  pageReader: "页面读取",
  mcp: "MCP",
};

const safetyLabels: Record<string, string> = {
  reflectionAutoApply: "Reflection 自动写入",
  dreamAutoApply: "Dream 自动写入",
  toolsAllowMediumRisk: "中风险工具",
  toolsAllowHighRisk: "高风险工具",
};

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function providerReady(provider: RuntimeProvider): boolean {
  return provider.baseUrlConfigured && provider.apiKeyConfigured && Boolean(provider.model);
}

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后，这里会显示实时运行状态。";
  }
  return message || "状态读取失败";
}

export function DashboardPage({ adminToken }: DashboardPageProps) {
  const [state, setState] = useState<DashboardState>({
    health: null,
    channels: null,
    runtime: null,
    runtimeState: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const [health, channels] = await Promise.all([
          fetchHealthStatus(),
          fetchChannelStatus(),
        ]);
        const [runtime, runtimeStateResponse] = adminToken
          ? await Promise.all([
              fetchRuntimeConfig(adminToken),
              fetchRuntimeState(adminToken),
            ])
          : [null, null];
        if (!cancelled) {
          setState({
            health,
            channels,
            runtime,
            runtimeState: runtimeStateResponse?.state ?? null,
            error: null,
            loading: false,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            error: friendlyErrorMessage(error),
            loading: false,
          }));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  const activeProvider = useMemo(
    () => state.runtime?.providers.find((provider) => provider.active) ?? null,
    [state.runtime]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#6f8fb8] px-3 py-1.5 text-xs font-semibold text-white">
              Control Room
            </span>
            <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-3 py-1.5 text-xs text-[#66758a]">
              Web Chat 已并入 Admin
            </span>
          </div>
          <h2 className="mt-5 max-w-3xl text-3xl font-semibold text-[#172033] md:text-5xl">
            陆思源核心系统管理台
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#617188] md:text-base">
            这里集中查看运行态、关系、记忆、Reflection、Dream、配置和聊天入口。长期测试时，先从这里看他最近发生了什么、状态为什么变化、哪些提案还需要审核。
          </p>

          {state.error && (
            <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
              {state.error}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <StatusCard
            label="Core API"
            value={state.health?.status ?? (state.loading ? "checking" : "unknown")}
            active={state.health?.status === "ok"}
          />
          <StatusCard
            label="Admin Token"
            value={adminToken ? "stored locally" : "required for config"}
            active={Boolean(adminToken)}
          />
          <StatusCard
            label="Active Model"
            value={activeProvider?.model ?? state.runtime?.activeModelProvider ?? "token needed"}
            active={Boolean(activeProvider && providerReady(activeProvider))}
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel title="陆思源运行态" subtitle="数据库里的当前状态">
          {state.runtimeState ? (
            <div className="grid gap-3">
              <div>
                <div className="text-xs text-[#7b8ca2]">最近心情</div>
                <div className="mt-1 text-xl font-semibold text-[#172033]">
                  {state.runtimeState.moodLabel}
                </div>
              </div>
              <ConfigRow label="精力" enabled={state.runtimeState.energyLevel >= 45} />
              <ConfigRow label="受控自动" enabled={state.runtimeState.autoUpdateEnabled} />
              <div className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm text-[#334155]">
                更新策略：{state.runtimeState.updateStrategy === "llm" ? "LLM 提议校验" : "规则校准"}
              </div>
              <div className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm leading-6 text-[#334155]">
                {state.runtimeState.currentActivity ?? "暂无正在做的事。"}
              </div>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel title="渠道状态" subtitle="公开状态，可无 token 读取">
          <div className="grid gap-3">
            <ChannelRow
              label="Telegram"
              active={state.channels?.telegram.enabled ?? false}
              detail={state.channels?.telegram.mode ?? "未启用"}
            />
            <ChannelRow
              label="Weixin"
              active={state.channels?.weixin.enabled ?? false}
              detail={state.channels?.weixin.mode ?? "未启用"}
            />
          </div>
        </Panel>

        <Panel title="功能开关" subtitle="来自数据库的实时运行配置">
          {state.runtime ? (
            <div className="grid gap-2">
              {Object.entries(state.runtime.features).map(([key, enabled]) => (
                <ConfigRow
                  key={key}
                  label={featureLabels[key] ?? formatKey(key)}
                  enabled={enabled}
                />
              ))}
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel title="安全边界" subtitle="高风险能力先保持保守">
          {state.runtime ? (
            <div className="grid gap-2">
              {Object.entries(state.runtime.safety).map(([key, enabled]) => (
                <ConfigRow
                  key={key}
                  label={safetyLabels[key] ?? formatKey(key)}
                  enabled={enabled}
                />
              ))}
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="模型提供商" subtitle="只显示是否配置，不显示密钥">
          {state.runtime ? (
            <div className="grid gap-3 md:grid-cols-2">
              {state.runtime.providers.map((provider) => (
                <div
                  key={provider.name}
                  className={`rounded-lg border px-4 py-3 ${
                    provider.active
                      ? "border-[#a9bfd7] bg-[#eaf2fb]"
                      : "border-[#d9e2ec] bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-[#172033]">{provider.label}</div>
                    <StatusPill
                      active={providerReady(provider)}
                      label={provider.active ? "当前" : providerReady(provider) ? "可用" : "缺配置"}
                    />
                  </div>
                  <div className="mt-2 truncate text-xs text-[#66758a]">
                    {provider.model ?? "未设置模型"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel title="后续接入顺序" subtitle="已经可用的入口继续保留，下一步补齐还缺的管理面">
          <div className="grid gap-3">
            {[
              "平台工具：接真实评论读取和互动记录",
              "工具日志：列表、筛选、详情",
              "渠道状态：查看连接和平台入口",
            ].map((item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eaf2fb] text-xs font-semibold text-[#5f7fa7]">
                  {index + 1}
                </span>
                <span className="text-sm text-[#334155]">{item}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#172033]">{title}</h3>
        <p className="mt-1 text-xs text-[#7b8ca2]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function StatusCard({ label, value, active }: { label: string; value: string; active: boolean }) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#7b8ca2]">{label}</div>
        <StatusPill active={active} />
      </div>
      <div className="mt-4 truncate text-xl font-semibold text-[#172033]">{value}</div>
    </div>
  );
}

function ChannelRow({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div>
        <div className="text-sm font-medium text-[#172033]">{label}</div>
        <div className="mt-1 text-xs text-[#7b8ca2]">{detail}</div>
      </div>
      <StatusPill active={active} />
    </div>
  );
}

function ConfigRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2.5">
      <span className="text-sm text-[#334155]">{label}</span>
      <StatusPill active={enabled} />
    </div>
  );
}

function TokenHint() {
  return (
    <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-white/70 px-4 py-5 text-sm leading-6 text-[#66758a]">
      填入 Admin Token 后，这里会显示安全的只读配置摘要。
    </div>
  );
}
