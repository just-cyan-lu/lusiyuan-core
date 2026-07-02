import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "animal-island-ui";
import { AdminInput, AdminSelect } from "./AdminFormPrimitives";
import {
  archiveAdminMemory,
  createAdminMemory,
  fetchAdminMemoryActivity,
  fetchAdminMemoryEvidence,
  fetchAdminMemories,
  updateAdminMemory,
  type AdminMemoryActivity,
  type AdminMemory,
  type AdminMemoryEvidence,
  type RuntimeSourceMessage,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type MemoryStatusFilter = "active" | "archived" | "superseded" | "all";
type MemoryScopeFilter = "all" | "person" | "global" | "project" | "topic";
type MemoryDatePreset = "all" | "7d" | "30d" | "90d" | "custom";
type MemoryDateField = "createdAt" | "updatedAt" | "lastAccessedAt";
type MemorySortKey =
  | "updated_desc"
  | "created_desc"
  | "access_desc"
  | "stale_access";

interface MemoryLibraryPageProps {
  adminToken: string;
  focusMemoryId?: string | null;
  focusPersonId?: string | null;
}

interface MemoryFormState {
  mode: "create" | "edit";
  memoryId: string | null;
  personId: string;
  scope: string;
  type: string;
  tier: string;
  status: string;
  content: string;
  summary: string;
}

const statusOptions: Array<{ value: MemoryStatusFilter; label: string }> = [
  { value: "active", label: "活跃" },
  { value: "archived", label: "已归档" },
  { value: "superseded", label: "已替换" },
  { value: "all", label: "全部" },
];

const scopeOptions: Array<{ value: MemoryScopeFilter; label: string }> = [
  { value: "all", label: "全部范围" },
  { value: "person", label: "身份" },
  { value: "global", label: "全局" },
  { value: "project", label: "项目" },
  { value: "topic", label: "话题" },
];

const datePresetOptions: Array<{ value: MemoryDatePreset; label: string }> = [
  { value: "all", label: "全部时间" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
  { value: "90d", label: "最近 90 天" },
  { value: "custom", label: "自定义" },
];

const dateFieldOptions: Array<{ value: MemoryDateField; label: string }> = [
  { value: "updatedAt", label: "更新时间" },
  { value: "createdAt", label: "创建时间" },
  { value: "lastAccessedAt", label: "访问时间" },
];

const sortOptions: Array<{ value: MemorySortKey; label: string }> = [
  { value: "updated_desc", label: "最近更新" },
  { value: "created_desc", label: "最近创建" },
  { value: "access_desc", label: "访问最多" },
  { value: "stale_access", label: "久未访问" },
];

const editableScopes = ["person", "global", "project", "topic"];
const editableStatuses = ["active", "archived", "superseded"];
const editableTiers = ["temp", "short", "mid", "long"];
const canonicalMemoryTypes = [
  "personal_fact",
  "user_preference",
  "recurring_topic",
  "project_context",
  "growth_event",
  "technical_decision",
  "boundary",
  "persona_feedback",
  "other",
];

const tierLabels: Record<string, string> = {
  temp: "临时",
  short: "短期",
  mid: "中期",
  long: "长期",
};

function memoryTierLabel(value: string): string {
  return tierLabels[value] ?? value;
}

function emptyForm(): MemoryFormState {
  return {
    mode: "create",
    memoryId: null,
    personId: "",
    scope: "person",
    type: "user_preference",
    tier: "temp",
    status: "active",
    content: "",
    summary: "",
  };
}

function requiresPerson(scope: string): boolean {
  return scope === "person";
}

function ownerLabel(memory: AdminMemory): string {
  if (!memory.personId) return memory.scope === "global" ? "全局基础记忆" : "无绑定身份";
  return memory.person?.label ?? firstPersonUserName(memory) ?? memory.personId;
}

function ownerInputValue(memory: AdminMemory): string {
  return memory.person?.label ?? memory.personId ?? "";
}

function firstPersonUserName(memory: AdminMemory): string | null {
  const user = memory.person?.identityLinks?.[0]?.user;
  return user?.displayName ?? user?.externalId ?? null;
}

function formFromMemory(memory: AdminMemory): MemoryFormState {
  return {
    mode: "edit",
    memoryId: memory.id,
    personId: ownerInputValue(memory),
    scope: memory.scope,
    type: memory.type,
    tier: memory.tier,
    status: memory.status,
    content: memory.content,
    summary: memory.summary ?? "",
  };
}

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新记忆库。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  if (message.includes("Person not found")) {
    return "找不到这个身份。身份记忆可以填写 Person ID、身份名或渠道 externalId。";
  }
  return message || "操作失败";
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

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return localDateKey(date);
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
  preset: MemoryDatePreset,
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
  const days = preset === "7d" ? 6 : preset === "30d" ? 29 : 89;
  return {
    from: dateStartIso(dateDaysAgo(days)),
    to: dateEndIso(localDateKey(new Date())),
  };
}

function shortId(value: string | null): string {
  if (!value) return "无";
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function toTextList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .filter(Boolean);
  }
  if (typeof value === "string") return [value];
  return [JSON.stringify(value)];
}

