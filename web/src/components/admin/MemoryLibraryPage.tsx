import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  archiveAdminMemory,
  createAdminMemory,
  fetchAdminMemories,
  updateAdminMemory,
  type AdminMemory,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type MemoryStatusFilter = "active" | "archived" | "superseded" | "all";
type MemoryScopeFilter = "all" | "user" | "global" | "project";

interface MemoryLibraryPageProps {
  adminToken: string;
}

interface MemoryFormState {
  mode: "create" | "edit";
  memoryId: string | null;
  userId: string;
  scope: string;
  type: string;
  status: string;
  content: string;
  summary: string;
  importance: string;
  confidence: string;
  source: string;
  channel: string;
  conversationId: string;
  tagsText: string;
  entitiesText: string;
  metadataText: string;
}

const statusOptions: Array<{ value: MemoryStatusFilter; label: string }> = [
  { value: "active", label: "活跃" },
  { value: "archived", label: "已归档" },
  { value: "superseded", label: "已替换" },
  { value: "all", label: "全部" },
];

const scopeOptions: Array<{ value: MemoryScopeFilter; label: string }> = [
  { value: "all", label: "全部范围" },
  { value: "user", label: "用户" },
  { value: "global", label: "全局" },
  { value: "project", label: "项目" },
];

const editableScopes = ["user", "global", "project"];
const editableStatuses = ["active", "archived", "superseded"];
const canonicalMemoryTypes = [
  "core",
  "user_preference",
  "project_context",
  "relationship",
  "growth_event",
  "boundary",
  "technical_decision",
  "fact",
  "persona_feedback",
  "other",
];

function emptyForm(): MemoryFormState {
  return {
    mode: "create",
    memoryId: null,
    userId: "",
    scope: "user",
    type: "user_preference",
    status: "active",
    content: "",
    summary: "",
    importance: "5",
    confidence: "0.8",
    source: "admin_manual",
    channel: "",
    conversationId: "",
    tagsText: "",
    entitiesText: "",
    metadataText: "",
  };
}

function requiresUser(scope: string): boolean {
  return scope !== "global" && scope !== "project";
}

function ownerLabel(memory: AdminMemory): string {
  if (!memory.userId) return memory.scope === "global" ? "全局基础记忆" : "无绑定用户";
  return memory.user?.displayName ?? memory.user?.externalId ?? memory.userId;
}

function ownerInputValue(memory: AdminMemory): string {
  return memory.user?.externalId ?? memory.userId ?? "";
}

