import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  API_BASE_URL,
  clearDatabaseData,
  fetchEditableEnvConfig,
  fetchRuntimeSettings,
  fetchRuntimeSettingEvents,
  fetchRuntimeConfig,
  saveEditableEnvConfig,
  saveRuntimeSettings,
  type EditableEnvConfig,
  type EnvConfigField,
  type RuntimeConfig,
  type RuntimeProvider,
  type RuntimeSettingField,
  type RuntimeSettingEvent,
  type RuntimeSettingsResponse,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface ConfigCenterPageProps {
  adminToken: string;
}

interface ConfigState {
  runtime: RuntimeConfig | null;
  envConfig: EditableEnvConfig | null;
  runtimeSettings: RuntimeSettingsResponse | null;
  settingEvents: RuntimeSettingEvent[];
  loading: boolean;
  saving: boolean;
  savingRuntime: boolean;
  clearing: boolean;
  error: string | null;
  saveError: string | null;
  saveMessage: string | null;
  dangerError: string | null;
  dangerMessage: string | null;
}

interface Finding {
  level: "ok" | "warn" | "danger";
  title: string;
  detail: string;
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
  toolsAllowMediumRisk: "允许中风险工具",
  toolsAllowHighRisk: "允许高风险工具",
};

const limitLabels: Record<string, string> = {
  maxMessageLength: "单条消息最大长度",
  toolMaxCallsPerMessage: "单条消息最大工具调用",
  reflectionDefaultMessageLimit: "Reflection 默认消息数",
  reflectionMaxMessageLimit: "Reflection 最大消息数",
  dreamDefaultLookbackHours: "Dream 默认回看小时",
  dreamMaxLookbackDays: "Dream 最大回看天数",
};

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新配置中心。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "配置读取失败";
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function providerReady(provider: RuntimeProvider): boolean {
  return provider.baseUrlConfigured && provider.apiKeyConfigured && Boolean(provider.model);
}

function configuredLabel(value: boolean): string {
  return value ? "已配置" : "未配置";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function buildFindings(runtime: RuntimeConfig | null): Finding[] {
  if (!runtime) return [];

  const findings: Finding[] = [];
  const activeProvider =
    runtime.providers.find((provider) => provider.active) ?? null;
  const readyProviders = runtime.providers.filter(providerReady);

  if (!activeProvider) {
    findings.push({
      level: "danger",
      title: "没有匹配的当前模型渠道",
      detail: `ACTIVE_MODEL_PROVIDER=${runtime.activeModelProvider}，但 provider 列表里没有匹配项。`,
    });
  } else if (!providerReady(activeProvider)) {
    findings.push({
      level: "danger",
      title: "当前模型渠道配置不完整",
      detail: `${activeProvider.label} 需要 base URL、API key 和 model 都配置好。`,
    });
  }

  if (readyProviders.length === 0) {
    findings.push({
      level: "danger",
      title: "没有可用模型渠道",
      detail: "至少需要一个 provider 同时具备 base URL、API key 和 model。",
    });
  }

  if (runtime.safety.toolsAllowHighRisk) {
    findings.push({
      level: "warn",
      title: "高风险工具已放开",
      detail: "开发期可以观察行为，上线前建议重新确认这个开关。",
    });
  }

  if (runtime.safety.reflectionAutoApply || runtime.safety.dreamAutoApply) {
    findings.push({
      level: "warn",
      title: "存在自动写入记忆能力",
      detail: "Reflection 或 Dream 自动写入开启后，需要更仔细地观察记忆质量。",
    });
  }

  if (runtime.channels.telegram.enabled && !runtime.channels.telegram.tokenConfigured) {
    findings.push({
      level: "danger",
      title: "Telegram 已启用但 Token 未配置",
      detail: "TELEGRAM_ENABLED=true 时需要 TELEGRAM_BOT_TOKEN。",
    });
  }

  if (runtime.channels.weixin.enabled && !runtime.channels.weixin.secretConfigured) {
    findings.push({
      level: "danger",
      title: "Weixin 已启用但 Secret 未配置",
      detail: "WEIXIN_ENABLED=true 时需要 WEIXIN_BRIDGE_SECRET。",
    });
  }

  if (findings.length === 0) {
    findings.push({
      level: "ok",
      title: "没有明显阻断项",
      detail: "当前只读检查没有发现关键配置缺口。",
    });
  }

  return findings;
}

function formValuesFromConfig(config: EditableEnvConfig): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, field.value ?? ""]));
}

