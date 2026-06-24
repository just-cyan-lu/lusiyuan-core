import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "animal-island-ui";
import {
  fetchRuntimeSettings,
  fetchRegisteredTools,
  fetchToolCallLogs,
  saveRuntimeSettings,
  type EditableEnvConfig,
  type EnvConfigField,
  type RuntimeSettingsResponse,
  type RegisteredTool,
  type ToolCallLog,
  type ToolPolicy,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type DatePreset = "24h" | "7d" | "30d" | "all" | "custom";
type ToolAccessMode = "off" | "owner_only" | "on";

interface ToolsAdminPageProps {
  adminToken: string;
}

interface ToolsState {
  tools: RegisteredTool[];
  policy: ToolPolicy | null;
  settingsConfig: EditableEnvConfig | null;
  logs: ToolCallLog[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveError: string | null;
  saveMessage: string | null;
}

const datePresetOptions: Array<{ value: DatePreset; label: string }> = [
  { value: "24h", label: "最近 24 小时" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
  { value: "all", label: "全部时间" },
  { value: "custom", label: "自定义" },
];

const policyConfigKeys = [
  "TOOLS_ENABLED",
  "TOOLS_AUTO_EXECUTE_LOW_RISK",
  "TOOLS_ALLOW_MEDIUM_RISK",
  "TOOLS_ALLOW_HIGH_RISK",
  "TOOL_MAX_CALLS_PER_MESSAGE",
  "TOOL_TIMEOUT_MS",
  "TOOL_LOG_INPUT_OUTPUT",
];

const toolGuides: Record<
  string,
  {
    purpose: string;
    usage: string;
    trigger: string;
    modeKey: string;
    configKeys: string[];
  }
> = {
  search_memories: {
    purpose: "按语义检索当前用户相关的长期记忆，返回记忆 id、类型、摘要、重要度等。",
    usage: "用户问“我之前说过什么”“我的偏好是什么”“之前那个决策是什么”时会用到。",
    trigger: "模型判断当前回复需要额外查长期记忆时触发；受全局工具层和记忆检索开关影响。",
    modeKey: "TOOL_SEARCH_MEMORIES_MODE",
    configKeys: ["MEMORY_RETRIEVAL_ENABLED"],
  },
  summarize_recent_conversation: {
    purpose: "读取最近消息并调用模型总结对话，提炼关键点、潜在记忆、决策和未解决问题。",
    usage: "用户要求“总结这段对话”“提炼要点”“看看有什么值得记住”时使用。",
    trigger: "模型判断需要对当前或指定 conversation 做即时总结时触发。",
    modeKey: "TOOL_SUMMARIZE_RECENT_CONVERSATION_MODE",
    configKeys: [],
  },
  web_search: {
    purpose: "通过 Tavily 搜索公网信息，返回答案摘要和搜索结果列表。",
    usage: "用户问最新信息、新闻、外部资料、技术文档时使用；只读搜索，不会执行外部动作。",
    trigger: "模型判断本地知识不足或问题明显需要联网时触发；可通过访问模式限制为 owner only。",
    modeKey: "TOOL_WEB_SEARCH_MODE",
    configKeys: ["TAVILY_ENABLED", "TAVILY_MAX_RESULTS", "TAVILY_SEARCH_DEPTH"],
  },
  read_page: {
    purpose: "读取指定 URL 的正文内容，可用 Jina、Playwright 或连接已登录 Chrome 的 Chrome DevTools MCP。",
    usage: "用户发链接并要求“帮我看这页”“总结这个页面”“读取登录后的页面”时使用。",
    trigger: "模型看到需要读取网页内容时触发；截图页面倾向 Playwright，登录页面使用 Chrome DevTools MCP；可限制为 owner only。",
    modeKey: "TOOL_READ_PAGE_MODE",
    configKeys: [
      "JINA_ENABLED",
      "PLAYWRIGHT_ENABLED",
      "PLAYWRIGHT_SCREENSHOT_ENABLED",
      "PLAYWRIGHT_MAX_PAGE_TEXT_CHARS",
      "MCP_ENABLED",
      "CHROME_DEVTOOLS_MCP_ENABLED",
      "CHROME_DEVTOOLS_MCP_CONNECTION_MODE",
      "CHROME_DEVTOOLS_MCP_BROWSER_URL",
      "CHROME_DEVTOOLS_MCP_MIN_OPEN_INTERVAL_MS",
    ],
  },
  send_intermediate_message: {
    purpose: "在最终回复前发送一条中间消息，让工具调用过程更自然，例如“我去查一下”。",
    usage: "主要给模型内部使用，不需要用户手动调用。没有这个工具时，系统仍可在工具调用前发送 provider 自带文本或 MiniMax fallback 反应；有它时，模型可以主动请求额外中间消息。",
    trigger: "模型决定先给用户一个短反应再继续调用工具时触发。它不是 MiniMax 专用工具。",
    modeKey: "TOOL_SEND_INTERMEDIATE_MESSAGE_MODE",
    configKeys: [],
  },
};

function liveSettingsAsEditable(config: RuntimeSettingsResponse): EditableEnvConfig {
  return {
    envPath: "database:system_settings",
    restartRequired: false,
    fields: config.fields.map((field) => ({
      ...field,
      value: String(field.value),
      configured: Boolean(field.stored),
      fromFile: Boolean(field.stored),
      secret: false,
      restartRequired: false,
    })),
  };
}

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

function accessModeLabel(value: ToolAccessMode): string {
  if (value === "off") return "off";
  if (value === "owner_only") return "owner only";
  return "on";
}

function resolveAccessMode(
  value: string | undefined,
  fallback: ToolAccessMode
): ToolAccessMode {
  if (value === "off" || value === "owner_only" || value === "on") return value;
  return fallback;
}

function nextAccessMode(value: ToolAccessMode): ToolAccessMode {
  if (value === "on") return "owner_only";
  if (value === "owner_only") return "off";
  return "on";
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

function formValuesFromConfig(config: EditableEnvConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.value ?? ""]));
}

function fieldsByKey(config: EditableEnvConfig | null): Map<string, EnvConfigField> {
  return new Map((config?.fields ?? []).map((field) => [field.key, field]));
}

function pickEnvFields(
  fieldMap: Map<string, EnvConfigField>,
  keys: string[]
): EnvConfigField[] {
  return keys
    .map((key) => fieldMap.get(key))
    .filter((field): field is EnvConfigField => Boolean(field));
}

function uniqueKeys(keys: string[]): string[] {
  return Array.from(new Set(keys));
}

function changedConfigValues(
  fields: EnvConfigField[],
  values: Record<string, string>
): Record<string, string | boolean | number> {
  const changed: Record<string, string | boolean | number> = {};
  for (const field of fields) {
    const nextValue = values[field.key] ?? "";
    if (field.secret && nextValue === "") continue;
    if (!field.secret && nextValue === field.value) continue;

    if (field.type === "boolean") {
      changed[field.key] = nextValue === "true";
    } else if (field.type === "integer") {
      changed[field.key] = parseInt(nextValue, 10);
    } else if (field.type === "number") {
      changed[field.key] = parseFloat(nextValue);
    } else {
      changed[field.key] = nextValue;
    }
  }
  return changed;
}

function runtimeValueFromField(
  field: EnvConfigField | undefined,
  value: string
): string | boolean | number {
  if (field?.type === "boolean") return value === "true";
  if (field?.type === "integer") return parseInt(value, 10);
  if (field?.type === "number") return parseFloat(value);
  return value;
}

export function ToolsAdminPage({ adminToken }: ToolsAdminPageProps) {
  const [state, setState] = useState<ToolsState>({
    tools: [],
    policy: null,
    settingsConfig: null,
    logs: [],
    loading: false,
    saving: false,
    error: null,
    saveError: null,
    saveMessage: null,
  });
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
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
  const [deleteKeys, setDeleteKeys] = useState<string[]>([]);
  const [deleteSecretValueIndexes, setDeleteSecretValueIndexes] = useState<Record<string, number[]>>({});

  async function loadTools() {
    if (!adminToken) {
      setState({
        tools: [],
        policy: null,
        settingsConfig: null,
        logs: [],
        loading: false,
        saving: false,
        error: null,
        saveError: null,
        saveMessage: null,
      });
      setConfigValues({});
      setDeleteKeys([]);
      setDeleteSecretValueIndexes({});
      setSelectedLog(null);
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const range = resolveDateRange(datePreset, customFrom, customTo);
      const [registry, logs, settingsConfig] = await Promise.all([
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
        fetchRuntimeSettings(adminToken).then(liveSettingsAsEditable),
      ]);
      setConfigValues(formValuesFromConfig(settingsConfig));
      setDeleteKeys([]);
      setDeleteSecretValueIndexes({});
      setState({
        tools: registry.tools ?? [],
        policy: registry.policy,
        settingsConfig,
        logs,
        loading: false,
        saving: false,
        error: null,
        saveError: null,
        saveMessage: null,
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
  const settingFieldMap = useMemo(() => fieldsByKey(state.settingsConfig), [state.settingsConfig]);
  const toolConfigKeys = useMemo(
    () =>
      uniqueKeys(
        state.tools.flatMap((tool) => {
          const guide = toolGuides[tool.name];
          return guide ? [guide.modeKey, ...guide.configKeys] : [];
        })
      ),
    [state.tools]
  );
  const editableFields = useMemo(
    () => pickEnvFields(settingFieldMap, uniqueKeys([...policyConfigKeys, ...toolConfigKeys])),
    [settingFieldMap, toolConfigKeys]
  );
  const toolOptions = useMemo(
    () => [...state.tools].sort((a, b) => a.name.localeCompare(b.name)),
    [state.tools]
  );

  async function saveToolConfig() {
    if (!adminToken || !state.settingsConfig) return;
    setState((current) => ({
      ...current,
      saving: true,
      saveError: null,
      saveMessage: null,
    }));
    try {
      const keysToDelete = deleteKeys.filter((key) =>
        editableFields.some((field) => field.key === key)
      );
      const values = changedConfigValues(
        editableFields.filter(
          (field) => !keysToDelete.includes(field.key)
        ),
        configValues
      );
      for (const key of keysToDelete) {
        const field = editableFields.find((item) => item.key === key);
        if (!field || field.defaultValue === undefined) continue;
        values[key] = field.defaultValue;
      }
      if (
        Object.keys(values).length === 0
      ) {
        setState((current) => ({
          ...current,
          saving: false,
          saveMessage: "没有需要保存的工具参数改动。",
        }));
        return;
      }
      const result = await saveRuntimeSettings({
        token: adminToken,
        values,
      });
      const [freshSettings, registry] = await Promise.all([
        fetchRuntimeSettings(adminToken),
        fetchRegisteredTools(adminToken),
      ]);
      const nextConfig = liveSettingsAsEditable(freshSettings);
      setConfigValues(formValuesFromConfig(nextConfig));
      setDeleteKeys([]);
      setDeleteSecretValueIndexes({});
      setState((current) => ({
        ...current,
        tools: registry.tools,
        policy: registry.policy,
        settingsConfig: nextConfig,
        saving: false,
        saveMessage: result.message ?? `已即时应用 ${Object.keys(values).length} 项工具参数。`,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        saveError: friendlyErrorMessage(error),
      }));
    }
  }

  function handleConfigChange(key: string, value: string) {
    setConfigValues((current) => ({ ...current, [key]: value }));
    setDeleteKeys((current) => current.filter((item) => item !== key));
    setDeleteSecretValueIndexes((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function saveToolSetting(key: string, value: string) {
    if (!adminToken || !state.settingsConfig) return;
    const field = settingFieldMap.get(key);
    const previousValue = configValues[key] ?? field?.value ?? "";
    setConfigValues((current) => ({ ...current, [key]: value }));
    setDeleteKeys((current) => current.filter((item) => item !== key));
    setDeleteSecretValueIndexes((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setState((current) => ({
      ...current,
      saving: true,
      saveError: null,
      saveMessage: null,
    }));
    try {
      const result = await saveRuntimeSettings({
        token: adminToken,
        values: { [key]: runtimeValueFromField(field, value) },
      });
      const [freshSettings, registry] = await Promise.all([
        fetchRuntimeSettings(adminToken),
        fetchRegisteredTools(adminToken),
      ]);
      const nextConfig = liveSettingsAsEditable(freshSettings);
      setConfigValues(formValuesFromConfig(nextConfig));
      setDeleteKeys([]);
      setDeleteSecretValueIndexes({});
      setState((current) => ({
        ...current,
        tools: registry.tools,
        policy: registry.policy,
        settingsConfig: nextConfig,
        saving: false,
        saveMessage: result.message ?? `${field?.label ?? key} 已即时生效。`,
      }));
    } catch (error) {
      setConfigValues((current) => ({ ...current, [key]: previousValue }));
      setState((current) => ({
        ...current,
        saving: false,
        saveError: friendlyErrorMessage(error),
      }));
    }
  }

  function handlePolicyConfigChange(key: string, value: string) {
    const field = settingFieldMap.get(key);
    if (field?.type === "boolean" || field?.type === "select") {
      void saveToolSetting(key, value);
      return;
    }
    handleConfigChange(key, value);
  }

  function markConfigDeleted(key: string) {
    setConfigValues((current) => ({ ...current, [key]: "" }));
    setDeleteKeys((current) => (current.includes(key) ? current : [...current, key]));
  }

  function restoreConfigDelete(key: string) {
    setDeleteKeys((current) => current.filter((item) => item !== key));
  }

  function markSecretValueDeleted(key: string, index: number) {
    setDeleteSecretValueIndexes((current) => {
      const indexes = current[key] ?? [];
      return {
        ...current,
        [key]: indexes.includes(index) ? indexes : [...indexes, index],
      };
    });
  }

  function restoreSecretValueDelete(key: string, index: number) {
    setDeleteSecretValueIndexes((current) => {
      const indexes = (current[key] ?? []).filter((item) => item !== index);
      const next = { ...current };
      if (indexes.length > 0) next[key] = indexes;
      else delete next[key];
      return next;
    });
  }

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
              查看已注册工具、运行策略、最近调用结果和阻断原因。工具开关与限制保存到数据库并立即生效，但不会在这里手动触发工具执行。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="default"
              loading={state.loading}
              disabled={state.saving}
              onClick={() => void loadTools()}
            >
              刷新工具
            </Button>
            <Button
              type="primary"
              loading={state.saving}
              disabled={!state.settingsConfig || state.loading}
              onClick={() => void saveToolConfig()}
            >
              保存工具参数
            </Button>
          </div>
        </div>

        {state.error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {state.error}
          </div>
        )}
        {state.saveError && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {state.saveError}
          </div>
        )}
        {state.saveMessage && (
          <div className="mt-5 rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm text-[#3f7b5d]">
            {state.saveMessage}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="注册工具" value={String(state.tools.length)} detail={`${enabledTools} 个当前可用`} />
        <MetricCard label="Owner Only" value={String(ownerOnlyTools)} detail="只允许 owner 上下文调用" />
        <MetricCard label="近端日志" value={String(state.logs.length)} detail={`成功 ${summary.success} / 失败 ${summary.failed}`} />
        <MetricCard label="平均耗时" value={formatDuration(summary.averageDuration)} detail={`阻断 ${summary.blocked} 次`} />
      </section>

      {state.policy && (
        <Panel title="工具策略" subtitle="开关即时写入；数字参数手动保存">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <PolicyConfigItem
              label="工具层"
              field={settingFieldMap.get("TOOLS_ENABLED")}
              value={configValues.TOOLS_ENABLED}
              runtimeText={state.policy.enabled ? "运行中：on" : "运行中：off"}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
            />
            <PolicyConfigItem
              label="低风险自动执行"
              field={settingFieldMap.get("TOOLS_AUTO_EXECUTE_LOW_RISK")}
              value={configValues.TOOLS_AUTO_EXECUTE_LOW_RISK}
              runtimeText={state.policy.autoExecuteLowRisk ? "运行中：on" : "运行中：off"}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
            />
            <PolicyConfigItem
              label="中风险工具"
              field={settingFieldMap.get("TOOLS_ALLOW_MEDIUM_RISK")}
              value={configValues.TOOLS_ALLOW_MEDIUM_RISK}
              runtimeText={state.policy.allowMediumRisk ? "运行中：on" : "运行中：off"}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
            />
            <PolicyConfigItem
              label="高风险工具"
              field={settingFieldMap.get("TOOLS_ALLOW_HIGH_RISK")}
              value={configValues.TOOLS_ALLOW_HIGH_RISK}
              runtimeText={state.policy.allowHighRisk ? "运行中：on" : "运行中：off"}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
            />
            <PolicyConfigItem
              label="单消息上限"
              field={settingFieldMap.get("TOOL_MAX_CALLS_PER_MESSAGE")}
              value={configValues.TOOL_MAX_CALLS_PER_MESSAGE}
              runtimeText={`运行中：${state.policy.maxCallsPerMessage} 次`}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
              unit="次"
            />
            <PolicyConfigItem
              label="执行超时"
              field={settingFieldMap.get("TOOL_TIMEOUT_MS")}
              value={configValues.TOOL_TIMEOUT_MS}
              runtimeText={`运行中：${formatDuration(state.policy.timeoutMs)}`}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
              unit="ms"
            />
            <PolicyConfigItem
              label="入参出参日志"
              field={settingFieldMap.get("TOOL_LOG_INPUT_OUTPUT")}
              value={configValues.TOOL_LOG_INPUT_OUTPUT}
              runtimeText={state.policy.logInputOutput ? "运行中：on" : "运行中：off"}
              disabled={state.saving}
              onChange={handlePolicyConfigChange}
            />
          </div>
          <div className="mt-4 rounded-lg border border-[#e4d8b6] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#7d6a34]">
            开关点击后会立即写入数据库；数字参数修改后点击“保存工具参数”，页面提示成功时新的工具权限和限制已经生效。
          </div>
        </Panel>
      )}

      <Panel title="已注册工具" subtitle="来自内置 Tool Registry">
        {state.tools.length > 0 ? (
          <div className="space-y-2">
            {toolOptions.map((tool) => {
              const guide = toolGuides[tool.name];
              const modeField = guide ? settingFieldMap.get(guide.modeKey) : undefined;
              return (
                <ToolCard
                  key={tool.name}
                  tool={tool}
                  guide={guide}
                  modeField={modeField}
                  modeValue={modeField ? configValues[modeField.key] : undefined}
                  envFields={pickEnvFields(settingFieldMap, guide?.configKeys ?? [])}
                  configValues={configValues}
                  deletedKeys={deleteKeys}
                  deletedSecretValueIndexes={deleteSecretValueIndexes}
                  configDisabled={state.saving}
                  onConfigChange={handleConfigChange}
                  onModeChange={(key, value) => void saveToolSetting(key, value)}
                  onDeleteConfig={markConfigDeleted}
                  onRestoreConfig={restoreConfigDelete}
                  onDeleteSecretValue={markSecretValueDeleted}
                  onRestoreSecretValue={restoreSecretValueDelete}
                />
              );
            })}
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
              <Button
                type="primary"
                loading={state.loading}
                onClick={() => void loadTools()}
              >
                查询
              </Button>
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
                    className={`admin-layout-button grid w-full grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr] gap-3 px-4 py-3 text-left text-sm transition md:grid-cols-[1.2fr_0.6fr_0.6fr_0.6fr_0.9fr] ${
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

function PolicyConfigItem({
  label,
  field,
  value,
  runtimeText,
  disabled,
  onChange,
  unit,
}: {
  label: string;
  field?: EnvConfigField;
  value?: string;
  runtimeText: string;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  unit?: string;
}) {
  const currentValue = value || field?.value || "";
  const isBoolean = field?.type === "boolean";
  const booleanOn = currentValue === "true";

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-[#172033]">{label}</div>
        {field && isBoolean ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(field.key, booleanOn ? "false" : "true")}
            className="admin-pill-button rounded-full disabled:opacity-60"
          >
            <StatusPill active={booleanOn} label={booleanOn ? "on" : "off"} />
          </button>
        ) : (
          <StatusPill active label="可编辑" />
        )}
      </div>
      {field && !isBoolean && (
        <div className="mt-3 flex items-center gap-2">
          {field.type === "select" ? (
            <select
              value={currentValue}
              disabled={disabled}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="field-input bg-white"
            >
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={currentValue}
              disabled={disabled}
              type={field.type === "integer" || field.type === "number" ? "number" : "text"}
              min={field.min}
              max={field.max}
              step={field.type === "number" ? "0.01" : undefined}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="field-input bg-white"
            />
          )}
          {unit && <span className="shrink-0 text-xs text-[#66758a]">{unit}</span>}
        </div>
      )}
      <div className="mt-2 truncate text-xs text-[#66758a]" title={field?.key}>
        {runtimeText}
        {field ? ` · ${field.key}` : ""}
      </div>
    </div>
  );
}

function ToolCard({
  tool,
  guide,
  modeField,
  modeValue,
  envFields,
  configValues,
  deletedKeys,
  deletedSecretValueIndexes,
  configDisabled,
  onConfigChange,
  onModeChange,
  onDeleteConfig,
  onRestoreConfig,
  onDeleteSecretValue,
  onRestoreSecretValue,
}: {
  tool: RegisteredTool;
  guide?: (typeof toolGuides)[string];
  modeField?: EnvConfigField;
  modeValue?: string;
  envFields: EnvConfigField[];
  configValues: Record<string, string>;
  deletedKeys: string[];
  deletedSecretValueIndexes: Record<string, number[]>;
  configDisabled: boolean;
  onConfigChange: (key: string, value: string) => void;
  onModeChange: (key: string, value: string) => void;
  onDeleteConfig: (key: string) => void;
  onRestoreConfig: (key: string) => void;
  onDeleteSecretValue: (key: string, index: number) => void;
  onRestoreSecretValue: (key: string, index: number) => void;
}) {
  const runtimeAccessMode = resolveAccessMode(
    tool.accessMode,
    tool.enabled ? (tool.ownerOnly ? "owner_only" : "on") : "off"
  );

  return (
    <details className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff]">
      <summary className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <h4 className="min-w-[12rem] shrink-0 truncate font-semibold text-[#172033]" title={tool.name}>
            {tool.name}
          </h4>
          <p className="hidden min-w-0 truncate text-sm text-[#617188] md:block" title={tool.description}>
            {tool.description}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          <span className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-[#66758a]">
            {riskLabel(tool.riskLevel)}
          </span>
          {modeField && (
            <ToolAccessModeButton
              field={modeField}
              value={modeValue}
              runtimeMode={runtimeAccessMode}
              disabled={configDisabled}
              onChange={onModeChange}
            />
          )}
          {!modeField && tool.ownerOnly && (
            <span className="hidden rounded-full border border-[#e4d8b6] bg-[#fff9e8] px-2.5 py-1 text-[#7d6a34] sm:inline-flex">
              Owner only
            </span>
          )}
          {!modeField && !tool.enabled && (
            <span className="hidden rounded-full border border-[#ead4c8] bg-[#fff6f1] px-2.5 py-1 text-[#8d6048] sm:inline-flex">
              注册关闭
            </span>
          )}
          <StatusPill
            active={tool.effectiveEnabled}
            label={tool.effectiveEnabled ? "当前可用" : "当前不可用"}
          />
        </div>
      </summary>
      <div className="border-t border-[#d9e2ec] p-4">
      {tool.disabledReason && (
        <div className="mt-3 rounded-lg border border-[#ead4c8] bg-white px-3 py-2 text-xs text-[#8d6048]">
          {tool.disabledReason}
        </div>
      )}
      <div className="mt-4 grid gap-3 text-sm leading-6">
        <GuideRow label="功能" value={guide?.purpose ?? tool.description} />
        <GuideRow label="怎么用" value={guide?.usage ?? "由模型根据用户意图自动调用。"} />
        <GuideRow label="触发" value={guide?.trigger ?? "聊天服务提供工具列表后，由模型按需触发。"} />
      </div>
      <details className="mt-3 rounded-lg border border-[#d9e2ec] bg-white">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-[#66758a]">
          可编辑配置
          <span className="ml-2 text-[#9aa8b8]">{envFields.length > 0 ? `${envFields.length} 项` : "无单独配置"}</span>
        </summary>
        <div className="border-t border-[#d9e2ec] p-3">
          {envFields.length > 0 ? (
            <ConfigFieldsGrid
              fields={envFields}
              values={configValues}
              deletedKeys={deletedKeys}
              deletedSecretValueIndexes={deletedSecretValueIndexes}
              disabled={configDisabled}
              onChange={onConfigChange}
              onDelete={onDeleteConfig}
              onRestore={onRestoreConfig}
              onDeleteSecretValue={onDeleteSecretValue}
              onRestoreSecretValue={onRestoreSecretValue}
            />
          ) : (
            <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-2 text-xs leading-5 text-[#66758a]">
              这个工具没有独立 env 配置，主要受全局 TOOLS_ENABLED、风险策略和代码注册状态控制。
            </div>
          )}
        </div>
      </details>
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
      </div>
    </details>
  );
}

function ToolAccessModeButton({
  field,
  value,
  runtimeMode,
  disabled,
  onChange,
}: {
  field: EnvConfigField;
  value?: string;
  runtimeMode: ToolAccessMode;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  const currentMode = resolveAccessMode(value || field.value, runtimeMode);
  const className =
    currentMode === "off"
      ? "border-[#ead4c8] bg-[#fff6f1] text-[#8d6048] hover:bg-[#ffefe7]"
      : currentMode === "owner_only"
        ? "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34] hover:bg-[#fff4d6]"
        : "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d] hover:bg-[#e2f3ea]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onChange(field.key, nextAccessMode(currentMode));
      }}
      className={`admin-pill-button inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition disabled:opacity-60 ${className}`}
      title={`${field.label} · 点击后立即切换 on → owner only → off · 运行中：${accessModeLabel(runtimeMode)} · 配置项：${field.key}`}
    >
      <span>模式</span>
      <span>{accessModeLabel(currentMode)}</span>
    </button>
  );
}

function GuideRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[4rem_1fr]">
      <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
      <div className="text-[#475569]">{value}</div>
    </div>
  );
}

function ConfigFieldsGrid({
  fields,
  values,
  deletedKeys = [],
  deletedSecretValueIndexes = {},
  disabled,
  onChange,
  onDelete,
  onRestore,
  onDeleteSecretValue,
  onRestoreSecretValue,
}: {
  fields: EnvConfigField[];
  values: Record<string, string>;
  deletedKeys?: string[];
  deletedSecretValueIndexes?: Record<string, number[]>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  onDelete?: (key: string) => void;
  onRestore?: (key: string) => void;
  onDeleteSecretValue?: (key: string, index: number) => void;
  onRestoreSecretValue?: (key: string, index: number) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {fields.map((field) => (
        <ConfigFieldControl
          key={field.key}
          field={field}
          value={values[field.key] ?? ""}
          deleted={deletedKeys.includes(field.key)}
          deletedSecretValueIndexes={deletedSecretValueIndexes[field.key] ?? []}
          disabled={disabled}
          onChange={(value) => onChange(field.key, value)}
          onDelete={onDelete ? () => onDelete(field.key) : undefined}
          onRestore={onRestore ? () => onRestore(field.key) : undefined}
          onDeleteSecretValue={
            onDeleteSecretValue
              ? (index) => onDeleteSecretValue(field.key, index)
              : undefined
          }
          onRestoreSecretValue={
            onRestoreSecretValue
              ? (index) => onRestoreSecretValue(field.key, index)
              : undefined
          }
        />
      ))}
    </div>
  );
}

function ConfigFieldControl({
  field,
  value,
  deleted,
  deletedSecretValueIndexes,
  disabled,
  onChange,
  onDelete,
  onRestore,
  onDeleteSecretValue,
  onRestoreSecretValue,
}: {
  field: EnvConfigField;
  value: string;
  deleted: boolean;
  deletedSecretValueIndexes: number[];
  disabled: boolean;
  onChange: (value: string) => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onDeleteSecretValue?: (index: number) => void;
  onRestoreSecretValue?: (index: number) => void;
}) {
  const canDelete = field.secret && field.fromFile && field.configured;
  const maskedValues =
    field.maskedValues && field.maskedValues.length > 0
      ? field.maskedValues
      : field.maskedValue
        ? [field.maskedValue]
        : [];

  return (
    <div
      className={`rounded-lg border px-3 py-3 ${
        deleted ? "border-[#ead4c8] bg-[#fff6f1]" : "border-[#d9e2ec] bg-white"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[#172033]">{field.label}</span>
          <span className="mt-1 block truncate font-mono text-[11px] text-[#9aa8b8]" title={field.key}>
            {field.key}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${
            field.fromFile
              ? "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]"
              : "border-[#d9e2ec] bg-[#f8fbff] text-[#7b8ca2]"
          }`}
        >
          {field.fromFile ? "数据库" : "默认"}
        </span>
      </span>

      {field.secret && field.configured && maskedValues.length > 0 && (
        <div className="mt-3 space-y-2 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-[#7b8ca2]">
              当前 key{maskedValues.length > 1 ? ` · ${maskedValues.length} 个` : ""}
            </div>
            {canDelete && maskedValues.length > 1 && (
              deleted ? (
                <Button size="small" type="default" disabled={disabled} onClick={onRestore}>
                  撤销全部
                </Button>
              ) : (
                <Button size="small" type="default" danger disabled={disabled} onClick={onDelete}>
                  删除全部
                </Button>
              )
            )}
          </div>
          <div className="space-y-1.5">
            {maskedValues.map((maskedValue, index) => {
              const itemDeleted = deleted || deletedSecretValueIndexes.includes(index);
              return (
                <div
                  key={`${field.key}-${index}`}
                  className={`flex items-center justify-between gap-3 rounded-md border px-2.5 py-2 ${
                    itemDeleted
                      ? "border-[#ead4c8] bg-[#fff6f1]"
                      : "border-[#e5edf5] bg-white"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#9aa8b8]">#{index + 1}</div>
                    <div className="truncate font-mono text-xs text-[#334155]" title={maskedValue}>
                      {maskedValue}
                    </div>
                  </div>
                  {canDelete && (
                    itemDeleted ? (
                      <Button size="small" type="default" disabled={disabled || deleted} onClick={() => onRestoreSecretValue?.(index)}>
                        撤销
                      </Button>
                    ) : (
                      <Button size="small" type="default" danger disabled={disabled} onClick={() => onDeleteSecretValue?.(index)}>
                        删除
                      </Button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {deleted && (
        <div className="mt-3 rounded-lg border border-[#ead4c8] bg-white px-3 py-2 text-xs text-[#8d6048]">
          已标记恢复默认。点击“保存工具参数”后会写入该项的代码默认值。
        </div>
      )}
      {!deleted && deletedSecretValueIndexes.length > 0 && (
        <div className="mt-3 rounded-lg border border-[#ead4c8] bg-white px-3 py-2 text-xs text-[#8d6048]">
          已标记删除 {deletedSecretValueIndexes.length} 个 key。点击“保存工具参数”后会从逗号列表中移除。
        </div>
      )}

      <div className="mt-3">
        {field.type === "boolean" ? (
          <select
            value={value || "false"}
            disabled={disabled || deleted}
            onChange={(event) => onChange(event.target.value)}
            className="field-input bg-[#f8fbff]"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : field.type === "select" ? (
          <select
            value={value}
            disabled={disabled || deleted}
            onChange={(event) => onChange(event.target.value)}
            className="field-input bg-[#f8fbff]"
          >
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            type={field.type === "secret" ? "password" : field.type === "string" ? "text" : "number"}
            min={field.min}
            max={field.max}
            step={field.type === "number" ? "0.01" : undefined}
            disabled={disabled || deleted}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              field.type === "secret"
                ? field.configured
                  ? "输入新值会覆盖当前 key 列表"
                  : "输入新值"
                : undefined
            }
            className="field-input bg-[#f8fbff]"
          />
        )}
      </div>

      {field.description && (
        <p className="mt-2 text-xs leading-5 text-[#7b8ca2]">{field.description}</p>
      )}
    </div>
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