function formFromMemory(memory: AdminMemory): MemoryFormState {
  return {
    mode: "edit",
    memoryId: memory.id,
    userId: ownerInputValue(memory),
    scope: memory.scope,
    type: memory.type,
    status: memory.status,
    content: memory.content,
    summary: memory.summary ?? "",
    importance: String(memory.importance),
    confidence: String(memory.confidence),
    source: memory.source ?? "",
    channel: memory.channel ?? "",
    conversationId: memory.conversationId ?? "",
    tagsText: toTextList(memory.tags).join(", "),
    entitiesText: toTextList(memory.entities).join(", "),
    metadataText: memory.metadata ? JSON.stringify(memory.metadata, null, 2) : "",
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
  if (message.includes("User not found")) {
    return "找不到这个用户。用户记忆需要填写 User externalId 或内部 id。";
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

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return JSON.parse(trimmed);
}

function numberValue(value: string, fallback: number): number {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mergeTypes(existing: string[], memories: AdminMemory[]): string[] {
  const next = new Set([...canonicalMemoryTypes, ...existing]);
  for (const memory of memories) {
    if (memory.type) next.add(memory.type);
  }
  return Array.from(next).sort();
}

export function MemoryLibraryPage({ adminToken }: MemoryLibraryPageProps) {
  const [statusFilter, setStatusFilter] = useState<MemoryStatusFilter>("active");
  const [scopeFilter, setScopeFilter] = useState<MemoryScopeFilter>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<AdminMemory[]>([]);
  const [knownTypes, setKnownTypes] = useState<string[]>(canonicalMemoryTypes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<MemoryFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function loadMemories() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    setActionError(null);
    setActionMessage(null);

    try {
      const next = await fetchAdminMemories({
        token: adminToken,
        userId: userFilter.trim() || undefined,
        status: statusFilter,
        scope: scopeFilter,
        type: typeFilter,
        query: query.trim() || undefined,
        limit: 120,
      });
      setMemories(next);
      setKnownTypes((current) => mergeTypes(current, next));
      const nextSelected =
        next.find((memory) => memory.id === selectedId) ?? next[0] ?? null;
      setSelectedId(nextSelected?.id ?? null);
      setForm(nextSelected ? formFromMemory(nextSelected) : emptyForm());
    } catch (err) {
      setMemories([]);
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
        const next = await fetchAdminMemories({
          token: adminToken,
          status: statusFilter,
          scope: scopeFilter,
          type: typeFilter,
          userId: userFilter.trim() || undefined,
          query: query.trim() || undefined,
          limit: 120,
        });
        if (cancelled) return;
        setMemories(next);
        setKnownTypes((current) => mergeTypes(current, next));
        const nextSelected = next[0] ?? null;
        setSelectedId(nextSelected?.id ?? null);
        setForm(nextSelected ? formFromMemory(nextSelected) : emptyForm());
      } catch (err) {
        if (!cancelled) {
          setMemories([]);
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
  }, [adminToken, statusFilter, scopeFilter, typeFilter, userFilter, query]);

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
    setActionMessage(null);
  }

  async function submitForm() {
    if (!adminToken) return;
    setSaving(true);
    setActionError(null);
    setActionMessage(null);

    try {
      if (!form.type.trim()) throw new Error("Type 不能为空");
      if (!form.content.trim()) throw new Error("Content 不能为空");
      if (requiresUser(form.scope) && !form.userId.trim()) {
        throw new Error("用户记忆需要填写 User ID");
      }

      const input = {
        token: adminToken,
        memoryId: form.memoryId ?? undefined,
        userId: requiresUser(form.scope) ? form.userId.trim() : null,
        type: form.type.trim(),
        scope: form.scope,
        content: form.content.trim(),
        summary: form.summary.trim() || null,
        importance: numberValue(form.importance, 5),
        confidence: numberValue(form.confidence, 0.8),
        status: form.status,
        source: form.source.trim() || null,
        tags: parseCsv(form.tagsText),
        entities: parseCsv(form.entitiesText),
        channel: form.channel.trim() || null,
        conversationId: form.conversationId.trim() || null,
        metadata: parseOptionalJson(form.metadataText),
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
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Memory Library</div>
        <h3 className="mt-3 text-3xl font-semibold text-[#172033]">记忆库</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。这里会读取和管理已写入 `memories` 表的长期记忆。
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-[0_18px_48px_rgba(91,117,150,0.1)]">
        <div className="grid gap-3 xl:grid-cols-[1fr_0.8fr_0.8fr_0.9fr_1.1fr_auto_auto]">
          <FilterSelect
            label="状态"
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as MemoryStatusFilter)}
            options={statusOptions}
          />
          <FilterSelect
            label="范围"
            value={scopeFilter}
            onChange={(value) => setScopeFilter(value as MemoryScopeFilter)}
            options={scopeOptions}
          />
          <FilterSelect
            label="类型"
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions.map((value) => ({
              value,
              label: value === "all" ? "全部类型" : value,
            }))}
          />
          <FilterInput
            label="User ID"
            value={userFilter}
            placeholder="externalId / id"
            onChange={setUserFilter}
          />
          <FilterInput
            label="搜索"
            value={query}
            placeholder="content / summary / source"
            onChange={setQuery}
          />
          <button
            type="button"
            onClick={() => void loadMemories()}
            disabled={loading}
            className="h-11 self-end rounded-lg border border-[#c9d7e6] bg-[#f8fbff] px-4 text-sm font-medium text-[#334155] transition hover:bg-[#eef5fb] disabled:opacity-60"
          >
            {loading ? "读取中" : "刷新"}
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="h-11 self-end rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7]"
          >
            新增记忆
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {error}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#66758a]">
          <StatusPill active={!loading} label={loading ? "读取中" : "已读取"} />
          <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1">
            当前 {memories.length} 条
          </span>
          {Object.entries(summary).map(([status, count]) => (
            <span
              key={status}
              className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1"
            >
              {status}: {count}
            </span>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
          <div className="mb-3">
            <h3 className="text-base font-semibold text-[#172033]">记忆列表</h3>
            <p className="mt-1 text-xs leading-5 text-[#7b8ca2]">
              全局记忆会跨用户生效；用户记忆只在对应 userId 下参与检索。
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
          saving={saving}
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
      className={`rounded-lg border px-4 py-3 text-left transition ${
        selected
          ? "border-[#a9bfd7] bg-[#eaf2fb] shadow-sm"
          : "border-[#d9e2ec] bg-white hover:border-[#c9d7e6] hover:bg-[#fdfefe]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#172033]">{memory.type}</span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[#66758a]">
              {memory.scope}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[#66758a]">
              {ownerLabel(memory)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#334155]" title={memory.content}>
            {memory.summary || memory.content}
          </p>
        </div>
        <StatusPill active={memory.status === "active"} label={memory.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#7b8ca2]">
        <span>重要度 {memory.importance}</span>
        <span>·</span>
        <span>置信度 {Math.round(memory.confidence * 100)}%</span>
        <span>·</span>
        <span>{formatDate(memory.updatedAt)}</span>
      </div>
    </button>
  );
}

function MemoryEditor({
  form,
  selectedMemory,
  saving,
  actionError,
  actionMessage,
  typeOptions,
  onFormChange,
  onSubmit,
  onArchive,
}: {
  form: MemoryFormState;
  selectedMemory: AdminMemory | null;
  saving: boolean;
  actionError: string | null;
  actionMessage: string | null;
  typeOptions: string[];
  onFormChange: (form: MemoryFormState) => void;
  onSubmit: () => void;
  onArchive: () => void;
}) {
  const userRequired = requiresUser(form.scope);
  const editableTypeOptions = useMemo(() => {
    return Array.from(new Set([...typeOptions, form.type].filter(Boolean))).sort();
  }, [form.type, typeOptions]);

  function update<K extends keyof MemoryFormState>(key: K, value: MemoryFormState[K]) {
    onFormChange({ ...form, [key]: value });
  }

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.1)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">
            {form.mode === "create" ? "New Memory" : "Memory Detail"}
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">
            {form.mode === "create" ? "新增记忆" : selectedMemory?.type ?? "记忆详情"}
          </h3>
          {selectedMemory && (
            <p className="mt-2 text-xs text-[#7b8ca2]" title={selectedMemory.id}>
              {shortId(selectedMemory.id)} · {ownerLabel(selectedMemory)}
            </p>
          )}
        </div>
        <StatusPill active={form.status === "active"} label={form.status} />
      </div>

      {selectedMemory && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <DetailRow label="Created" value={formatDate(selectedMemory.createdAt)} title={selectedMemory.createdAt} />
          <DetailRow label="Updated" value={formatDate(selectedMemory.updatedAt)} title={selectedMemory.updatedAt} />
          <DetailRow label="Access" value={`${selectedMemory.accessCount} 次`} />
        </div>
      )}

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Field label="Type">
          <select
            value={form.type}
            onChange={(event) => update("type", event.target.value)}
            className="field-input"
          >
            {editableTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scope">
          <select
            value={form.scope}
            onChange={(event) => {
              const scope = event.target.value;
              onFormChange({
                ...form,
                scope,
                userId: requiresUser(scope) ? form.userId : "",
              });
            }}
            className="field-input"
          >
            {editableScopes.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
        </Field>
        <Field label={userRequired ? "User ID" : "User ID（全局记忆不需要）"}>
          <input
            value={form.userId}
            onChange={(event) => update("userId", event.target.value)}
            disabled={!userRequired}
            className="field-input disabled:opacity-50"
            placeholder="externalId / id"
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(event) => update("status", event.target.value)}
            className="field-input"
          >
            {editableStatuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Importance">
          <input
            type="number"
            min={1}
            max={10}
            value={form.importance}
            onChange={(event) => update("importance", event.target.value)}
            className="field-input"
          />
        </Field>
        <Field label="Confidence">
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={form.confidence}
            onChange={(event) => update("confidence", event.target.value)}
            className="field-input"
          />
        </Field>
      </div>

      <Field label="Content" className="mt-4">
        <textarea
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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Tags（逗号分隔）">
          <input
            value={form.tagsText}
            onChange={(event) => update("tagsText", event.target.value)}
            className="field-input"
            placeholder="admin, ui, preference"
          />
        </Field>
        <Field label="Entities（逗号分隔）">
          <input
            value={form.entitiesText}
            onChange={(event) => update("entitiesText", event.target.value)}
            className="field-input"
            placeholder="Admin 平台"
          />
        </Field>
        <Field label="Source">
          <input
            value={form.source}
            onChange={(event) => update("source", event.target.value)}
            className="field-input"
            placeholder="admin_manual / reflection"
          />
        </Field>
        <Field label="Channel">
          <input
            value={form.channel}
            onChange={(event) => update("channel", event.target.value)}
            className="field-input"
            placeholder="telegram / web"
          />
        </Field>
      </div>

      <Field label="Conversation ID" className="mt-4">
        <input
          value={form.conversationId}
          onChange={(event) => update("conversationId", event.target.value)}
          className="field-input"
          placeholder="可选"
        />
      </Field>

      <Field label="Metadata JSON" className="mt-4">
        <textarea
          value={form.metadataText}
          onChange={(event) => update("metadataText", event.target.value)}
          rows={4}
          className="field-input resize-y font-mono text-xs leading-5"
          placeholder='{"source":"manual"}'
        />
      </Field>

      {actionError && (
        <div className="mt-4 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
          {actionError}
        </div>
      )}

      {actionMessage && (
        <div className="mt-4 rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm text-[#3f7b5d]">
          {actionMessage}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving}
          className="h-10 rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7] disabled:opacity-50"
        >
          {saving ? "保存中" : form.mode === "create" ? "保存新增" : "保存修改"}
        </button>
        {selectedMemory && selectedMemory.status !== "archived" && (
          <button
            type="button"
            onClick={onArchive}
            disabled={saving}
            className="h-10 rounded-lg border border-[#d8d3cb] bg-[#f7f4ef] px-4 text-sm font-medium text-[#6f6257] transition hover:bg-[#eee9e1] disabled:opacity-50"
          >
            归档记忆
          </button>
        )}
      </div>

      {selectedMemory && (
        <div className="mt-5">
          <JsonBlock title="Raw Metadata" value={selectedMemory.metadata} />
        </div>
      )}
    </div>
  );
}

function QueuePlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-white px-4 py-8 text-center text-sm text-[#66758a]">
      {text}
    </div>
  );
}

function FilterInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[#7b8ca2]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 text-sm text-[#172033] outline-none placeholder:text-[#9aa8b8] focus:border-[#a9bfd7]"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[#7b8ca2]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 text-sm text-[#172033] outline-none focus:border-[#a9bfd7]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
      <span className="text-[11px] font-medium text-[#7b8ca2]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DetailRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-2">
      <div className="text-[11px] text-[#7b8ca2]">{label}</div>
      <div className="mt-1 truncate text-sm text-[#334155]" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  const text = JSON.stringify(value, null, 2);
  return (
    <section className="rounded-lg border border-[#d9e2ec] bg-white p-4">
      <h4 className="text-sm font-semibold text-[#172033]">{title}</h4>
      <pre
        title={text}
        className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f8fbff] p-3 text-xs leading-5 text-[#334155]"
      >
        {text}
      </pre>
    </section>
  );
}