function mergeTypes(existing: string[], memories: AdminMemory[]): string[] {
  const next = new Set([...canonicalMemoryTypes, ...existing]);
  for (const memory of memories) {
    if (memory.type) next.add(memory.type);
  }
  return Array.from(next).sort();
}

export function MemoryLibraryPage({ adminToken, focusMemoryId, focusPersonId }: MemoryLibraryPageProps) {
  const [statusFilter, setStatusFilter] = useState<MemoryStatusFilter>(
    focusMemoryId ? "all" : "active"
  );
  const [scopeFilter, setScopeFilter] = useState<MemoryScopeFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [personFilter, setPersonFilter] = useState(focusPersonId ?? "");
  const [query, setQuery] = useState(focusMemoryId ?? "");
  const [datePreset, setDatePreset] = useState<MemoryDatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateField, setDateField] = useState<MemoryDateField>("updatedAt");
  const [sortKey, setSortKey] = useState<MemorySortKey>("updated_desc");
  const [memories, setMemories] = useState<AdminMemory[]>([]);
  const [activity, setActivity] = useState<AdminMemoryActivity | null>(null);
  const [knownTypes, setKnownTypes] = useState<string[]>(canonicalMemoryTypes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<MemoryFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createFocusSignal, setCreateFocusSignal] = useState(0);
  const [evidence, setEvidence] = useState<AdminMemoryEvidence | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedId) ?? null,
    [memories, selectedId]
  );

  const typeOptions = useMemo(() => {
    return ["all", ...knownTypes];
  }, [knownTypes]);

  const summary = useMemo(() => {
    return memories.reduce<Record<string, number>>((acc, memory) => {
      acc[memory.status] = (acc[memory.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [memories]);

  const dateRange = useMemo(
    () => resolveDateRange(datePreset, fromDate, toDate),
    [datePreset, fromDate, toDate]
  );

  async function loadMemories() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    setActionMessage(null);

    try {
      const [next, nextActivity] = await Promise.all([
        fetchAdminMemories({
          token: adminToken,
          personId: personFilter.trim() || undefined,
          status: statusFilter,
          scope: scopeFilter,
          type: typeFilter,
          query: query.trim() || undefined,
          from: dateRange.from,
          to: dateRange.to,
          dateField,
          sort: sortKey,
          limit: 200,
        }),
        fetchAdminMemoryActivity({
          token: adminToken,
          personId: personFilter.trim() || undefined,
          status: statusFilter,
          scope: scopeFilter,
          type: typeFilter,
          query: query.trim() || undefined,
          dateField,
        }),
      ]);
      setMemories(next);
      setActivity(nextActivity);
      setKnownTypes((current) => mergeTypes(current, next));
      const nextSelected =
        next.find((memory) => memory.id === selectedId) ?? next[0] ?? null;
      setSelectedId(nextSelected?.id ?? null);
      setForm(nextSelected ? formFromMemory(nextSelected) : emptyForm());
    } catch (err) {
      setMemories([]);
      setActivity(null);
      setSelectedId(null);
      setForm(emptyForm());
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      if (!adminToken) return;
      setLoading(true);
      setError(null);
      try {
        const [next, nextActivity] = await Promise.all([
          fetchAdminMemories({
            token: adminToken,
            status: statusFilter,
            scope: scopeFilter,
            type: typeFilter,
            personId: personFilter.trim() || undefined,
            query: query.trim() || undefined,
            from: dateRange.from,
            to: dateRange.to,
            dateField,
            sort: sortKey,
            limit: 200,
          }),
          fetchAdminMemoryActivity({
            token: adminToken,
            personId: personFilter.trim() || undefined,
            status: statusFilter,
            scope: scopeFilter,
            type: typeFilter,
            query: query.trim() || undefined,
            dateField,
          }),
        ]);
        if (cancelled) return;
        setMemories(next);
        setActivity(nextActivity);
        setKnownTypes((current) => mergeTypes(current, next));
        const nextSelected = next[0] ?? null;
        setSelectedId(nextSelected?.id ?? null);
        setForm(nextSelected ? formFromMemory(nextSelected) : emptyForm());
      } catch (err) {
        if (!cancelled) {
          setMemories([]);
          setActivity(null);
          setSelectedId(null);
          setForm(emptyForm());
          setError(friendlyErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitial();
    return () => {
      cancelled = true;
    };
  }, [
    adminToken,
    dateField,
    dateRange.from,
    dateRange.to,
    scopeFilter,
    sortKey,
    statusFilter,
    typeFilter,
    personFilter,
    query,
  ]);

  useEffect(() => {
    if (focusPersonId) setPersonFilter(focusPersonId);
  }, [focusPersonId]);

  useEffect(() => {
    let cancelled = false;

    async function loadEvidence() {
      if (!adminToken || !selectedId) {
        setEvidence(null);
        setEvidenceError(null);
        setEvidenceLoading(false);
        return;
      }

      setEvidenceLoading(true);
      setEvidenceError(null);
      setEvidence(null);
      try {
        const next = await fetchAdminMemoryEvidence({
          token: adminToken,
          memoryId: selectedId,
        });
        if (cancelled) return;
        setEvidence(next);
      } catch (err) {
        if (!cancelled) {
          setEvidence(null);
          setEvidenceError(friendlyErrorMessage(err));
        }
      } finally {
        if (!cancelled) setEvidenceLoading(false);
      }
    }

    void loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [adminToken, selectedId]);

  function selectActivityDay(day: string) {
    setDatePreset("custom");
    setFromDate(day);
    setToDate(day);
  }

  function selectMemory(memory: AdminMemory) {
    setSelectedId(memory.id);
    setForm(formFromMemory(memory));
    setActionError(null);
    setActionMessage(null);
  }

  function startCreate() {
    setSelectedId(null);
    setForm(emptyForm());
    setActionError(null);
    setActionMessage("正在新增一条空白记忆。填写 Content 后点击保存新增。");
    setCreateFocusSignal((current) => current + 1);
  }

  async function submitForm() {
    if (!adminToken) return;
    setSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      if (!form.type.trim()) throw new Error("Type 不能为空");
      if (!form.content.trim()) throw new Error("Content 不能为空");
      if (requiresPerson(form.scope) && !form.personId.trim()) {
        throw new Error("身份记忆需要填写 Person ID、身份名或渠道 externalId");
      }

      const input = {
        token: adminToken,
        memoryId: form.memoryId ?? undefined,
        personId: requiresPerson(form.scope) ? form.personId.trim() : null,
        type: form.type.trim(),
        scope: form.scope,
        tier: form.tier,
        content: form.content.trim(),
        summary: form.summary.trim() || null,
        status: form.status,
      };

      const saved =
        form.mode === "create"
          ? await createAdminMemory(input)
          : await updateAdminMemory(input);

      setMemories((current) => {
        const exists = current.some((memory) => memory.id === saved.id);
        return exists
          ? current.map((memory) => (memory.id === saved.id ? saved : memory))
          : [saved, ...current];
      });
      setKnownTypes((current) => mergeTypes(current, [saved]));
      setSelectedId(saved.id);
      setForm(formFromMemory(saved));
      setActionMessage(form.mode === "create" ? "记忆已新增。" : "记忆已保存。");
    } catch (err) {
      setActionError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function archiveSelected() {
    if (!adminToken || !selectedMemory) return;
    setSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const archived = await archiveAdminMemory({
        token: adminToken,
        memoryId: selectedMemory.id,
      });
      setMemories((current) =>
        current.map((memory) => (memory.id === archived.id ? archived : memory))
      );
      setSelectedId(archived.id);
      setForm(formFromMemory(archived));
      setActionMessage("记忆已归档。");
    } catch (err) {
      setActionError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!adminToken) {
    return (
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-7 shadow-[var(--ls-shadow)]">
        <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Memory Library</div>
        <h3 className="mt-3 text-3xl font-semibold text-[var(--ls-ink-strong)]">记忆库</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ls-ink-soft)]">
          请先在顶部输入 Admin Token。这里会读取和管理已写入 `memories` 表的长期记忆。
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="admin-select-host rounded-lg border border-[var(--ls-border)] bg-white p-5 shadow-[var(--ls-shadow)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="block">
            <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">状态</span>
            <AdminSelect
              className="mt-1"
              ariaLabel="状态"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as MemoryStatusFilter)}
              options={statusOptions.map((option) => ({ key: option.value, label: option.label }))}
            />
          </div>
          <div className="block">
            <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">范围</span>
            <AdminSelect
              className="mt-1"
              ariaLabel="范围"
              value={scopeFilter}
              onChange={(value) => setScopeFilter(value as MemoryScopeFilter)}
              options={scopeOptions.map((option) => ({ key: option.value, label: option.label }))}
            />
          </div>
          <div className="block">
            <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">类型</span>
            <AdminSelect
              className="mt-1"
              ariaLabel="类型"
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions.map((value) => ({
                key: value,
                label: value === "all" ? "全部类型" : value,
              }))}
            />
          </div>
          <FilterInput
            label="身份"
            value={personFilter}
            placeholder="Person ID / 身份名 / externalId"
            onChange={setPersonFilter}
          />
          <FilterInput
            label="搜索"
            value={query}
            placeholder="id / content / user / tier"
            onChange={setQuery}
          />
          <div className="block">
            <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">时间字段</span>
            <AdminSelect
              className="mt-1"
              ariaLabel="时间字段"
              value={dateField}
              onChange={(value) => setDateField(value as MemoryDateField)}
              options={dateFieldOptions.map((option) => ({ key: option.value, label: option.label }))}
            />
          </div>
          <div className="block">
            <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">时间范围</span>
            <AdminSelect
              className="mt-1"
              ariaLabel="时间范围"
              value={datePreset}
              onChange={(value) => setDatePreset(value as MemoryDatePreset)}
              options={datePresetOptions.map((option) => ({ key: option.value, label: option.label }))}
            />
          </div>
          <FilterInput
            label="开始日期"
            value={fromDate}
            type="date"
            onChange={(value) => {
              setFromDate(value);
              setDatePreset("custom");
            }}
          />
          <FilterInput
            label="结束日期"
            value={toDate}
            type="date"
            onChange={(value) => {
              setToDate(value);
              setDatePreset("custom");
            }}
          />
          <div className="block">
            <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">排序</span>
            <AdminSelect
              className="mt-1"
              ariaLabel="排序"
              value={sortKey}
              onChange={(value) => setSortKey(value as MemorySortKey)}
              options={sortOptions.map((option) => ({ key: option.value, label: option.label }))}
            />
          </div>
          <Button
            type="default"
            className="h-11 self-end"
            loading={loading}
            onClick={() => void loadMemories()}
          >
            刷新
          </Button>
          <Button type="primary" className="h-11 self-end" onClick={startCreate}>
            新增记忆
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm text-[var(--ls-warning-text)]">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--ls-ink-soft)]">
          <StatusPill active={!loading} label={loading ? "读取中" : "已读取"} />
          <span className="rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-2.5 py-1">
            当前 {memories.length} 条
          </span>
          {Object.entries(summary).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-2.5 py-1"
            >
              {status}: {count}
            </span>
          ))}
        </div>

        <MemoryActivityHeatmap
          activity={activity}
          selectedFromDate={datePreset === "custom" ? fromDate : ""}
          selectedToDate={datePreset === "custom" ? toDate : ""}
          onSelectDay={selectActivityDay}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-[var(--ls-ink-strong)]">记忆列表</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--ls-ink-soft)]">
              全局/项目/话题记忆跨身份生效；身份记忆只在对应 PersonIdentity 下参与检索。
            </p>
          </div>

          {loading && memories.length === 0 ? (
            <QueuePlaceholder text="正在读取记忆…" />
          ) : memories.length === 0 ? (
            <QueuePlaceholder text="当前筛选下没有记忆。" />
          ) : (
            <div className="grid max-h-[48rem] gap-2 overflow-y-auto pr-1">
              {memories.map((memory) => (
                <MemoryListItem
                  key={memory.id}
                  memory={memory}
                  selected={memory.id === selectedId}
                  onSelect={() => selectMemory(memory)}
                />
              ))}
            </div>
          )}
        </div>

        <MemoryEditor
          form={form}
          selectedMemory={selectedMemory}
          evidence={evidence}
          evidenceLoading={evidenceLoading}
          evidenceError={evidenceError}
          saving={saving}
          focusSignal={createFocusSignal}
          actionError={actionError}
          actionMessage={actionMessage}
          typeOptions={knownTypes}
          onFormChange={setForm}
          onSubmit={() => void submitForm()}
          onArchive={() => void archiveSelected()}
        />
      </section>
    </div>
  );
}

function MemoryListItem({
  memory,
  selected,
  onSelect,
}: {
  memory: AdminMemory;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`admin-layout-button w-full rounded-lg border px-4 py-3 text-left transition ${
        selected
          ? "border-[var(--ls-border-cold-soft)] bg-[var(--ls-panel-soft)] shadow-sm"
          : "border-[var(--ls-border)] bg-white hover:border-[var(--ls-border)] hover:bg-[var(--ls-panel-cold)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[var(--ls-ink-strong)]">{memory.type}</span>
            <span
              className="rounded-full bg-white/80 px-2 py-0.5 font-mono text-xs text-[var(--ls-ink-soft)]"
              title={memory.id}
            >
              ID {shortId(memory.id)}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[var(--ls-ink-soft)]">
              {memory.scope}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[var(--ls-ink-soft)]">
              {memoryTierLabel(memory.tier)}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[var(--ls-ink-soft)]">
              {ownerLabel(memory)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--ls-ink-strong)]" title={memory.content}>
            {memory.summary || memory.content}
          </p>
        </div>
        <StatusPill active={memory.status === "active"} label={memory.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ls-ink-soft)]">
        <span>本层提及 {memory.tierMentionCount}</span>
        <span>·</span>
        <span>{formatDate(memory.updatedAt)}</span>
      </div>
    </button>
  );
}

function MemoryActivityHeatmap({
  activity,
  selectedFromDate,
  selectedToDate,
  onSelectDay,
}: {
  activity: AdminMemoryActivity | null;
  selectedFromDate: string;
  selectedToDate: string;
  onSelectDay: (day: string) => void;
}) {
  const dayMap = useMemo(() => {
    const map = new Map<string, { count: number }>();
    for (const day of activity?.days ?? []) {
      map.set(day.date, { count: day.count });
    }
    return map;
  }, [activity]);

  const cells = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(today);
    firstDay.setDate(firstDay.getDate() - 364);
    const blankCount = firstDay.getDay();
    const next: Array<{
      date: string | null;
      count: number;
    }> = Array.from({ length: blankCount }, () => ({
      date: null,
      count: 0,
    }));

    for (let index = 0; index < 365; index += 1) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + index);
      const key = localDateKey(date);
      const value = dayMap.get(key) ?? { count: 0 };
      next.push({ date: key, ...value });
    }
    return next;
  }, [dayMap]);

  const peak = Math.max(1, ...cells.map((cell) => cell.count));

  function intensity(cell: { count: number }): number {
    if (cell.count <= 0) return 0;
    return Math.max(1, Math.ceil((cell.count / peak) * 4));
  }

  function cellClass(level: number, selected: boolean): string {
    const colors = [
      "bg-[var(--ls-panel-cold-deep)]",
      "bg-[var(--ls-panel-cold-light)]",
      "bg-[var(--ls-panel-cold-light)]",
      "bg-[var(--ls-link)]",
      "bg-[var(--ls-link)]",
    ];
    return `${colors[level]} ${
      selected ? "ring-2 ring-[var(--ls-eyebrow-text)] ring-offset-1" : "ring-1 ring-white/80"
    }`;
  }

  return (
    <section className="mt-5 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ls-ink-strong)]">记忆活跃度</h3>
          <p className="mt-1 text-xs leading-5 text-[var(--ls-ink-soft)]">
            最近一年按天统计。点击方块会筛选当天记忆。
          </p>
        </div>
        <span className="text-xs text-[var(--ls-ink-soft)]">
          {activity ? `全年 ${activity.totalCount} 条` : "统计读取中"}
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((cell, index) =>
            cell.date ? (
              <button
                key={cell.date}
                type="button"
                onClick={() => onSelectDay(cell.date ?? "")}
                title={`${cell.date}: ${cell.count} 条`}
                className={`admin-layout-button h-2.5 w-2.5 rounded-[2px] transition hover:scale-125 ${cellClass(
                  intensity(cell),
                  cell.date >= selectedFromDate && cell.date <= selectedToDate
                )}`}
                aria-label={`${cell.date} 记忆活动`}
              />
            ) : (
              <span key={`blank-${index}`} className="h-2.5 w-2.5" />
            )
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 text-[11px] text-[var(--ls-ink-soft)]">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span
            key={level}
            className={`h-2.5 w-2.5 rounded-[2px] ${cellClass(level, false)}`}
          />
        ))}
        <span>多</span>
      </div>
    </section>
  );
}

function MemoryEditor({
  form,
  selectedMemory,
  evidence,
  evidenceLoading,
  evidenceError,
  saving,
  focusSignal,
  actionError,
  actionMessage,
  typeOptions,
  onFormChange,
  onSubmit,
  onArchive,
}: {
  form: MemoryFormState;
  selectedMemory: AdminMemory | null;
  evidence: AdminMemoryEvidence | null;
  evidenceLoading: boolean;
  evidenceError: string | null;
  saving: boolean;
  focusSignal: number;
  actionError: string | null;
  actionMessage: string | null;
  typeOptions: string[];
  onFormChange: (form: MemoryFormState) => void;
  onSubmit: () => void;
  onArchive: () => void;
}) {
  const personRequired = requiresPerson(form.scope);
  const editorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const editableTypeOptions = useMemo(() => {
    return Array.from(new Set([...typeOptions, form.type].filter(Boolean))).sort();
  }, [form.type, typeOptions]);

  useEffect(() => {
    if (!focusSignal) return;
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    contentRef.current?.focus({ preventScroll: true });
  }, [focusSignal]);

  function update<K extends keyof MemoryFormState>(key: K, value: MemoryFormState[K]) {
    onFormChange({ ...form, [key]: value });
  }

  return (
    <div
      ref={editorRef}
      className="rounded-lg border border-[var(--ls-border)] bg-white p-6 shadow-[var(--ls-shadow)]"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">
            {form.mode === "create" ? "New Memory" : "Memory Detail"}
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ls-ink-strong)]">
            {form.mode === "create" ? "新增记忆" : selectedMemory?.type ?? "记忆详情"}
          </h3>
          {selectedMemory && (
            <p className="mt-2 text-xs text-[var(--ls-ink-soft)]" title={selectedMemory.id}>
              {shortId(selectedMemory.id)} · {ownerLabel(selectedMemory)}
            </p>
          )}
        </div>
        <StatusPill active={form.status === "active"} label={form.status} />
      </div>

      {selectedMemory && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <DetailRow label="Memory ID" value={selectedMemory.id} title={selectedMemory.id} />
          <DetailRow label="Person" value={ownerLabel(selectedMemory)} title={selectedMemory.personId ?? "无"} />
          <DetailRow label="Created" value={formatDate(selectedMemory.createdAt)} title={selectedMemory.createdAt} />
          <DetailRow label="Updated" value={formatDate(selectedMemory.updatedAt)} title={selectedMemory.updatedAt} />
          <DetailRow label="Access" value={`${selectedMemory.accessCount} 次`} />
          <DetailRow label="Tier Mentions" value={`${selectedMemory.tierMentionCount} 次`} />
          <DetailRow
            label="Last Mentioned"
            value={formatDate(selectedMemory.lastMentionedAt)}
            title={selectedMemory.lastMentionedAt ?? "无"}
          />
          <DetailRow
            label="Tier Entered"
            value={formatDate(selectedMemory.tierEnteredAt)}
            title={selectedMemory.tierEnteredAt ?? "无"}
          />
          <DetailRow
            label="Mention Days"
            value={`${toTextList(selectedMemory.mentionDayKeys).length} 天`}
            title={toTextList(selectedMemory.mentionDayKeys).join(" / ") || "无"}
          />
          <DetailRow
            label="Source Messages"
            value={`${toTextList(selectedMemory.sourceMessageIds).length} 条`}
            title={toTextList(selectedMemory.sourceMessageIds).join(" / ") || "无"}
          />
        </div>
      )}

      <div className="admin-select-host mt-5 grid gap-3 md:grid-cols-2">
        <div className="block">
          <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">Type</span>
          <AdminSelect
            className="mt-1"
            ariaLabel="Type"
            value={form.type}
            onChange={(value) => update("type", value)}
            options={editableTypeOptions.map((type) => ({ key: type, label: type }))}
          />
        </div>
        <div className="block">
          <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">Scope</span>
          <AdminSelect
            className="mt-1"
            ariaLabel="Scope"
            value={form.scope}
            onChange={(scope) => {
              onFormChange({
                ...form,
                scope,
                personId: requiresPerson(scope) ? form.personId : "",
              });
            }}
            options={editableScopes.map((scope) => ({ key: scope, label: scope }))}
          />
        </div>
        <Field label={personRequired ? "身份" : "身份（非身份记忆不需要）"}>
          <AdminInput
            value={form.personId}
            onChange={(event) => update("personId", event.target.value)}
            disabled={!personRequired}
            placeholder="Person ID / 身份名 / externalId"
            aria-label="身份"
          />
        </Field>
        <div className="block">
          <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">Status</span>
          <AdminSelect
            className="mt-1"
            ariaLabel="Status"
            value={form.status}
            onChange={(value) => update("status", value)}
            options={editableStatuses.map((status) => ({ key: status, label: status }))}
          />
        </div>
        <div className="block">
          <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">Tier</span>
          <AdminSelect
            className="mt-1"
            ariaLabel="Tier"
            value={form.tier}
            onChange={(value) => update("tier", value)}
            options={editableTiers.map((tier) => ({ key: tier, label: memoryTierLabel(tier) }))}
          />
        </div>
      </div>

      <Field label="Content" className="mt-4">
        <textarea
          ref={contentRef}
          value={form.content}
          onChange={(event) => update("content", event.target.value)}
          rows={5}
          className="field-input resize-y leading-6"
          placeholder="这条记忆会参与后续回答的上下文检索。"
        />
      </Field>

      <Field label="Summary" className="mt-4">
        <textarea
          value={form.summary}
          onChange={(event) => update("summary", event.target.value)}
          rows={2}
          className="field-input resize-y leading-6"
          placeholder="可选，用于快速理解这条记忆。"
        />
      </Field>

      {actionError && (
        <div className="mt-4 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm text-[var(--ls-warning-text)]">
          {actionError}
        </div>
      )}

      {actionMessage && (
        <div className="mt-4 rounded-lg border border-[var(--ls-success-border)] bg-[var(--ls-success-bg)] px-4 py-3 text-sm text-[var(--ls-success-text)]">
          {actionMessage}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="primary" loading={saving} onClick={onSubmit}>
          {form.mode === "create" ? "保存新增" : "保存修改"}
        </Button>
        {selectedMemory && selectedMemory.status !== "archived" && (
          <Button type="default" disabled={saving} onClick={onArchive}>
            归档记忆
          </Button>
        )}
      </div>

      {selectedMemory && (
        <MemoryEvidencePanel
          memory={selectedMemory}
          evidence={evidence}
          loading={evidenceLoading}
          error={evidenceError}
        />
      )}
    </div>
  );
}

function QueuePlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--ls-border)] bg-white px-4 py-8 text-center text-sm text-[var(--ls-ink-soft)]">
      {text}
    </div>
  );
}

function FilterInput({
  label,
  value,
  type = "text",
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">{label}</span>
      <AdminInput
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
    </label>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-medium text-[var(--ls-ink-soft)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DetailRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-2">
      <div className="text-[11px] text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-1 truncate text-sm text-[var(--ls-ink-strong)]" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function MemoryEvidencePanel({
  memory,
  evidence,
  loading,
  error,
}: {
  memory: AdminMemory;
  evidence: AdminMemoryEvidence | null;
  loading: boolean;
  error: string | null;
}) {
  const sourceIds = toTextList(memory.sourceMessageIds);
  const mentionDays = evidence?.mentionDayKeys?.length
    ? evidence.mentionDayKeys
    : toTextList(memory.mentionDayKeys);

  return (
    <section className="mt-5 rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">Evidence Trail</div>
          <h4 className="mt-1 text-lg font-semibold text-[var(--ls-ink-strong)]">记忆证据链</h4>
          <p className="mt-1 text-xs leading-5 text-[var(--ls-ink-soft)]">
            这里展示这条记忆记录过哪些来源消息，以及哪些日期被 Dream 判断为有效提及。
          </p>
        </div>
        <div className="rounded-full border border-[var(--ls-border)] bg-white px-3 py-1 text-xs text-[var(--ls-ink-soft)]">
          {loading ? "读取中" : `${evidence?.messages.length ?? 0} 条消息`}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <EvidenceStat
          label="最后有效提及"
          value={formatDate(memory.lastMentionedAt)}
          title={memory.lastMentionedAt ?? "无"}
        />
        <EvidenceStat
          label="有效提及日期"
          value={`${mentionDays.length} 天`}
          title={mentionDays.join(" / ") || "无"}
        />
        <EvidenceStat
          label="来源消息"
          value={`${sourceIds.length} 条`}
          title={sourceIds.join(" / ") || "无"}
        />
      </div>

      {mentionDays.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">有效提及日期</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {mentionDays.map((day) => (
              <span
                key={day}
                className="rounded-full border border-[var(--ls-border)] bg-white px-2.5 py-1 font-mono text-xs text-[var(--ls-ink-soft)]"
              >
                {day}
              </span>
            ))}
          </div>
        </div>
      )}

      {sourceIds.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">来源消息 ID</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceIds.map((id) => (
              <span
                key={id}
                title={id}
                className="rounded-full border border-[var(--ls-border)] bg-white px-2.5 py-1 font-mono text-xs text-[var(--ls-ink-soft)]"
              >
                {shortId(id)}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-4 rounded-lg border border-[var(--ls-border)] bg-white px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
          正在读取来源消息…
        </div>
      )}

      {error && !loading && (
        <div className="mt-4 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm leading-6 text-[var(--ls-warning-text)]">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <MissingEvidenceSources messageIds={evidence?.missingMessageIds ?? []} />
          <div className="mt-4">
            <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">消息内容</div>
            <div className="mt-3 grid gap-3">
              {evidence && evidence.messages.length > 0 ? (
                evidence.messages.map((message) => (
                  <EvidenceMessageCard key={message.id} message={message} />
                ))
              ) : (
                <div className="rounded-lg border border-[var(--ls-border)] bg-white px-4 py-5 text-sm text-[var(--ls-ink-soft)]">
                  这条记忆暂时没有可展示的来源消息。手动新增的记忆可能只有提及日期，没有消息证据。
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function EvidenceStat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-white px-3 py-2">
      <div className="text-[11px] text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-[var(--ls-ink-strong)]" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function MissingEvidenceSources({ messageIds }: { messageIds: string[] }) {
  if (messageIds.length === 0) return null;
  return (
    <div className="mt-4 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-xs leading-6 text-[var(--ls-warning-text)]">
      缺失消息：{messageIds.map(shortId).join(" / ")}
    </div>
  );
}

function EvidenceMessageCard({ message }: { message: RuntimeSourceMessage }) {
  const user = message.conversation.user;
  const displayName = user.displayName || user.externalId;

  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--ls-ink-strong)]">
            {roleLabel(message.role)} · {displayName}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--ls-ink-soft)]">
            <span>{message.conversation.channel}</span>
            <span>会话 {shortId(message.conversation.externalConversationId)}</span>
            <span>消息 {shortId(message.id)}</span>
            {message.externalMessageId ? <span>外部 {shortId(message.externalMessageId)}</span> : null}
            {message.isIntermediate ? <span>中间消息</span> : null}
          </div>
        </div>
        <div className="text-xs text-[var(--ls-ink-soft)] md:text-right">
          {formatDate(message.createdAt)}
        </div>
      </div>
      <div className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-2 text-sm leading-7 text-[var(--ls-ink-strong)]">
        {message.content}
      </div>
    </div>
  );
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    user: "用户",
    assistant: "思源",
    system: "系统",
    tool: "工具",
  };
  return labels[role] ?? role;
}
