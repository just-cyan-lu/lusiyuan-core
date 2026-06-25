import { Button, Card, Icon, Title, Tooltip, type CardColor, type IconName } from "animal-island-ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
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
  const [reloadKey, setReloadKey] = useState(0);
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
  }, [adminToken, reloadKey]);

  const activeProvider = useMemo(
    () => state.runtime?.providers.find((provider) => provider.active) ?? null,
    [state.runtime]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="admin-dashboard-hero overflow-hidden p-6 md:p-8" pattern="app-teal">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-chip admin-chip-mint">
              <Icon name="icon-map" size={18} />
              Control Room
            </span>
            <span className="admin-chip admin-chip-pink">Web Chat 已并入 Admin</span>
            <span className="admin-chip admin-chip-yellow">长期状态先看证据</span>
          </div>

          <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="hidden sm:block">
                <Title size="large" color="app-yellow">
                  陆思源核心系统管理台
                </Title>
              </div>
              <h2 className="block text-2xl font-black leading-tight text-[var(--ls-ink-strong)] sm:hidden">
                陆思源核心系统管理台
              </h2>
              <p className="mt-5 text-sm font-semibold leading-7 text-[var(--ls-ink)] md:text-base">
                这里集中查看运行态、关系、记忆、Reflection、Dream、配置和聊天入口。长期测试时，先从这里看他最近发生了什么、状态为什么变化、哪些提案还需要审核。
              </p>
            </div>
            <Button
              type="primary"
              size="large"
              loading={state.loading}
              className="w-full justify-center sm:w-auto"
              icon={<Icon name="icon-variant" size={20} />}
              onClick={() => setReloadKey((value) => value + 1)}
            >
              刷新状态
            </Button>
          </div>

          {state.error && (
            <div className="mt-6 rounded-[22px] border-2 border-[var(--ls-pink)] bg-[var(--ls-pink-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-pink-text)]">
              {state.error}
            </div>
          )}
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <StatusCard
            label="Core API"
            value={state.health?.status ?? (state.loading ? "checking" : "unknown")}
            active={state.health?.status === "ok"}
            icon="icon-helicopter"
            color="app-teal"
          />
          <StatusCard
            label="Admin Token"
            value={adminToken ? "stored locally" : "required for config"}
            active={Boolean(adminToken)}
            icon="icon-diy"
            color="app-yellow"
          />
          <StatusCard
            label="Active Model"
            value={activeProvider?.model ?? state.runtime?.activeModelProvider ?? "token needed"}
            active={Boolean(activeProvider && providerReady(activeProvider))}
            icon="icon-miles"
            color="app-blue"
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="陆思源运行态"
          subtitle="数据库里的当前状态"
          icon="icon-miles"
          pattern="app-yellow"
        >
          {state.runtimeState ? (
            <div className="grid gap-3">
              <div className="admin-island-row px-4 py-3">
                <div className="text-xs font-black uppercase text-[var(--ls-ink-soft)]">最近心情</div>
                <div className="mt-1 text-2xl font-black text-[var(--ls-ink-strong)]">
                  {state.runtimeState.moodLabel}
                </div>
              </div>
              <ConfigRow label="精力" enabled={state.runtimeState.energyLevel >= 45} />
              <ConfigRow label="受控自动" enabled={state.runtimeState.autoUpdateEnabled} />
              <InfoBlock>
                更新策略：{state.runtimeState.updateStrategy === "llm" ? "LLM 提议校验" : "规则校准"}
              </InfoBlock>
              <InfoBlock>{state.runtimeState.currentActivity ?? "暂无正在做的事。"}</InfoBlock>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel title="渠道状态" subtitle="公开状态，可无 token 读取" icon="icon-chat" pattern="app-pink">
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

        <Panel title="功能开关" subtitle="来自数据库的实时运行配置" icon="icon-diy" pattern="app-teal">
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

        <Panel title="安全边界" subtitle="高风险能力先保持保守" icon="icon-variant" pattern="app-orange">
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
        <Panel title="模型提供商" subtitle="只显示是否配置，不显示密钥" icon="icon-helicopter" pattern="app-blue">
          {state.runtime ? (
            <div className="grid gap-3 md:grid-cols-2">
              {state.runtime.providers.map((provider) => (
                <div
                  key={provider.name}
                  className={`admin-island-row px-4 py-3 ${
                    provider.active ? "border-[var(--ls-mint-light)] bg-[var(--ls-mint-soft)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-[var(--ls-ink-strong)]">{provider.label}</div>
                    <StatusPill
                      active={providerReady(provider)}
                      label={provider.active ? "当前" : providerReady(provider) ? "可用" : "缺配置"}
                    />
                  </div>
                  <div className="mt-2 truncate text-xs font-semibold text-[var(--ls-ink-soft)]">
                    {provider.model ?? "未设置模型"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel
          title="后续接入顺序"
          subtitle="已经可用的入口继续保留，下一步补齐还缺的管理面"
          icon="icon-map"
          pattern="lime-green"
        >
          <div className="grid gap-3">
            {[
              "平台工具：接真实评论读取和互动记录",
              "工具日志：列表、筛选、详情",
              "渠道状态：查看连接和平台入口",
            ].map((item, index) => (
              <div key={item} className="admin-island-row flex items-center gap-3 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] border-2 border-[var(--ls-yellow)] bg-[var(--ls-yellow-soft)] text-xs font-black text-[var(--ls-ink-strong)]">
                  {index + 1}
                </span>
                <span className="text-sm font-bold leading-6 text-[var(--ls-ink)]">{item}</span>
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
  icon,
  pattern,
  children,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  pattern: CardColor;
  children: ReactNode;
}) {
  return (
    <Card className="h-full p-5" pattern={pattern}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-[var(--ls-ink-strong)]">{title}</h3>
          <p className="mt-1 text-xs font-semibold text-[var(--ls-ink-soft)]">{subtitle}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel)]">
          <Icon name={icon} size={24} />
        </span>
      </div>
      {children}
    </Card>
  );
}

function StatusCard({
  label,
  value,
  active,
  icon,
  color,
}: {
  label: string;
  value: string;
  active: boolean;
  icon: IconName;
  color: CardColor;
}) {
  return (
    <Card className="p-5" pattern={color}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-[var(--ls-ink-soft)]">
          <Icon name={icon} size={22} bounce={active} />
          {label}
        </div>
        <StatusPill active={active} />
      </div>
      <Tooltip title={value} variant="island" placement="bottom">
        <div className="mt-4 truncate text-xl font-black text-[var(--ls-ink-strong)]">
          {value}
        </div>
      </Tooltip>
    </Card>
  );
}

function ChannelRow({ label, active, detail }: { label: string; active: boolean; detail: string }) {
  return (
    <div className="admin-island-row flex items-center justify-between gap-3 px-4 py-3">
      <div>
        <div className="text-sm font-black text-[var(--ls-ink-strong)]">{label}</div>
        <div className="mt-1 text-xs font-semibold text-[var(--ls-ink-soft)]">{detail}</div>
      </div>
      <StatusPill active={active} />
    </div>
  );
}

function ConfigRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="admin-island-row flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-sm font-bold text-[var(--ls-ink)]">{label}</span>
      <StatusPill active={enabled} />
    </div>
  );
}

function InfoBlock({ children }: { children: ReactNode }) {
  return (
    <div className="admin-island-row px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-ink)]">
      {children}
    </div>
  );
}

function TokenHint() {
  return (
    <div className="admin-island-soft-panel px-4 py-5 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">
      填入 Admin Token 后，这里会显示安全的只读配置摘要。
    </div>
  );
}