function groupEnvFields(fields: EnvConfigField[]): Array<[string, EnvConfigField[]]> {
  const groups = new Map<string, EnvConfigField[]>();
  for (const field of fields) {
    const group = groups.get(field.group) ?? [];
    group.push(field);
    groups.set(field.group, group);
  }
  return Array.from(groups.entries());
}

function groupRuntimeFields(fields: RuntimeSettingField[]): Array<[string, RuntimeSettingField[]]> {
  const groups = new Map<string, RuntimeSettingField[]>();
  for (const field of fields) {
    const group = groups.get(field.group) ?? [];
    group.push(field);
    groups.set(field.group, group);
  }
  return Array.from(groups.entries());
}

function runtimeFormValues(config: RuntimeSettingsResponse): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, String(field.value)]));
}

function changedRuntimeValues(
  fields: RuntimeSettingField[],
  values: Record<string, string>
): Record<string, string | boolean | number> {
  const changed: Record<string, string | boolean | number> = {};
  for (const field of fields) {
    const raw = values[field.key] ?? "";
    if (raw === String(field.value)) continue;
    if (field.type === "boolean") changed[field.key] = raw === "true";
    else if (field.type === "integer") changed[field.key] = parseInt(raw, 10);
    else if (field.type === "number") changed[field.key] = parseFloat(raw);
    else changed[field.key] = raw;
  }
  return changed;
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

export function ConfigCenterPage({ adminToken }: ConfigCenterPageProps) {
  const [state, setState] = useState<ConfigState>({
    runtime: null,
    envConfig: null,
    runtimeSettings: null,
    settingEvents: [],
    loading: false,
    saving: false,
    savingRuntime: false,
    clearing: false,
    error: null,
    saveError: null,
    saveMessage: null,
    dangerError: null,
    dangerMessage: null,
  });
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [runtimeValues, setRuntimeValues] = useState<Record<string, string>>({});
  const [clearPassword, setClearPassword] = useState("");
  const [clearConfirmText, setClearConfirmText] = useState("");

  async function loadConfig() {
    if (!adminToken) {
      setState({
        runtime: null,
        envConfig: null,
        runtimeSettings: null,
        settingEvents: [],
        loading: false,
        saving: false,
        savingRuntime: false,
        clearing: false,
        error: null,
        saveError: null,
        saveMessage: null,
        dangerError: null,
        dangerMessage: null,
      });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [runtime, envConfig, runtimeSettings, eventResult] = await Promise.all([
        fetchRuntimeConfig(adminToken),
        fetchEditableEnvConfig(adminToken),
        fetchRuntimeSettings(adminToken),
        fetchRuntimeSettingEvents(adminToken),
      ]);
      setFormValues(formValuesFromConfig(envConfig));
      setRuntimeValues(runtimeFormValues(runtimeSettings));
      setState((current) => ({
        ...current,
        runtime,
        envConfig,
        runtimeSettings,
        settingEvents: eventResult.events,
        loading: false,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({
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
        setState({
          runtime: null,
          envConfig: null,
          runtimeSettings: null,
          settingEvents: [],
          loading: false,
          saving: false,
          savingRuntime: false,
          clearing: false,
          error: null,
          saveError: null,
          saveMessage: null,
          dangerError: null,
          dangerMessage: null,
        });
        return;
      }

      setState((current) => ({ ...current, loading: true, error: null }));
      try {
        const [runtime, envConfig, runtimeSettings, eventResult] = await Promise.all([
          fetchRuntimeConfig(adminToken),
          fetchEditableEnvConfig(adminToken),
          fetchRuntimeSettings(adminToken),
          fetchRuntimeSettingEvents(adminToken),
        ]);
        if (!cancelled) {
          setFormValues(formValuesFromConfig(envConfig));
          setRuntimeValues(runtimeFormValues(runtimeSettings));
          setState((current) => ({
            ...current,
            runtime,
            envConfig,
            runtimeSettings,
            settingEvents: eventResult.events,
            loading: false,
            error: null,
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
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

  const runtime = state.runtime;
  const envConfig = state.envConfig;
  const runtimeSettings = state.runtimeSettings;
  const editableGroups = useMemo(() => groupEnvFields(envConfig?.fields ?? []), [envConfig]);
  const runtimeGroups = useMemo(
    () => groupRuntimeFields(runtimeSettings?.fields ?? []),
    [runtimeSettings]
  );
  const activeProvider = useMemo(
    () => runtime?.providers.find((provider) => provider.active) ?? null,
    [runtime]
  );
  const readyProviderCount = useMemo(
    () => runtime?.providers.filter(providerReady).length ?? 0,
    [runtime]
  );
  const findings = useMemo(() => buildFindings(runtime), [runtime]);

  async function saveConfig() {
    if (!adminToken || !envConfig) return;
    setState((current) => ({
      ...current,
      saving: true,
      saveError: null,
      saveMessage: null,
    }));

    try {
      const values = changedConfigValues(envConfig.fields, formValues);
      if (Object.keys(values).length === 0) {
        setState((current) => ({
          ...current,
          saving: false,
          saveMessage: "没有需要保存的改动。",
        }));
        return;
      }

      const nextConfig = await saveEditableEnvConfig({
        token: adminToken,
        values,
      });
      setFormValues(formValuesFromConfig(nextConfig));
      setState((current) => ({
        ...current,
        envConfig: nextConfig,
        saving: false,
        saveMessage: `已保存 ${nextConfig.updatedKeys?.length ?? Object.keys(values).length} 项到 .env。重启后端后生效。`,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        saving: false,
        saveError: friendlyErrorMessage(error),
      }));
    }
  }

  async function saveLiveConfig() {
    if (!adminToken || !runtimeSettings) return;
    setState((current) => ({ ...current, savingRuntime: true, saveError: null, saveMessage: null }));
    try {
      const values = changedRuntimeValues(runtimeSettings.fields, runtimeValues);
      const result = await saveRuntimeSettings({ token: adminToken, values });
      const [runtime, refreshedSettings, eventResult] = await Promise.all([
        fetchRuntimeConfig(adminToken),
        fetchRuntimeSettings(adminToken),
        fetchRuntimeSettingEvents(adminToken),
      ]);
      setRuntimeValues(runtimeFormValues(refreshedSettings));
      setState((current) => ({
        ...current,
        runtime,
        runtimeSettings: refreshedSettings,
        settingEvents: eventResult.events,
        savingRuntime: false,
        saveMessage: result.message ?? "运行配置已即时生效。",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        savingRuntime: false,
        saveError: friendlyErrorMessage(error),
      }));
    }
  }

  async function clearAllDatabaseData() {
    if (!adminToken) return;
    if (clearConfirmText.trim() !== "清空数据库" || !clearPassword.trim()) return;
    if (
      !window.confirm(
        "确定要清空数据库里的全部业务数据吗？聊天、记忆、运行态、关系状态、Dream/Reflection 记录都会被删除。"
      )
    ) {
      return;
    }

    setState((current) => ({
      ...current,
      clearing: true,
      dangerError: null,
      dangerMessage: null,
    }));

    try {
      const result = await clearDatabaseData({
        token: adminToken,
        password: clearPassword,
        confirmText: clearConfirmText.trim(),
      });
      setClearPassword("");
      setClearConfirmText("");
      setState((current) => ({
        ...current,
        clearing: false,
        dangerMessage: `${result.message} 已清空 ${result.tableCount} 张业务表。`,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        clearing: false,
        dangerError: friendlyErrorMessage(error),
      }));
    }
  }

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Configuration</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">配置中心</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。配置中心只读取安全摘要，不展示 API key、token 或 secret 原文。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Configuration</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">配置中心</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              日常开关和规则保存在数据库，保存后立即生效；连接密钥和启动安全信息继续留在 `.env`。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadConfig()}
              disabled={state.loading || state.saving || state.savingRuntime}
              className="h-10 rounded-lg border border-[#c9d7e6] bg-[#f8fbff] px-4 text-sm font-medium text-[#334155] transition hover:bg-[#eef5fb] disabled:opacity-60"
            >
              {state.loading ? "刷新中" : "刷新配置"}
            </button>
            <button
              type="button"
              onClick={() => void saveLiveConfig()}
              disabled={!runtimeSettings || state.loading || state.savingRuntime}
              className="h-10 rounded-lg border border-[#8da9c7] bg-[#6f8fb8] px-4 text-sm font-medium text-white transition hover:bg-[#607fa5] disabled:opacity-60"
            >
              {state.savingRuntime ? "应用中" : "保存并立即应用"}
            </button>
            <button
              type="button"
              onClick={() => void saveConfig()}
              disabled={!envConfig || state.loading || state.saving}
              className="h-10 rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7] disabled:opacity-60"
            >
              {state.saving ? "保存中" : "保存连接配置"}
            </button>
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

      <Panel title="危险操作" subtitle="仅用于开发期清理测试数据">
        <div className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <h4 className="text-sm font-semibold text-[#172033]">清空数据库业务数据</h4>
              <p className="mt-2 text-sm leading-6 text-[#8d6048]">
                会删除聊天、用户、记忆、运行态、关系状态、Dream/Reflection 产物、工具日志和页面快照。不会删除运行配置、Skill 配置、配置变更记录、`.env`、persona 或 migration。
              </p>
            </div>
            <button
              type="button"
              disabled={
                state.clearing ||
                clearPassword.trim().length === 0 ||
                clearConfirmText.trim() !== "清空数据库"
              }
              onClick={() => void clearAllDatabaseData()}
              className="h-10 shrink-0 rounded-lg border border-[#c77e63] bg-[#a6573f] px-4 text-sm font-semibold text-white transition hover:bg-[#934b35] disabled:cursor-not-allowed disabled:border-[#d9b8aa] disabled:bg-[#d9b8aa]"
            >
              {state.clearing ? "清空中" : "清空数据库"}
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-xs font-semibold text-[#8d6048]">清空密码</span>
              <input
                type="password"
                value={clearPassword}
                disabled={state.clearing}
                onChange={(event) => setClearPassword(event.target.value)}
                className="field-input bg-white"
                placeholder="输入 .env 中的确认密码"
              />
            </label>
            <label>
              <span className="mb-1 block text-xs font-semibold text-[#8d6048]">确认文字</span>
              <input
                value={clearConfirmText}
                disabled={state.clearing}
                onChange={(event) => setClearConfirmText(event.target.value)}
                className="field-input bg-white"
                placeholder="输入：清空数据库"
              />
            </label>
          </div>

          {state.dangerError && (
            <div className="mt-4 rounded-lg border border-[#d7a28e] bg-white px-4 py-3 text-sm text-[#8d6048]">
              {state.dangerError}
            </div>
          )}
          {state.dangerMessage && (
            <div className="mt-4 rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm text-[#3f7b5d]">
              {state.dangerMessage}
            </div>
          )}
        </div>
      </Panel>

      <Panel title="运行配置" subtitle="保存在数据库；通过校验后立即应用，不需要重启">
        {runtimeSettings ? (
          <RuntimeSettingsEditor
            groups={runtimeGroups}
            values={runtimeValues}
            disabled={state.savingRuntime}
            onChange={(key, value) =>
              setRuntimeValues((current) => ({ ...current, [key]: value }))
            }
          />
        ) : (
          <LoadingHint loading={state.loading} />
        )}
      </Panel>

      <Panel title="最近配置变更" subtitle="记录运行配置何时从什么值改成什么值">
        {state.settingEvents.length > 0 ? (
          <div className="divide-y divide-[#e5edf5] rounded-lg border border-[#d9e2ec] bg-white">
            {state.settingEvents.slice(0, 20).map((event) => (
              <div key={event.id} className="grid gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_9rem] md:items-center">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-semibold text-[#334155]" title={event.key}>{event.key}</div>
                  <div className="mt-1 text-xs text-[#7b8ca2]">{event.changedBy || event.source}</div>
                </div>
                <div className="min-w-0 text-xs text-[#617188]">
                  <span className="break-all">{JSON.stringify(event.oldValue)}</span>
                  <span className="px-2 text-[#9aa8b8]">→</span>
                  <span className="break-all font-medium text-[#334155]">{JSON.stringify(event.newValue)}</span>
                </div>
                <div className="text-xs text-[#7b8ca2] md:text-right">{formatDate(event.createdAt)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[#c9d7e6] bg-white px-4 py-5 text-sm text-[#7b8ca2]">还没有运行配置变更。</div>
        )}
      </Panel>

      <Panel
        title="连接与启动配置"
        subtitle={envConfig ? `${envConfig.envPath} · 密钥或连接地址修改后需要重启` : "读取连接配置"}
      >
        {envConfig ? (
          <EnvConfigEditor
            groups={editableGroups}
            values={formValues}
            disabled={state.saving}
            onChange={(key, value) =>
              setFormValues((current) => ({ ...current, [key]: value }))
            }
          />
        ) : (
          <LoadingHint loading={state.loading} />
        )}
      </Panel>

      <section className="grid gap-5 xl:grid-cols-4">
        <SummaryCard
          label="API Base"
          value={API_BASE_URL}
          active={true}
        />
        <SummaryCard
          label="当前模型渠道"
          value={activeProvider?.label ?? runtime?.activeModelProvider ?? "读取中"}
          active={Boolean(activeProvider && providerReady(activeProvider))}
        />
        <SummaryCard
          label="可用 Provider"
          value={`${readyProviderCount} / ${runtime?.providers.length ?? 0}`}
          active={readyProviderCount > 0}
        />
        <SummaryCard
          label="配置来源"
          value="数据库 + .env"
          active={Boolean(runtime)}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="模型提供商" subtitle="只读状态，不展示密钥原文">
          {runtime ? (
            <div className="grid gap-3 md:grid-cols-2">
              {runtime.providers.map((provider) => (
                <ProviderCard key={provider.name} provider={provider} />
              ))}
            </div>
          ) : (
            <LoadingHint loading={state.loading} />
          )}
        </Panel>

        <Panel title="配置检查" subtitle="上线前值得看一眼的小雷达">
          {runtime ? (
            <div className="grid gap-3">
              {findings.map((finding) => (
                <FindingCard key={`${finding.level}-${finding.title}`} finding={finding} />
              ))}
            </div>
          ) : (
            <LoadingHint loading={state.loading} />
          )}
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel title="渠道状态" subtitle="外部入口是否启用与关键凭证状态">
          {runtime ? (
            <div className="grid gap-3">
              <ChannelCard
                title="Telegram"
                enabled={runtime.channels.telegram.enabled}
                rows={[
                  ["Mode", runtime.channels.telegram.mode ?? "未启用"],
                  ["Bot Token", configuredLabel(runtime.channels.telegram.tokenConfigured)],
                  ["Proxy", configuredLabel(runtime.channels.telegram.proxyConfigured)],
                ]}
              />
              <ChannelCard
                title="Weixin"
                enabled={runtime.channels.weixin.enabled}
                rows={[
                  ["Mode", runtime.channels.weixin.mode ?? "未启用"],
                  ["Bridge Secret", configuredLabel(runtime.channels.weixin.secretConfigured)],
                ]}
              />
            </div>
          ) : (
            <LoadingHint loading={state.loading} />
          )}
        </Panel>

        <Panel title="功能开关" subtitle="来自数据库的实时运行配置">
          {runtime ? (
            <ToggleGrid values={runtime.features} labels={featureLabels} />
          ) : (
            <LoadingHint loading={state.loading} />
          )}
        </Panel>

        <Panel title="安全策略" subtitle="自动写入和工具风险边界">
          {runtime ? (
            <ToggleGrid values={runtime.safety} labels={safetyLabels} />
          ) : (
            <LoadingHint loading={state.loading} />
          )}
        </Panel>
      </section>

      <Panel title="限制参数" subtitle="当前已生效的数据库运行配置">
        {runtime ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(runtime.limits).map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3"
              >
                <div className="text-xs text-[#7b8ca2]">
                  {limitLabels[key] ?? formatKey(key)}
                </div>
                <div className="mt-2 text-lg font-semibold text-[#172033]">
                  {value}
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-[#9aa8b8]" title={key}>
                  {key}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <LoadingHint loading={state.loading} />
        )}
      </Panel>
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
    <section className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-[#172033]">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-[#7b8ca2]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function RuntimeSettingsEditor({
  groups,
  values,
  disabled,
  onChange,
}: {
  groups: Array<[string, RuntimeSettingField[]]>;
  values: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm leading-6 text-[#3f7b5d]">
        保存时会先校验整批配置，再写入数据库并通知模型、定时器、渠道和 MCP。页面提示成功时，新值已经生效。
      </div>
      {groups.map(([group, fields], index) => (
        <details key={group} open={index < 2} className="rounded-lg border border-[#d9e2ec] bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#172033]">
            {group}
            <span className="ml-2 text-xs font-normal text-[#7b8ca2]">{fields.length} 项</span>
          </summary>
          <div className="grid gap-3 border-t border-[#d9e2ec] p-4 md:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => {
              const value = values[field.key] ?? String(field.value);
              const enabled = value === "true";
              return (
                <label key={field.key} className="block min-w-0 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-3">
                  <span className="block text-sm font-medium text-[#172033]">{field.label}</span>
                  <span className="mt-1 block truncate font-mono text-[11px] text-[#9aa8b8]" title={field.key}>{field.key}</span>
                  <span className="mt-3 block">
                    {field.type === "boolean" ? (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={enabled}
                        disabled={disabled}
                        onClick={() => onChange(field.key, enabled ? "false" : "true")}
                        className={`flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm font-medium transition disabled:opacity-60 ${
                          enabled
                            ? "border-[#9fc7ae] bg-[#eef8f2] text-[#3f7b5d]"
                            : "border-[#c9d7e6] bg-white text-[#66758a]"
                        }`}
                      >
                        <span>{enabled ? "已开启" : "已关闭"}</span>
                        <span className={`h-5 w-9 rounded-full p-0.5 ${enabled ? "bg-[#75a184]" : "bg-[#cbd5df]"}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white transition ${enabled ? "translate-x-4" : "translate-x-0"}`} />
                        </span>
                      </button>
                    ) : field.type === "select" ? (
                      <select value={value} disabled={disabled} onChange={(event) => onChange(field.key, event.target.value)} className="field-input h-10">
                        {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type === "integer" || field.type === "number" ? "number" : "text"}
                        min={field.min}
                        max={field.max}
                        step={field.type === "number" ? "any" : undefined}
                        value={value}
                        disabled={disabled}
                        onChange={(event) => onChange(field.key, event.target.value)}
                        className="field-input h-10"
                      />
                    )}
                  </span>
                  {field.description && <span className="mt-2 block text-xs leading-5 text-[#7b8ca2]">{field.description}</span>}
                </label>
              );
            })}
          </div>
        </details>
      ))}
    </div>
  );
}

function EnvConfigEditor({
  groups,
  values,
  disabled,
  onChange,
}: {
  groups: Array<[string, EnvConfigField[]]>;
  values: Record<string, string>;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[#e4d8b6] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#7d6a34]">
        这里只保留外部连接、密钥和服务启动参数。API key / token / secret 留空表示不修改；保存后需要重启后端。
      </div>
      {groups.map(([group, fields], index) => (
        <details
          key={group}
          open={index < 3}
          className="rounded-lg border border-[#d9e2ec] bg-white"
        >
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#172033]">
            {group}
            <span className="ml-2 text-xs font-normal text-[#7b8ca2]">
              {fields.length} 项
            </span>
          </summary>
          <div className="grid gap-3 border-t border-[#d9e2ec] p-4 md:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => (
              <EnvConfigFieldControl
                key={field.key}
                field={field}
                value={values[field.key] ?? ""}
                disabled={disabled}
                onChange={(value) => onChange(field.key, value)}
              />
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function EnvConfigFieldControl({
  field,
  value,
  disabled,
  onChange,
}: {
  field: EnvConfigField;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-3">
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
              : "border-[#d9e2ec] bg-white text-[#7b8ca2]"
          }`}
        >
          {field.fromFile ? "env" : "默认"}
        </span>
      </span>

      <div className="mt-3">
        {field.type === "boolean" ? (
          <select
            value={value || "false"}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="field-input"
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        ) : field.type === "select" ? (
          <select
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            className="field-input"
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
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            placeholder={
              field.type === "secret"
                ? field.configured
                  ? "已配置，留空不修改"
                  : "输入新值"
                : undefined
            }
            className="field-input"
          />
        )}
      </div>

      {field.description && (
        <p className="mt-2 text-xs leading-5 text-[#7b8ca2]">{field.description}</p>
      )}
    </label>
  );
}

function SummaryCard({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-[#7b8ca2]">{label}</div>
        <StatusPill active={active} label={active ? "正常" : "待配置"} />
      </div>
      <div className="mt-4 truncate text-lg font-semibold text-[#172033]" title={value}>
        {value}
      </div>
    </div>
  );
}

function ProviderCard({ provider }: { provider: RuntimeProvider }) {
  const ready = providerReady(provider);
  return (
    <article
      className={`rounded-lg border px-4 py-4 ${
        provider.active
          ? "border-[#a9bfd7] bg-[#eaf2fb]"
          : "border-[#d9e2ec] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-[#172033]">{provider.label}</h4>
          <p className="mt-1 truncate font-mono text-xs text-[#7b8ca2]" title={provider.model ?? "未设置模型"}>
            {provider.model ?? "未设置模型"}
          </p>
        </div>
        <StatusPill
          active={ready}
          label={provider.active ? "当前" : ready ? "可用" : "缺配置"}
        />
      </div>
      <div className="mt-4 grid gap-2 text-xs text-[#66758a]">
        <MiniRow label="Base URL" active={provider.baseUrlConfigured} />
        <MiniRow label="API Key" active={provider.apiKeyConfigured} />
        <MiniRow label="Model" active={Boolean(provider.model)} />
      </div>
    </article>
  );
}

function ChannelCard({
  title,
  enabled,
  rows,
}: {
  title: string;
  enabled: boolean;
  rows: Array<[string, string]>;
}) {
  return (
    <article className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-[#172033]">{title}</h4>
        <StatusPill active={enabled} label={enabled ? "已启用" : "未启用"} />
      </div>
      <div className="mt-4 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[#7b8ca2]">{label}</span>
            <span className="truncate text-[#334155]" title={value}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ToggleGrid({
  values,
  labels,
}: {
  values: Record<string, boolean>;
  labels: Record<string, string>;
}) {
  return (
    <div className="grid gap-2">
      {Object.entries(values).map(([key, enabled]) => (
        <div
          key={key}
          className="flex items-center justify-between gap-3 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2.5"
        >
          <span className="text-sm text-[#334155]">{labels[key] ?? formatKey(key)}</span>
          <StatusPill active={enabled} />
        </div>
      ))}
    </div>
  );
}

function MiniRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={active ? "text-[#3f7b5d]" : "text-[#9a6a4f]"}>
        {configuredLabel(active)}
      </span>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const styles = {
    ok: "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]",
    warn: "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34]",
    danger: "border-[#ead4c8] bg-[#fff6f1] text-[#8d6048]",
  };
  return (
    <article className={`rounded-lg border px-4 py-3 ${styles[finding.level]}`}>
      <div className="text-sm font-semibold">{finding.title}</div>
      <p className="mt-1 text-xs leading-5">{finding.detail}</p>
    </article>
  );
}

function LoadingHint({ loading }: { loading: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-white/70 px-4 py-5 text-sm leading-6 text-[#66758a]">
      {loading ? "正在读取配置..." : "暂无配置数据。"}
    </div>
  );
}
