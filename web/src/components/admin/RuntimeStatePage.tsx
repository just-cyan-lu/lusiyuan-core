import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchRuntimeState,
  resetRuntimeState,
  runRuntimeAutonomyTick,
  updateRuntimeState,
  type RuntimeEvent,
  type RuntimeState,
  type RuntimeStateEvent,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface RuntimeStatePageProps {
  adminToken: string;
}

interface RuntimePageState {
  state: RuntimeState | null;
  events: RuntimeStateEvent[];
  runtimeEvents: RuntimeEvent[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  message: string | null;
}

interface RuntimeFormState {
  moodLabel: string;
  moodScore: number;
  energyLevel: number;
  stressLevel: number;
  socialBattery: number;
  currentGoal: string;
  currentFocus: string;
  currentActivity: string;
  recentEventSummary: string;
  statusNote: string;
  autoUpdateEnabled: boolean;
  updateMode: string;
  updateStrategy: string;
}

const updateModeLabels: Record<string, string> = {
  quiet: "安静",
  balanced: "平衡",
  active: "主动",
};

const updateStrategyLabels: Record<string, string> = {
  rules: "规则校准",
  llm: "LLM 提议校验",
};

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新运行态。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "运行态读取失败";
}

function formFromState(state: RuntimeState): RuntimeFormState {
  return {
    moodLabel: state.moodLabel,
    moodScore: state.moodScore,
    energyLevel: state.energyLevel,
    stressLevel: state.stressLevel,
    socialBattery: state.socialBattery,
    currentGoal: state.currentGoal ?? "",
    currentFocus: state.currentFocus ?? "",
    currentActivity: state.currentActivity ?? "",
    recentEventSummary: state.recentEventSummary ?? "",
    statusNote: state.statusNote ?? "",
    autoUpdateEnabled: state.autoUpdateEnabled,
    updateMode: state.updateMode,
    updateStrategy: state.updateStrategy || "rules",
  };
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function metadataText(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : "暂无";
}

function metadataList(metadata: Record<string, unknown>, key: string): string[] {
  const value = metadata[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function formatDate(value: string | null): string {
  if (!value) return "暂无";
  return new Date(value).toLocaleString();
}

function eventTypeLabel(type: string): string {
  if (type === "chat_observation") return "聊天观察";
  if (type === "chat_observation_rules") return "规则观察";
  if (type === "chat_observation_llm") return "LLM 观察";
  if (type === "chat_observation_failed") return "观察失败";
  if (type === "owner_chat_state_rules") return "Owner 对话校准";
  if (type === "owner_chat_state_llm") return "Owner LLM 校准";
  if (type === "owner_chat_state_failed") return "Owner 校准失败";
  if (type === "reflection_state_update") return "复盘更新";
  if (type === "dream_state_update") return "梦境更新";
  if (type === "autonomy_state_update") return "自启动更新";
  if (type === "manual_update") return "手动调整";
  if (type === "reset") return "重置";
  return type;
}

function runtimeEventTypeLabel(type: string): string {
  if (type === "chat_turn") return "聊天事件";
  if (type === "reflection_report") return "复盘事件";
  if (type === "dream_cycle") return "梦境事件";
  if (type === "autonomy_tick") return "自启动检查";
  return type;
}

function moodTone(score: number): string {
  if (score >= 45) return "明亮";
  if (score >= 10) return "平稳";
  if (score >= -25) return "低一点";
  return "需要照看";
}

export function RuntimeStatePage({ adminToken }: RuntimeStatePageProps) {
  const [pageState, setPageState] = useState<RuntimePageState>({
    state: null,
    events: [],
    runtimeEvents: [],
    loading: false,
    saving: false,
    error: null,
    message: null,
  });
  const [form, setForm] = useState<RuntimeFormState | null>(null);

  async function loadState() {
    if (!adminToken) {
      setPageState({
        state: null,
        events: [],
        runtimeEvents: [],
        loading: false,
        saving: false,
        error: null,
        message: null,
      });
      setForm(null);
      return;
    }

    setPageState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchRuntimeState(adminToken);
      setPageState((current) => ({
        ...current,
        state: data.state,
        events: data.events,
        runtimeEvents: data.runtimeEvents ?? [],
        loading: false,
        error: null,
      }));
      setForm(formFromState(data.state));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        loading: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!adminToken) {
        setPageState({
          state: null,
          events: [],
          runtimeEvents: [],
          loading: false,
          saving: false,
          error: null,
          message: null,
        });
        setForm(null);
        return;
      }

      setPageState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await fetchRuntimeState(adminToken);
        if (!cancelled) {
          setPageState((current) => ({
            ...current,
            state: data.state,
            events: data.events,
            runtimeEvents: data.runtimeEvents ?? [],
            loading: false,
            error: null,
          }));
          setForm(formFromState(data.state));
        }
      } catch (error) {
        if (!cancelled) {
          setPageState((current) => ({
            ...current,
            loading: false,
            error: friendlyErrorMessage(error),
          }));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [adminToken]);

  const dirty = useMemo(() => {
    if (!pageState.state || !form) return false;
    return JSON.stringify(formFromState(pageState.state)) !== JSON.stringify(form);
  }, [pageState.state, form]);

  async function saveState() {
    if (!adminToken || !form) return;
    setPageState((current) => ({
      ...current,
      saving: true,
      error: null,
      message: null,
    }));
    try {
      const data = await updateRuntimeState({
        token: adminToken,
        ...form,
        summary: "Admin 页面手动调整运行态。",
      });
      setPageState((current) => ({
        ...current,
        state: data.state,
        events: data.events,
        runtimeEvents: data.runtimeEvents ?? [],
        saving: false,
        message: "运行态已保存。",
      }));
      setForm(formFromState(data.state));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function resetState() {
    if (!adminToken) return;
    if (!window.confirm("确定要把运行态重置为默认状态吗？")) return;
    setPageState((current) => ({
      ...current,
      saving: true,
      error: null,
      message: null,
    }));
    try {
      const data = await resetRuntimeState(adminToken);
      setPageState((current) => ({
        ...current,
        state: data.state,
        events: data.events,
        runtimeEvents: data.runtimeEvents ?? [],
        saving: false,
        message: "运行态已重置。",
      }));
      setForm(formFromState(data.state));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function runAutonomyCheck() {
    if (!adminToken) return;
    setPageState((current) => ({
      ...current,
      saving: true,
      error: null,
      message: null,
    }));
    try {
      const data = await runRuntimeAutonomyTick(adminToken);
      setPageState((current) => ({
        ...current,
        state: data.state,
        events: data.events,
        runtimeEvents: data.runtimeEvents ?? [],
        saving: false,
        message: "自启动检查已完成。",
      }));
      setForm(formFromState(data.state));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Runtime State</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">陆思源运行态</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。运行态会保存陆思源最近的心情、精力、关注点和正在做的事。
        </p>
      </section>
    );
  }

  const runtime = pageState.state;
  const runtimeMetadata = metadataRecord(runtime?.metadata);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Runtime State</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">陆思源运行态</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              数据库里的当前状态。普通聊天只记录事件；长期状态由 owner 对话、复盘、梦境、自启动和手动校准更新。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadState()}
              className="rounded-lg border border-[#c9d6e5] bg-white px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-[#f8fbff]"
            >
              刷新
            </button>
            <button
              type="button"
              disabled={!dirty || pageState.saving}
              onClick={() => void saveState()}
              className="rounded-lg bg-[#6f8fb8] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#5f7fa7] disabled:cursor-not-allowed disabled:bg-[#b9c7d8]"
            >
              {pageState.saving ? "保存中" : "保存"}
            </button>
            <button
              type="button"
              disabled={pageState.saving}
              onClick={() => void runAutonomyCheck()}
              className="rounded-lg border border-[#c9d6e5] bg-[#f8fbff] px-4 py-2 text-sm font-medium text-[#334155] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              自启动检查
            </button>
            <button
              type="button"
              onClick={() => void resetState()}
              className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-2 text-sm font-medium text-[#8d6048] transition hover:bg-[#fff0e8]"
            >
              重置
            </button>
          </div>
        </div>

        {pageState.error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {pageState.error}
          </div>
        )}
        {pageState.message && (
          <div className="mt-5 rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm text-[#3f7b5d]">
            {pageState.message}
          </div>
        )}
      </section>

      {runtime && form ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-sm text-[#7b8ca2]">最近心情</div>
                  <div className="mt-2 text-3xl font-semibold text-[#172033]">
                    {runtime.moodLabel}
                  </div>
                  <div className="mt-2 text-sm text-[#617188]">
                    {moodTone(runtime.moodScore)} · 更新于 {formatDate(runtime.updatedAt)}
                  </div>
                </div>
                <StatusPill
                  active={runtime.autoUpdateEnabled}
                  label={runtime.autoUpdateEnabled ? "受控自动" : "手动模式"}
                />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <MetricBar label="心情指数" value={runtime.moodScore} min={-100} max={100} />
                <MetricBar label="精力" value={runtime.energyLevel} min={0} max={100} />
                <MetricBar label="压力" value={runtime.stressLevel} min={0} max={100} dangerHigh />
                <MetricBar label="社交电量" value={runtime.socialBattery} min={0} max={100} />
              </div>
            </div>

            <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-5">
              <h3 className="text-base font-semibold text-[#172033]">当前在做的事</h3>
              <InfoBlock label="当前目标" value={runtime.currentGoal} />
              <InfoBlock label="最近关注" value={runtime.currentFocus} />
              <InfoBlock label="正在做" value={runtime.currentActivity} />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
              <h3 className="text-base font-semibold text-[#172033]">详情信息</h3>
              <div className="mt-4 grid gap-3">
                <DetailRow label="State ID" value={runtime.id} />
                <DetailRow label="Key" value={runtime.key} />
                <DetailRow label="创建时间" value={formatDate(runtime.createdAt)} />
                <DetailRow label="更新时间" value={formatDate(runtime.updatedAt)} />
                <DetailRow
                  label="更新模式"
                  value={updateModeLabels[runtime.updateMode] ?? runtime.updateMode}
                />
                <DetailRow
                  label="更新策略"
                  value={updateStrategyLabels[runtime.updateStrategy] ?? runtime.updateStrategy}
                />
              </div>

              <div className="mt-5 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
                <div className="text-xs font-semibold text-[#7b8ca2]">最近事件</div>
                <p className="mt-2 text-sm leading-7 text-[#334155]">
                  {runtime.recentEventSummary || "暂无新的运行事件。"}
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
                <div className="text-xs font-semibold text-[#7b8ca2]">状态备注</div>
                <p className="mt-2 text-sm leading-7 text-[#334155]">
                  {runtime.statusNote || "暂无备注。"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
              <h3 className="text-base font-semibold text-[#172033]">内在详情</h3>
              <p className="mt-1 text-xs leading-6 text-[#7b8ca2]">
                LLM 提议校验、复盘和梦境会填充这些细节；普通聊天只留下事件材料。
              </p>
              <div className="mt-4 grid gap-3">
                <InfoBlock label="内在天气" value={metadataText(runtimeMetadata, "innerWeather")} />
                <InfoList label="情绪色调" items={metadataList(runtimeMetadata, "emotionalTones")} />
                <InfoList label="当前需要" items={metadataList(runtimeMetadata, "needs")} />
                <InfoList label="内部张力" items={metadataList(runtimeMetadata, "tensions")} />
                <InfoList label="还在想的问题" items={metadataList(runtimeMetadata, "openQuestions")} />
                <InfoBlock label="关系信号" value={metadataText(runtimeMetadata, "relationshipSignal")} />
                <InfoList label="话题信号" items={metadataList(runtimeMetadata, "topicSignals")} />
              </div>
            </div>

            <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 xl:col-span-2">
              <h3 className="text-base font-semibold text-[#172033]">配置与控制</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label="心情">
                  <input
                    className="field-input"
                    value={form.moodLabel}
                    onChange={(event) =>
                      setForm({ ...form, moodLabel: event.target.value })
                    }
                  />
                </Field>
                <Field label="更新模式">
                  <select
                    className="field-input"
                    value={form.updateMode}
                    onChange={(event) =>
                      setForm({ ...form, updateMode: event.target.value })
                    }
                  >
                    <option value="quiet">安静</option>
                    <option value="balanced">平衡</option>
                    <option value="active">主动</option>
                  </select>
                </Field>
                <Field label="更新策略">
                  <select
                    className="field-input"
                    value={form.updateStrategy}
                    onChange={(event) =>
                      setForm({ ...form, updateStrategy: event.target.value })
                    }
                  >
                    <option value="rules">规则校准</option>
                    <option value="llm">LLM 提议校验</option>
                  </select>
                </Field>
              </div>

              <div className="mt-4 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-xs leading-6 text-[#617188]">
                规则校准更稳定省资源；LLM 提议校验只在允许改长期状态的入口运行，比如 owner 对话、复盘、梦境或自启动。普通聊天不会直接改这里。
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SliderField
                  label="心情指数"
                  value={form.moodScore}
                  min={-100}
                  max={100}
                  onChange={(value) => setForm({ ...form, moodScore: value })}
                />
                <SliderField
                  label="精力"
                  value={form.energyLevel}
                  min={0}
                  max={100}
                  onChange={(value) => setForm({ ...form, energyLevel: value })}
                />
                <SliderField
                  label="压力"
                  value={form.stressLevel}
                  min={0}
                  max={100}
                  onChange={(value) => setForm({ ...form, stressLevel: value })}
                />
                <SliderField
                  label="社交电量"
                  value={form.socialBattery}
                  min={0}
                  max={100}
                  onChange={(value) => setForm({ ...form, socialBattery: value })}
                />
              </div>

              <label className="mt-4 flex items-center gap-3 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm text-[#334155]">
                <input
                  type="checkbox"
                  checked={form.autoUpdateEnabled}
                  onChange={(event) =>
                    setForm({ ...form, autoUpdateEnabled: event.target.checked })
                  }
                />
                允许受控入口自动校准长期状态
              </label>

              <div className="mt-4 grid gap-4">
                <TextAreaField
                  label="当前目标"
                  value={form.currentGoal}
                  onChange={(value) => setForm({ ...form, currentGoal: value })}
                />
                <TextAreaField
                  label="最近关注"
                  value={form.currentFocus}
                  onChange={(value) => setForm({ ...form, currentFocus: value })}
                />
                <TextAreaField
                  label="正在做的事"
                  value={form.currentActivity}
                  onChange={(value) => setForm({ ...form, currentActivity: value })}
                />
                <TextAreaField
                  label="最近事件"
                  value={form.recentEventSummary}
                  onChange={(value) =>
                    setForm({ ...form, recentEventSummary: value })
                  }
                />
                <TextAreaField
                  label="状态备注"
                  value={form.statusNote}
                  onChange={(value) => setForm({ ...form, statusNote: value })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[#172033]">运行事件</h3>
                <p className="mt-1 text-xs text-[#7b8ca2]">最近 12 条经历和观察，普通聊天会记录在这里</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {pageState.runtimeEvents.length > 0 ? (
                pageState.runtimeEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-3 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 md:grid-cols-[9rem_1fr_7rem_11rem]"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#172033]">
                        {runtimeEventTypeLabel(event.eventType)}
                      </div>
                      <div className="mt-1 text-xs text-[#7b8ca2]">
                        {event.source ?? "unknown"}
                      </div>
                    </div>
                    <div className="text-sm leading-6 text-[#334155]">{event.summary}</div>
                    <div className="text-xs leading-6 text-[#7b8ca2]">
                      <div>{event.topic ?? "暂无主题"}</div>
                      <div>重要度 {event.importance}</div>
                    </div>
                    <div className="text-xs text-[#7b8ca2] md:text-right">
                      {formatDate(event.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                  暂无运行事件。
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[#172033]">状态变更</h3>
                <p className="mt-1 text-xs text-[#7b8ca2]">最近 12 条真正写入 RuntimeState 的变化</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              {pageState.events.length > 0 ? (
                pageState.events.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-3 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 md:grid-cols-[9rem_1fr_11rem]"
                  >
                    <div>
                      <div className="text-sm font-semibold text-[#172033]">
                        {eventTypeLabel(event.eventType)}
                      </div>
                      <div className="mt-1 text-xs text-[#7b8ca2]">
                        {event.source ?? "unknown"}
                      </div>
                    </div>
                    <div className="text-sm leading-6 text-[#334155]">{event.summary}</div>
                    <div className="text-xs text-[#7b8ca2] md:text-right">
                      {formatDate(event.createdAt)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                  暂无状态变更。
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-[#d9e2ec] bg-white px-5 py-8 text-sm text-[#7b8ca2]">
          {pageState.loading ? "正在读取运行态..." : "暂无运行态数据。"}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
      {children}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
      <textarea
        className="field-input min-h-20 resize-y leading-6"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[#7b8ca2]">
        <span>{label}</span>
        <span className="text-[#172033]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[#6f8fb8]"
      />
    </label>
  );
}

function MetricBar({
  label,
  value,
  min,
  max,
  dangerHigh = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  dangerHigh?: boolean;
}) {
  const percent = ((value - min) / (max - min)) * 100;
  const clampedPercent = Math.min(Math.max(percent, 0), 100);
  const strong = dangerHigh ? value < 55 : value >= 45;
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
        <div className="text-sm font-semibold text-[#172033]">{value}</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[#e4ebf3]">
        <div
          className={`h-2 rounded-full ${strong ? "bg-[#6aa47e]" : "bg-[#c48a6a]"}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mt-4 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
      <div className="mt-2 text-sm leading-6 text-[#334155]">{value || "暂无"}</div>
    </div>
  );
}

function InfoList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
      {items.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#334155]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-2 text-sm text-[#7b8ca2]">暂无</div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 md:grid-cols-[7rem_1fr]">
      <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
      <div className="break-all text-sm text-[#334155]">{value}</div>
    </div>
  );
}
