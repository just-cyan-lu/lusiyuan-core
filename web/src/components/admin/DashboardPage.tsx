import { Button, Card, Icon, Title, Tooltip, type CardColor, type IconName } from "animal-island-ui";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchChannelStatus,
  fetchHealthStatus,
  fetchRelationships,
  fetchRuntimeConfig,
  fetchRuntimeState,
  type ChannelStatus,
  type HealthStatus,
  type RelationshipListResponse,
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
  relationships: RelationshipListResponse | null;
  error: string | null;
  loading: boolean;
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

function islandSlogan(state: DashboardState): string {
  if (state.error) return "今天跟岛的连接有点问题，看看下面的提示。";
  if (!state.runtimeState) return "等主人填入 Admin Token，岛就开始讲今天的故事。";
  const mood = state.runtimeState.moodLabel;
  const energy = state.runtimeState.energyLevel;
  if (energy < 30) return `今天岛上有些疲倦（${mood}），先去 '运行态' 看看要不要加点能量。`;
  if (energy >= 70) return `今天岛上精神很好（${mood}），可以多去看看大家。`;
  return `今天岛上一切平静（${mood}），先去 '运行态' 看具体。`;
}

function weatherFromState(state: RuntimeState): { label: string; emoji: string; tone: "warm" | "cool" | "neutral" } {
  if (state.energyLevel >= 70) return { label: "阳光明媚", emoji: "☀️", tone: "warm" };
  if (state.energyLevel < 30) return { label: "薄雾", emoji: "🌫️", tone: "cool" };
  return { label: "晴间多云", emoji: "⛅", tone: "neutral" };
}

const dailyQuotes: Record<string, string[]> = {
  warm: [
    "今天岛上阳光很好——可以多做点事。",
    "心情在线，适合和远方的朋友多说几句。",
    "精神头挺足，去 '运行态' 看看大家的状态吧。",
  ],
  cool: [
    "今天风浪有点大，先让自己安静一下。",
    "累了就歇歇，岛上不缺这一阵风。",
    "海面不太平——记住要写日记，否则记忆会潮汐。",
  ],
  neutral: [
    "今天岛上一切平静，先听一会儿风。",
    "日子不紧不慢，记忆沙滩等新的足迹。",
    "不急——把今天的小事记下来就好。",
  ],
};

function pickDailyQuote(seedKey: string, tone: "warm" | "cool" | "neutral"): string {
  const pool = dailyQuotes[tone];
  let hash = 0;
  for (let i = 0; i < seedKey.length; i += 1) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}

