import { useEffect, useMemo, useState } from "react";
import { Button } from "animal-island-ui";
import {
  createAutonomousTask,
  fetchRuntimeStateEventSources,
  fetchRuntimeState,
  resetRuntimeState,
  runAutonomousTask,
  runRuntimeAutonomyTick,
  updateAutonomousTask,
  updateRuntimeState,
  type AutonomousTask,
  type RuntimeState,
  type RuntimeStateEvent,
  type RuntimeStateEventSourcesResponse,
  type RuntimeStateResponse,
} from "../../api/lusiyuan-api";
import { StateChangeDetail } from "./StateChangeDetail";
import { RuntimeStateSourceMaterials } from "./RuntimeStateSourceMaterials";

interface RuntimeStatePageProps {
  adminToken: string;
}

interface RuntimePageState {
  state: RuntimeState | null;
  events: RuntimeStateEvent[];
  autonomousTasks: AutonomousTask[];
  sourceDetail: RuntimeStateEventSourcesResponse | null;
  sourceLoading: boolean;
  sourceError: string | null;
  loading: boolean;
  saving: boolean;
  taskBusy: boolean;
  runningTaskId: string | null;
  error: string | null;
  message: string | null;
}

interface RuntimeFormState {
  energyLevel: number;
  recentEventSummary: string;
  statusNote: string;
}

interface TaskFormState {
  title: string;
  description: string;
  type: string;
  priority: number;
}

const taskTypeOptions = [
  { value: "reading", label: "读书/资料" },
  { value: "game_research", label: "游戏研究" },
  { value: "content_creation", label: "内容创作" },
  { value: "self_growth", label: "自我整理" },
  { value: "open_research", label: "开放研究" },
  { value: "custom", label: "自定义" },
];

const taskStatusLabels: Record<string, string> = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  abandoned: "已放弃",
};

const runtimeFieldLabels: Record<string, string> = {
  moodLabel: "状态标签",
  energyLevel: "心力",
  recentEventSummary: "最近事件",
  statusNote: "状态备注",
  metadata: "内在详情",
  lastDream: "最近梦境",
  lastAutonomyTick: "最近自主检查",
  signalCount: "信号数",
  proposalCount: "提案数",
  riskCount: "风险数",
  stateImpact: "状态影响",
  reason: "原因",
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
    energyLevel: state.energyLevel,
    recentEventSummary: state.recentEventSummary ?? "",
    statusNote: state.statusNote ?? "",
  };
}

function emptyPageState(): RuntimePageState {
  return {
    state: null,
    events: [],
    autonomousTasks: [],
    sourceDetail: null,
    sourceLoading: false,
    sourceError: null,
    loading: false,
    saving: false,
    taskBusy: false,
    runningTaskId: null,
    error: null,
    message: null,
  };
}

function emptyTaskForm(): TaskFormState {
  return {
    title: "",
    description: "",
    type: "custom",
    priority: 50,
  };
}

function metadataRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function metadataValue(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return "暂无";
}

function formatDate(value: string | null): string {
  if (!value) return "暂无";
  return new Date(value).toLocaleString();
}

function eventTypeLabel(type: string): string {
  if (type === "dream_state_update") return "梦境更新";
  if (type === "autonomy_state_update") return "自主检查更新";
  if (type === "manual_update") return "手动调整";
  if (type === "reset") return "重置";
  return type;
}

function taskTypeLabel(type: string): string {
  return taskTypeOptions.find((item) => item.value === type)?.label ?? type;
}

