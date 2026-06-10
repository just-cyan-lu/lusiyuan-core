import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchRegisteredTools,
  fetchToolCallLogs,
  type RegisteredTool,
  type ToolCallLog,
  type ToolPolicy,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type DatePreset = "24h" | "7d" | "30d" | "all" | "custom";

interface ToolsAdminPageProps {
  adminToken: string;
}

interface ToolsState {
  tools: RegisteredTool[];
  policy: ToolPolicy | null;
  logs: ToolCallLog[];
  loading: boolean;
  error: string | null;
}

const datePresetOptions: Array<{ value: DatePreset; label: string }> = [
  { value: "24h", label: "最近 24 小时" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
  { value: "all", label: "全部时间" },
  { value: "custom", label: "自定义" },
];

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新工具调用。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  if (message.includes("User not found")) {
    return "找不到这个用户。可以填写 User externalId 或内部 id。";
  }
  return message || "读取工具调用失败";
}

function formatDate(value: string | null): string {
  if (!value) return "未记录";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(value: number | null): string {
  if (value === null || value === undefined) return "无";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateStartIso(value: string): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function dateEndIso(value: string): string | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function resolveDateRange(
  preset: DatePreset,
  customFrom: string,
  customTo: string
): { from?: string; to?: string } {
  if (preset === "all") return {};
  if (preset === "custom") {
    return {
      from: dateStartIso(customFrom),
      to: dateEndIso(customTo),
    };
  }

  const now = new Date();
  if (preset === "24h") {
    return {
      from: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      to: now.toISOString(),
    };
  }

  const days = preset === "7d" ? 6 : 29;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - days);
  return {
    from: from.toISOString(),
    to: dateEndIso(localDateKey(now)),
  };
}

function riskLabel(value: string): string {
  if (value === "low") return "低风险";
  if (value === "medium") return "中风险";
  if (value === "high") return "高风险";
  return value;
}

function statusLabel(value: string, blocked?: boolean): string {
  if (blocked) return "已阻断";
  if (value === "success") return "成功";
  if (value === "failed") return "失败";
  if (value === "blocked") return "已阻断";
  return value;
}

function shortId(value: string | null): string {
  if (!value) return "无";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function stringifyJson(value: unknown, maxLength = 6000): string {
  if (value === null || value === undefined) return "无";
  try {
    const text = JSON.stringify(
      value,
      (_key, item) => {
        if (typeof item === "string" && item.length > 1200) {
          return `${item.slice(0, 1200)}...（已截断，原始长度 ${item.length}）`;
        }
        return item;
      },
      2
    );
    return text.length > maxLength
      ? `${text.slice(0, maxLength)}\n...（页面预览已截断）`
      : text;
  } catch {
    return String(value);
  }
}

function logSummary(logs: ToolCallLog[]) {
  const success = logs.filter((log) => log.status === "success" && !log.blocked).length;
  const failed = logs.filter((log) => log.status === "failed").length;
  const blocked = logs.filter((log) => log.blocked || log.status === "blocked").length;
  const durations = logs
    .map((log) => log.durationMs)
    .filter((value): value is number => typeof value === "number");
  const averageDuration =
    durations.length > 0
      ? Math.round(durations.reduce((total, value) => total + value, 0) / durations.length)
      : null;
  return { success, failed, blocked, averageDuration };
}

export function ToolsAdminPage({ adminToken }: ToolsAdminPageProps) {
  const [state, setState] = useState<ToolsState>({
    tools: [],
    policy: null,
    logs: [],
    loading: false,
    error: null,
  });
  const [selectedLog, setSelectedLog] = useState<ToolCallLog | null>(null);
  const [toolName, setToolName] = useState("all");
  const [status, setStatus] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all");
  const [blocked, setBlocked] = useState("all");
  const [userId, setUserId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [query, setQuery] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [limit, setLimit] = useState("80");

  async function loadTools() {
    if (!adminToken) {
      setState({ tools: [], policy: null, logs: [], loading: false, error: null });
      setSelectedLog(null);
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const range = resolveDateRange(datePreset, customFrom, customTo);
      const [registry, logs] = await Promise.all([
        fetchRegisteredTools(adminToken),
        fetchToolCallLogs({
          token: adminToken,
          toolName,
          status,
          riskLevel,
          blocked,
          userId: userId.trim(),
          conversationId: conversationId.trim(),
          query: query.trim(),
          limit: parseInt(limit, 10),
          ...range,
        }),
      ]);
      setState({
        tools: registry.tools ?? [],
        policy: registry.policy,
        logs,
        loading: false,
        error: null,
      });
      setSelectedLog((current) => logs.find((log) => log.id === current?.id) ?? logs[0] ?? null);
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  useEffect(() => {
    void loadTools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, toolName, status, riskLevel, blocked, datePreset, limit]);

  const summary = useMemo(() => logSummary(state.logs), [state.logs]);
  const enabledTools = state.tools.filter((tool) => tool.effectiveEnabled).length;
  const ownerOnlyTools = state.tools.filter((tool) => tool.ownerOnly).length;
  const toolOptions = useMemo(
    () => [...state.tools].sort((a, b) => a.name.localeCompare(b.name)),
    [state.tools]
  );

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Tools</div>
        <h2 className="mt-2 text-3xl font-semibold text-[#172033]">工具调用</h2>
        <p className="mt-3 text-sm leading-7 text-[#617188]">
          工具注册表和调用日志需要 Admin Token。先在右上角填入 token，再刷新这一页。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Tool Console</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">工具调用</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              查看已注册工具、运行策略、最近调用结果和阻断原因。当前页面只读，不会手动触发工具执行。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadTools()}
            disabled={state.loading}
            className="h-10 rounded-lg border border-[#c9d7e6] bg-[#f8fbff] px-4 text-sm font-medium text-[#334155] transition hover:bg-[#eef5fb] disabled:opacity-60"
          >
            {state.loading ? "刷新中" : "刷新工具"}
          </button>
        </div>

        {state.error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {state.error}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="注册工具" value={String(state.tools.length)} detail={`${enabledTools} 个当前可执行`} />
        <MetricCard label="Owner Only" value={String(ownerOnlyTools)} detail="只允许 owner 上下文调用" />
        <MetricCard label="近端日志" value={String(state.logs.length)} detail={`成功 ${summary.success} / 失败 ${summary.failed}`} />
        <MetricCard label="平均耗时" value={formatDuration(summary.averageDuration)} detail={`阻断 ${summary.blocked} 次`} />
      </section>

      {state.policy && (
        <Panel title="工具策略" subtitle="来自当前后端进程的运行时配置">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PolicyItem label="工具层" active={state.policy.enabled} detail={state.policy.enabled ? "已启用" : "全局关闭"} />
            <PolicyItem label="低风险自动执行" active={state.policy.autoExecuteLowRisk} detail={state.policy.autoExecuteLowRisk ? "允许" : "关闭"} />
            <PolicyItem label="中风险工具" active={state.policy.allowMediumRisk} detail={state.policy.allowMediumRisk ? "允许" : "阻断"} />
            <PolicyItem label="高风险工具" active={state.policy.allowHighRisk} detail={state.policy.allowHighRisk ? "允许" : "阻断"} />
            <PolicyItem label="单消息上限" active detail={`${state.policy.maxCallsPerMessage} 次`} />
            <PolicyItem label="执行超时" active detail={formatDuration(state.policy.timeoutMs)} />
            <PolicyItem label="入参出参日志" active={state.policy.logInputOutput} detail={state.policy.logInputOutput ? "记录" : "不记录"} />
          </div>
        </Panel>
      )}

      <Panel title="已注册工具" subtitle="来自内置 Tool Registry">
        {state.tools.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {toolOptions.map((tool) => (
              <ToolCard key={tool.name} tool={tool} />
            ))}
          </div>
        ) : (
          <EmptyState loading={state.loading} text="还没有读取到工具注册表。" />
        )}
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="调用日志" subtitle="来自 tool_call_logs">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <select value={toolName} onChange={(event) => setToolName(event.target.value)} className="field-input">
              <option value="all">全部工具</option>
              {toolOptions.map((tool) => (
                <option key={tool.name} value={tool.name}>
                  {tool.name}
                </option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-input">
              <option value="all">全部状态</option>
              <option value="success">成功</option>
              <option value="failed">失败</option>
              <option value="blocked">已阻断</option>
            </select>
            <select value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)} className="field-input">
              <option value="all">全部风险</option>
              <option value="low">低风险</option>
              <option value="medium">中风险</option>
              <option value="high">高风险</option>
            </select>
            <select value={blocked} onChange={(event) => setBlocked(event.target.value)} className="field-input">
              <option value="all">全部阻断状态</option>
              <option value="true">只看阻断</option>
              <option value="false">排除阻断</option>
            </select>
            <select value={datePreset} onChange={(event) => setDatePreset(event.target.value as DatePreset)} className="field-input">
              {datePresetOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select value={limit} onChange={(event) => setLimit(event.target.value)} className="field-input">
              <option value="30">30 条</option>
              <option value="80">80 条</option>
              <option value="150">150 条</option>
              <option value="200">200 条</option>
            </select>
            <input
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              placeholder="User externalId / id"
              className="field-input"
            />
            <input
              value={conversationId}
              onChange={(event) => setConversationId(event.target.value)}
              placeholder="Conversation ID"
              className="field-input"
            />
            {datePreset === "custom" && (
              <>
                <input value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} type="date" className="field-input" />
                <input value={customTo} onChange={(event) => setCustomTo(event.target.value)} type="date" className="field-input" />
              </>
            )}
            <div className="flex gap-2 md:col-span-2 xl:col-span-4">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadTools();
                }}
                placeholder="模糊搜索工具名、错误、阻断原因、渠道、会话 id"
                className="field-input"
              />
              <button
                type="button"
                onClick={() => void loadTools()}
                disabled={state.loading}
                className="shrink-0 rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7] disabled:opacity-60"
              >
                查询
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-[#d9e2ec]">
            <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-[#d9e2ec] bg-[#f8fbff] px-4 py-2 text-xs font-semibold text-[#66758a] md:grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr_0.9fr]">
              <div>工具</div>
              <div>状态</div>
              <div>风险</div>
              <div>耗时</div>
              <div className="hidden md:block">时间</div>
            </div>
            <div className="divide-y divide-[#edf2f7]">
              {state.logs.length > 0 ? (
                state.logs.map((log) => (
                  <button
                    key={log.id}
                    type="button"
                    onClick={() => setSelectedLog(log)}
                    className={`grid w-full grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-left text-sm transition md:grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr_0.9fr] ${
                      selectedLog?.id === log.id ? "bg-[#eaf2fb]" : "bg-white hover:bg-[#f8fbff]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-[#172033]" title={log.toolName}>{log.toolName}</div>
                      <div className="mt-1 truncate text-xs text-[#7b8ca2]" title={log.channel ?? undefined}>
                        {log.channel ?? "unknown"} · {shortId(log.conversationId)}
                      </div>
                    </div>
                    <div><StatusBadge value={statusLabel(log.status, log.blocked)} tone={log.blocked ? "blocked" : log.status} /></div>
                    <div className="text-[#66758a]">{riskLabel(log.riskLevel)}</div>
                    <div className="text-[#66758a]">{formatDuration(log.durationMs)}</div>
                    <div className="hidden text-[#66758a] md:block">{formatDate(log.createdAt)}</div>
                  </button>
                ))
              ) : (
                <EmptyState loading={state.loading} text="当前筛选下没有工具调用记录。" />
              )}
            </div>
          </div>
        </Panel>

        <Panel title="调用详情" subtitle={selectedLog ? selectedLog.id : "选择一条日志"}>
          {selectedLog ? (
            <LogDetail log={selectedLog} />
          ) : (
            <EmptyState loading={state.loading} text="选择左侧一条调用日志后查看详情。" />
          )}
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white px-5 py-4 shadow-sm">
      <div className="text-xs text-[#7b8ca2]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#172033]">{value}</div>
      <div className="mt-1 text-xs text-[#66758a]">{detail}</div>
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
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#172033]">{title}</h3>
          <p className="mt-1 text-xs text-[#7b8ca2]">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function PolicyItem({
  label,
  active,
  detail,
}: {
  label: string;
  active: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[#172033]">{label}</div>
        <StatusPill active={active} label={active ? "on" : "off"} />
      </div>
      <div className="mt-2 text-xs text-[#66758a]">{detail}</div>
    </div>
  );
}

function ToolCard({ tool }: { tool: RegisteredTool }) {
  return (
    <article className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-semibold text-[#172033]" title={tool.name}>{tool.name}</h4>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#617188]" title={tool.description}>
            {tool.description}
          </p>
        </div>
        <StatusPill
          active={tool.effectiveEnabled}
          label={tool.effectiveEnabled ? "可执行" : "不可执行"}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-[#66758a]">
          {riskLabel(tool.riskLevel)}
        </span>
        {tool.ownerOnly && (
          <span className="rounded-full border border-[#e4d8b6] bg-[#fff9e8] px-2.5 py-1 text-[#7d6a34]">
            Owner only
          </span>
        )}
        {!tool.enabled && (
          <span className="rounded-full border border-[#ead4c8] bg-[#fff6f1] px-2.5 py-1 text-[#8d6048]">
            注册关闭
          </span>
        )}
      </div>
      {tool.disabledReason && (
        <div className="mt-3 rounded-lg border border-[#ead4c8] bg-white px-3 py-2 text-xs text-[#8d6048]">
          {tool.disabledReason}
        </div>
      )}
      {Boolean(tool.parameters) && (
        <details className="mt-3 rounded-lg border border-[#d9e2ec] bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#66758a]">
            参数 schema
          </summary>
          <pre className="max-h-48 overflow-auto border-t border-[#d9e2ec] p-3 text-xs leading-5 text-[#334155]">
            {stringifyJson(tool.parameters, 3000)}
          </pre>
        </details>
      )}
    </article>
  );
}

function StatusBadge({ value, tone }: { value: string; tone: string }) {
  const className =
    tone === "success"
      ? "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]"
      : tone === "failed"
        ? "border-[#ead4c8] bg-[#fff6f1] text-[#8d6048]"
        : tone === "blocked"
          ? "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34]"
          : "border-[#d9e2ec] bg-white text-[#66758a]";
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${className}`}>
      {value}
    </span>
  );
}

function LogDetail({ log }: { log: ToolCallLog }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 text-sm">
        <DetailRow label="工具" value={log.toolName} />
        <DetailRow label="状态" value={statusLabel(log.status, log.blocked)} />
        <DetailRow label="风险" value={riskLabel(log.riskLevel)} />
        <DetailRow label="渠道" value={log.channel ?? "无"} />
        <DetailRow label="用户 ID" value={log.userId ?? "无"} />
        <DetailRow label="会话 ID" value={log.conversationId ?? "无"} />
        <DetailRow label="消息 ID" value={log.messageId ?? "无"} />
        <DetailRow label="耗时" value={formatDuration(log.durationMs)} />
        <DetailRow label="时间" value={formatDate(log.createdAt)} />
      </div>

      {log.error && (
        <div className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-3 py-2 text-sm leading-6 text-[#8d6048]">
          {log.error}
        </div>
      )}
      {log.blockReason && (
        <div className="rounded-lg border border-[#e4d8b6] bg-[#fff9e8] px-3 py-2 text-sm leading-6 text-[#7d6a34]">
          {log.blockReason}
        </div>
      )}

      <JsonBlock title="Input" value={log.input} />
      <JsonBlock title="Output" value={log.output} />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-3">
      <div className="text-[#7b8ca2]">{label}</div>
      <div className="min-w-0 break-all font-mono text-xs text-[#334155]" title={value}>{value}</div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <details open className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff]">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-[#172033]">
        {title}
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-[#d9e2ec] p-3 text-xs leading-5 text-[#334155]">
        {stringifyJson(value)}
      </pre>
    </details>
  );
}

function EmptyState({ loading, text }: { loading: boolean; text: string }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-[#7b8ca2]">
      {loading ? "读取中..." : text}
    </div>
  );
}