export function DashboardPage({ adminToken }: DashboardPageProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<DashboardState>({
    health: null,
    channels: null,
    runtime: null,
    runtimeState: null,
    relationships: null,
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
        if (adminToken) {
          const [runtime, runtimeStateResponse, relationships] = await Promise.all([
            fetchRuntimeConfig(adminToken),
            fetchRuntimeState(adminToken),
            fetchRelationships({ token: adminToken, limit: 5 }).catch(() => null),
          ]);
          if (!cancelled) {
            setState({
              health,
              channels,
              runtime,
              runtimeState: runtimeStateResponse?.state ?? null,
              relationships,
              error: null,
              loading: false,
            });
          }
        } else if (!cancelled) {
          setState({
            health,
            channels,
            runtime: null,
            runtimeState: null,
            relationships: null,
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

  const chatProvider = useMemo(
    () => state.runtime
      ? state.runtime.providers.find((provider) => provider.name === state.runtime!.modelRoutes.chat) ?? null
      : null,
    [state.runtime]
  );

  const enabledFeatureCount = state.runtime
    ? Object.values(state.runtime.features).filter(Boolean).length
    : 0;
  const totalFeatureCount = state.runtime
    ? Object.keys(state.runtime.features).length
    : 0;
  const configuredProviderCount = state.runtime
    ? state.runtime.providers.filter(providerReady).length
    : 0;
  const totalProviderCount = state.runtime?.providers.length ?? 0;

  const weather = state.runtimeState
    ? weatherFromState(state.runtimeState)
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="admin-dashboard-hero overflow-hidden p-6 md:p-8" pattern="app-teal">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-chip admin-chip-mint">
              <Icon name="icon-map" size={18} />
              The Isle
            </span>
            <span className="admin-chip admin-chip-pink">岛上有 Web Chat 入口</span>
            <span className="admin-chip admin-chip-yellow">长期状态先看证据</span>
          </div>

          <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="hidden sm:block">
                <Title size="large" color="app-yellow">
                  陆思源的岛
                </Title>
              </div>
              <h2 className="block text-2xl font-black leading-tight text-[var(--ls-ink-strong)] sm:hidden">
                陆思源的岛
              </h2>
              <p className="mt-5 text-base font-semibold leading-7 text-[var(--ls-ink)] md:text-lg">
                {islandSlogan(state)}
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
              刷新一下
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
            label="Chat Model"
            value={chatProvider?.model ?? state.runtime?.modelRoutes.chat ?? "token needed"}
            active={Boolean(chatProvider && providerReady(chatProvider))}
            icon="icon-miles"
            color="app-blue"
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr_1fr]">
        <Panel
          title="岛中央"
          subtitle="陆思源本人 / 数据库里的当前状态"
          icon="icon-miles"
          pattern="app-yellow"
          span={2}
        >
          {state.runtimeState ? (
            <div className="grid gap-3">
              <div
                key={`${state.runtimeState.id}-${reloadKey}`}
                className="admin-island-daily-quote rounded-2xl border-2 border-[var(--ls-yellow)] bg-[var(--ls-yellow-soft)] px-4 py-3 text-sm font-bold leading-6 text-[var(--ls-yellow-text)]"
              >
                <span className="mr-1.5 text-base" aria-hidden="true">✦</span>
                今日一句：{pickDailyQuote(
                  `${state.runtimeState.id}-${state.runtimeState.updatedAt}`,
                  weather?.tone ?? "neutral",
                )}
              </div>
              <div className="admin-island-row px-4 py-3">
                <div className="text-xs font-black uppercase text-[var(--ls-ink-soft)]">最近心情</div>
                <div className="mt-1 text-2xl font-black text-[var(--ls-ink-strong)]">
                  {state.runtimeState.moodLabel}
                </div>
              </div>
              <ConfigRow label="心力" enabled={state.runtimeState.energyLevel >= 45} />
              <ConfigRow
                label="自动校准"
                enabled={Boolean(state.runtime?.features.runtimeStateAutoUpdate)}
              />
              <InfoBlock>{state.runtimeState.recentEventSummary ?? "暂无新的状态变更。"}</InfoBlock>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel
          title="天气"
          subtitle="岛的当下气氛"
          icon="icon-variant"
          pattern="app-orange"
        >
          {state.runtimeState && weather ? (
            <div className="grid gap-3">
              <div className="admin-island-weather relative overflow-hidden px-4 py-4">
                <svg
                  className="admin-island-weather-sky pointer-events-none absolute inset-0 h-full w-full"
                  viewBox="0 0 200 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {weather.tone === "warm" && (
                    <>
                      <circle className="admin-island-weather-sun" cx="40" cy="32" r="22" fill="#f7cd67" opacity="0.65" />
                      <circle className="admin-island-weather-sun" cx="40" cy="32" r="14" fill="#ffe28a" opacity="0.9" />
                    </>
                  )}
                  {weather.tone === "cool" && (
                    <>
                      <path
                        className="admin-island-weather-wave"
                        d="M10,40 Q40,15 70,40 T140,40 T200,40"
                        stroke="#8aa9d6"
                        strokeWidth="2"
                        fill="none"
                        opacity="0.55"
                      />
                      <path
                        className="admin-island-weather-wave"
                        d="M10,60 Q40,38 70,60 T140,60 T200,60"
                        stroke="#8aa9d6"
                        strokeWidth="1.5"
                        fill="none"
                        opacity="0.4"
                      />
                    </>
                  )}
                  {weather.tone === "neutral" && (
                    <>
                      <ellipse className="admin-island-weather-cloud" cx="50" cy="40" rx="28" ry="10" fill="#d6dee8" opacity="0.7" />
                      <ellipse className="admin-island-weather-cloud" cx="80" cy="32" rx="22" ry="8" fill="#e6ecf3" opacity="0.85" />
                    </>
                  )}
                </svg>
                <div className="relative flex items-center gap-3">
                  <span className="text-3xl leading-none" aria-hidden="true">
                    {weather.emoji}
                  </span>
                  <div>
                    <div className="text-base font-black text-[var(--ls-ink-strong)]">
                      {weather.label}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-[var(--ls-ink-soft)]">
                      心力 {state.runtimeState.energyLevel}
                    </div>
                  </div>
                </div>
              </div>
              <InfoBlock>{state.runtimeState.statusNote ?? "岛上安静，听听风。"}</InfoBlock>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Panel
          title="码头"
          subtitle="对外通道 / 可无 token 读取"
          icon="icon-chat"
          pattern="app-pink"
        >
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

        <Panel
          title="岛上设施"
          subtitle="正在运转的能力"
          icon="icon-diy"
          pattern="app-teal"
        >
          {state.runtime ? (
            <div className="grid gap-2">
              <div className="admin-island-row flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="text-sm font-bold text-[var(--ls-ink)]">功能开关</span>
                <StatusPill
                  active={enabledFeatureCount === totalFeatureCount}
                  label={`${enabledFeatureCount} / ${totalFeatureCount} 已开`}
                />
              </div>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>
      </section>

      <section>
        <Panel
          title="海"
          subtitle="关系海洋 + 记忆沙滩"
          icon="icon-map"
          pattern="app-blue"
        >
          {state.relationships ? (
            <div className="grid gap-3">
              <div className="admin-island-row px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase text-[var(--ls-ink-soft)]">
                    关系海洋
                  </div>
                  <span className="text-[10px] font-bold text-[var(--ls-ink-faint)]">
                    共 {state.relationships.relationships.length} 个访客
                  </span>
                </div>
                {state.relationships.relationships.length === 0 ? (
                  <div className="mt-3 text-sm font-semibold text-[var(--ls-ink-muted)]">
                    海里还没有人，去 '关系' 看看。
                  </div>
                ) : (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {state.relationships.relationships.map((rel) => (
                      <li key={rel.id}>
                        <span
                          className="admin-island-sea-chip"
                          style={{
                            background:
                              rel.affinity < 35
                                ? "var(--ls-pink-soft)"
                                : rel.affinity >= 70
                                  ? "var(--ls-mint-soft)"
                                  : "var(--ls-panel-soft)",
                            color:
                              rel.affinity < 35
                                ? "var(--ls-pink-text)"
                                : rel.affinity >= 70
                                  ? "var(--ls-mint-text)"
                                  : "var(--ls-ink)",
                            borderColor:
                              rel.affinity < 35
                                ? "var(--ls-pink)"
                                : rel.affinity >= 70
                                  ? "var(--ls-mint-light)"
                                  : "var(--ls-border)",
                          }}
                        >
                          <span className="font-black">
                            {rel.relationshipLabel}
                          </span>
                          <span className="ml-2 text-[10px] font-bold opacity-70">
                            {rel.person?.label ?? rel.personId.slice(0, 6)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="admin-island-row flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-xs font-black uppercase text-[var(--ls-ink-soft)]">
                    记忆沙滩
                  </div>
                  <div className="mt-1 text-sm font-bold text-[var(--ls-ink)]">
                    已整理 {state.relationships.relationships.length} 份关系档案
                  </div>
                </div>
                <span className="admin-island-sea-footprint" aria-hidden="true">
                  🌊
                </span>
              </div>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <Panel
          title="罗盘"
          subtitle="模型提供商 / 只显示是否配置，不显示密钥"
          icon="icon-helicopter"
          pattern="app-blue"
        >
          {state.runtime ? (
            <div className="grid gap-3">
              <div className="admin-island-row flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="text-xs font-black uppercase text-[var(--ls-ink-soft)]">
                    聊天模型
                  </div>
                  <div className="mt-1 text-base font-black text-[var(--ls-ink-strong)]">
                    {chatProvider?.label ?? "未选定"}
                  </div>
                </div>
                <StatusPill
                  active={Boolean(chatProvider && providerReady(chatProvider))}
                  label={chatProvider?.model ?? "—"}
                />
              </div>
              <InfoBlock>
                已配置 {configuredProviderCount} / 共 {totalProviderCount} 个模型渠道，剩下要看完整列表请去 '运行配置'。
              </InfoBlock>
            </div>
          ) : (
            <TokenHint />
          )}
        </Panel>

        <Panel
          title="岛日志"
          subtitle="今天岛上发生了什么"
          icon="icon-map"
          pattern="lime-green"
        >
          <div className="admin-island-soft-panel px-4 py-5 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">
            这里将记录今天岛上发生的事。先把岛修好，故事以后会自己长出来。
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
  span,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  pattern: CardColor;
  children: ReactNode;
  span?: number;
}) {
  return (
    <Card
      className={`h-full p-5 ${span === 2 ? "lg:col-span-2" : ""}`.trim()}
      pattern={pattern}
    >
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