export function RuntimeStatePage({ adminToken }: RuntimeStatePageProps) {
  const [pageState, setPageState] = useState<RuntimePageState>(() => emptyPageState());
  const [form, setForm] = useState<RuntimeFormState | null>(null);
  const [taskForm, setTaskForm] = useState<TaskFormState>(() => emptyTaskForm());
  const [selectedStateEventId, setSelectedStateEventId] = useState<string | null>(null);

  function applyRuntimeResponse(data: RuntimeStateResponse, message?: string) {
    setPageState((current) => ({
      ...current,
      state: data.state,
      events: data.events,
      autonomousTasks: data.autonomousTasks ?? current.autonomousTasks,
      loading: false,
      saving: false,
      taskBusy: false,
      runningTaskId: null,
      error: null,
      message: message ?? null,
    }));
    setForm(formFromState(data.state));
  }

  async function loadState() {
    if (!adminToken) {
      setPageState(emptyPageState());
      setForm(null);
      return;
    }

    setPageState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await fetchRuntimeState(adminToken);
      applyRuntimeResponse(data);
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
        setPageState(emptyPageState());
        setForm(null);
        return;
      }

      setPageState((current) => ({ ...current, loading: true, error: null }));
      try {
        const data = await fetchRuntimeState(adminToken);
        if (!cancelled) applyRuntimeResponse(data);
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

  useEffect(() => {
    setSelectedStateEventId((current) =>
      pageState.events.find((event) => event.id === current)?.id ?? pageState.events[0]?.id ?? null
    );
  }, [pageState.events]);

  useEffect(() => {
    if (!adminToken || !selectedStateEventId) {
      setPageState((current) => ({
        ...current,
        sourceDetail: null,
        sourceLoading: false,
        sourceError: null,
      }));
      return;
    }

    let cancelled = false;
    setPageState((current) => ({
      ...current,
      sourceDetail: null,
      sourceLoading: true,
      sourceError: null,
    }));

    fetchRuntimeStateEventSources(adminToken, selectedStateEventId)
      .then((detail) => {
        if (cancelled) return;
        setPageState((current) => ({
          ...current,
          sourceDetail: detail,
          sourceLoading: false,
          sourceError: null,
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        setPageState((current) => ({
          ...current,
          sourceDetail: null,
          sourceLoading: false,
          sourceError: friendlyErrorMessage(error),
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [adminToken, selectedStateEventId]);

  const dirty = useMemo(() => {
    if (!pageState.state || !form) return false;
    return JSON.stringify(formFromState(pageState.state)) !== JSON.stringify(form);
  }, [pageState.state, form]);

  const selectedStateEvent = useMemo(
    () =>
      pageState.events.find((event) => event.id === selectedStateEventId) ??
      pageState.events[0] ??
      null,
    [pageState.events, selectedStateEventId]
  );

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
        summary: "Admin 页面手动调整心力运行态。",
      });
      applyRuntimeResponse(data, "运行态已保存。");
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
      applyRuntimeResponse(data, "运行态已重置。");
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
      const suffix = data.idleTaskRun?.summary ? ` ${data.idleTaskRun.summary}` : "";
      applyRuntimeResponse(data, `自主检查已完成。${suffix}`);
    } catch (error) {
      setPageState((current) => ({
        ...current,
        saving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function createTask() {
    if (!adminToken) return;
    if (!taskForm.title.trim() || !taskForm.description.trim()) {
      setPageState((current) => ({ ...current, error: "任务标题和描述都要填写。" }));
      return;
    }
    setPageState((current) => ({ ...current, taskBusy: true, error: null, message: null }));
    try {
      await createAutonomousTask({
        token: adminToken,
        title: taskForm.title,
        description: taskForm.description,
        type: taskForm.type,
        priority: taskForm.priority,
      });
      setTaskForm(emptyTaskForm());
      await loadState();
      setPageState((current) => ({ ...current, taskBusy: false, message: "自主任务已创建。" }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        taskBusy: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function changeTaskStatus(task: AutonomousTask, status: string) {
    if (!adminToken) return;
    setPageState((current) => ({ ...current, taskBusy: true, error: null, message: null }));
    try {
      await updateAutonomousTask({ token: adminToken, taskId: task.id, status });
      await loadState();
      setPageState((current) => ({
        ...current,
        taskBusy: false,
        message: `任务已更新为${taskStatusLabels[status] ?? status}。`,
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        taskBusy: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function runTask(task: AutonomousTask) {
    if (!adminToken) return;
    setPageState((current) => ({
      ...current,
      taskBusy: true,
      runningTaskId: task.id,
      error: null,
      message: null,
    }));
    try {
      const result = await runAutonomousTask({ token: adminToken, taskId: task.id });
      await loadState();
      setPageState((current) => ({
        ...current,
        taskBusy: false,
        runningTaskId: null,
        message: result.summary,
      }));
    } catch (error) {
      setPageState((current) => ({
        ...current,
        taskBusy: false,
        runningTaskId: null,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[var(--ls-border)] bg-white p-7 shadow-[var(--ls-shadow)]">
        <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Runtime State</div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--ls-ink-strong)]">陆思源运行态</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ls-ink-soft)]">
          请先在顶部输入 Admin Token。运行态保存心力和状态标签；正在做的事由自主任务系统记录。
        </p>
      </section>
    );
  }

  const runtime = pageState.state;
  const runtimeMetadata = metadataRecord(runtime?.metadata);
  const activeTasks = pageState.autonomousTasks.filter((task) => task.status === "active");

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-6 shadow-[var(--ls-shadow)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Runtime State</div>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">陆思源运行态</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ls-ink-soft)]">
              运行态现在只管心力和最近状态。Owner 聊天不会直接改这里；“正在做的事”由下面的自主任务真实推进并落库。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="default" onClick={() => void loadState()}>
              刷新
            </Button>
            <Button
              type="primary"
              loading={pageState.saving}
              disabled={!dirty}
              onClick={() => void saveState()}
            >
              保存
            </Button>
            <Button
              type="default"
              disabled={pageState.saving}
              onClick={() => void runAutonomyCheck()}
            >
              自主检查
            </Button>
            <Button type="default" danger onClick={() => void resetState()}>
              重置
            </Button>
          </div>
        </div>

        {pageState.error && (
          <div className="mt-5 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm text-[var(--ls-warning-text)]">
            {pageState.error}
          </div>
        )}
        {pageState.message && (
          <div className="mt-5 rounded-lg border border-[var(--ls-success-border)] bg-[var(--ls-success-bg)] px-4 py-3 text-sm text-[var(--ls-success-text)]">
            {pageState.message}
          </div>
        )}
      </section>

      {runtime && form ? (
        <>
          <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
              <div className="text-sm text-[var(--ls-ink-soft)]">最近心情</div>
              <div className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">
                {runtime.moodLabel}
              </div>
              <div className="mt-2 text-sm text-[var(--ls-ink-soft)]">
                由心力自动映射 · 更新于 {formatDate(runtime.updatedAt)}
              </div>
              <div className="mt-6 grid gap-4">
                <MetricBar label="心力 / 状态值" value={runtime.energyLevel} min={0} max={100} />
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-5">
              <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">自主活动摘要</h3>
              <InfoBlock label="进行中任务" value={activeTasks.length > 0 ? `${activeTasks.length} 个` : "暂无"} />
              <InfoBlock
                label="最近自主检查"
                value={metadataValue(runtimeMetadata, "lastAutonomyTick")}
              />
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
              <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">详情信息</h3>
              <div className="mt-4 grid gap-3">
                <DetailRow label="State ID" value={runtime.id} />
                <DetailRow label="Key" value={runtime.key} />
                <DetailRow label="创建时间" value={formatDate(runtime.createdAt)} />
                <DetailRow label="更新时间" value={formatDate(runtime.updatedAt)} />
              </div>

              <div className="mt-5 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
                <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">最近事件</div>
                <p className="mt-2 text-sm leading-7 text-[var(--ls-ink-strong)]">
                  {runtime.recentEventSummary || "暂无新的状态变更。"}
                </p>
              </div>

              <div className="mt-4 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
                <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">状态备注</div>
                <p className="mt-2 text-sm leading-7 text-[var(--ls-ink-strong)]">
                  {runtime.statusNote || "暂无备注。"}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
              <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">配置与控制</h3>
              <p className="mt-1 text-xs leading-6 text-[var(--ls-ink-soft)]">
                状态标签由心力自动映射。当前页面只允许手动调心力和备注；目标、关注点、正在做的事不再写入运行态。
              </p>
              <div className="mt-4 grid gap-4">
                <SliderField
                  label="心力 / 状态值"
                  value={form.energyLevel}
                  min={0}
                  max={100}
                  onChange={(value) => setForm({ ...form, energyLevel: value })}
                />
                <TextAreaField
                  label="最近事件"
                  value={form.recentEventSummary}
                  onChange={(value) => setForm({ ...form, recentEventSummary: value })}
                />
                <TextAreaField
                  label="状态备注"
                  value={form.statusNote}
                  onChange={(value) => setForm({ ...form, statusNote: value })}
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">自主任务</h3>
                <p className="mt-1 max-w-3xl text-xs leading-6 text-[var(--ls-ink-soft)]">
                  这里记录陆思源“真的在做的事”。每次推进只做一小步，会留下运行记录和产物；自主检查在聊天较少时会自动挑一个 active 任务推进。
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
              <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
                <h4 className="text-sm font-semibold text-[var(--ls-ink-strong)]">新建任务</h4>
                <div className="mt-3 grid gap-3">
                  <TextField
                    label="标题"
                    value={taskForm.title}
                    onChange={(value) => setTaskForm({ ...taskForm, title: value })}
                  />
                  <label>
                    <span className="mb-1 block text-xs font-semibold text-[var(--ls-ink-soft)]">类型</span>
                    <select
                      className="field-input"
                      value={taskForm.type}
                      onChange={(event) => setTaskForm({ ...taskForm, type: event.target.value })}
                    >
                      {taskTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <SliderField
                    label="优先级"
                    value={taskForm.priority}
                    min={0}
                    max={100}
                    onChange={(value) => setTaskForm({ ...taskForm, priority: value })}
                  />
                  <TextAreaField
                    label="任务描述"
                    value={taskForm.description}
                    onChange={(value) => setTaskForm({ ...taskForm, description: value })}
                  />
                  <Button
                    type="primary"
                    loading={pageState.taskBusy}
                    onClick={() => void createTask()}
                  >
                    创建自主任务
                  </Button>
                </div>
              </div>

              <div className="grid gap-3">
                {pageState.autonomousTasks.length > 0 ? (
                  pageState.autonomousTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      busy={pageState.taskBusy}
                      running={pageState.runningTaskId === task.id}
                      onRun={() => void runTask(task)}
                      onStatus={(status) => void changeTaskStatus(task, status)}
                    />
                  ))
                ) : (
                  <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
                    暂无自主任务。可以先手动给他一个长期任务，比如读一本书、整理一个游戏攻略，或准备一组小红书内容。
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">状态变更</h3>
                <p className="mt-1 text-xs text-[var(--ls-ink-soft)]">
                  最近 12 条真正写入 RuntimeState 的变化；点开一条可以看为什么变、变了哪些字段。
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
              {pageState.events.length > 0 ? (
                <>
                  <div className="grid gap-3 self-start">
                    {pageState.events.map((event) => {
                      const active = selectedStateEvent?.id === event.id;
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setSelectedStateEventId(event.id)}
                          className={`admin-layout-button grid w-full gap-3 rounded-lg border px-4 py-3 text-left transition md:grid-cols-[9rem_1fr_11rem] ${
                            active ? "is-active" : ""
                          }`}
                        >
                          <div>
                            <div className="text-sm font-semibold text-[var(--ls-ink-strong)]">
                              {eventTypeLabel(event.eventType)}
                            </div>
                            <div className="mt-1 text-xs text-[var(--ls-ink-soft)]">
                              {event.source ?? "unknown"}
                            </div>
                          </div>
                          <div className="text-sm leading-6 text-[var(--ls-ink-strong)]">{event.summary}</div>
                          <div className="text-xs text-[var(--ls-ink-soft)] md:text-right">
                            {formatDate(event.createdAt)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid gap-4">
                    <StateChangeDetail
                      event={selectedStateEvent}
                      eventTypeLabel={eventTypeLabel}
                      fieldLabels={runtimeFieldLabels}
                      title="状态变化解释"
                    />
                    <RuntimeStateSourceMaterials
                      detail={pageState.sourceDetail}
                      loading={pageState.sourceLoading}
                      error={pageState.sourceError}
                    />
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)] xl:col-span-2">
                  暂无状态变更。
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-[var(--ls-border)] bg-white px-5 py-8 text-sm text-[var(--ls-ink-soft)]">
          {pageState.loading ? "正在读取运行态..." : "暂无运行态数据。"}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  busy,
  running,
  onRun,
  onStatus,
}: {
  task: AutonomousTask;
  busy: boolean;
  running: boolean;
  onRun: () => void;
  onStatus: (status: string) => void;
}) {
  const latestArtifact = task.artifacts?.[0] ?? null;
  return (
    <article className="rounded-lg border border-[var(--ls-border)] bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-[var(--ls-ink-strong)]">{task.title}</h4>
            <span className="admin-chip">{taskTypeLabel(task.type)}</span>
            <span className={task.status === "active" ? "admin-chip admin-chip-mint" : "admin-chip"}>
              {taskStatusLabels[task.status] ?? task.status}
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-[var(--ls-ink-strong)]">{task.description}</p>
          <div className="mt-3 grid gap-2 text-xs leading-6 text-[var(--ls-ink-soft)]">
            <div>优先级 {task.priority} · 最近运行 {formatDate(task.lastRunAt)}</div>
            <div>当前进度：{task.currentStep || "暂无"}</div>
            <div>下一步：{task.nextStep || "暂无"}</div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="primary"
            loading={running}
            disabled={busy || task.status !== "active"}
            onClick={onRun}
          >
            推进一步
          </Button>
          {task.status === "active" ? (
            <Button type="default" disabled={busy} onClick={() => onStatus("paused")}>
              暂停
            </Button>
          ) : task.status === "paused" ? (
            <Button type="default" disabled={busy} onClick={() => onStatus("active")}>
              继续
            </Button>
          ) : null}
          {task.status !== "completed" && (
            <Button type="default" disabled={busy} onClick={() => onStatus("completed")}>
              完成
            </Button>
          )}
          {task.status !== "abandoned" && (
            <Button type="default" danger disabled={busy} onClick={() => onStatus("abandoned")}>
              放弃
            </Button>
          )}
        </div>
      </div>
      {latestArtifact && (
        <div className="mt-4 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3">
          <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">最近产物 · {latestArtifact.kind}</div>
          <div className="mt-1 text-sm font-semibold text-[var(--ls-ink-strong)]">{latestArtifact.title}</div>
          <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ls-ink-strong)]">
            {latestArtifact.content}
          </p>
        </div>
      )}
    </article>
  );
}

function TextField({
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
      <span className="mb-1 block text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <input
        className="field-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
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
      <span className="mb-1 block text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
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
    <label className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ls-ink-soft)]">
        <span>{label}</span>
        <span className="text-[var(--ls-ink-strong)]">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 w-full accent-[var(--ls-link-soft)]"
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
    <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</div>
        <div className="text-sm font-semibold text-[var(--ls-ink-strong)]">{value}</div>
      </div>
      <div className="mt-3 h-2 rounded-full bg-[var(--ls-panel-cold-deep)]">
        <div
          className={`h-2 rounded-full ${strong ? "bg-[var(--ls-success-text-soft)]" : "bg-[var(--ls-warning-text-strong)]"}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mt-4 rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3">
      <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-2 break-all text-sm leading-6 text-[var(--ls-ink-strong)]">{value || "暂无"}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 md:grid-cols-[7rem_1fr]">
      <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</div>
      <div className="break-all text-sm text-[var(--ls-ink-strong)]">{value}</div>
    </div>
  );
}
