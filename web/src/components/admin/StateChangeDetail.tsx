import type { ReactNode } from "react";

export interface StateChangeEventLike {
  id: string;
  eventType: string;
  source: string | null;
  summary: string;
  patch: unknown;
  before: unknown;
  after: unknown;
  userId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  channel?: string | null;
  createdAt: string;
}

interface StateChangeDetailProps {
  event: StateChangeEventLike | null;
  eventTypeLabel: (eventType: string) => string;
  fieldLabels: Record<string, string>;
  title?: string;
}

interface FieldChange {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
}

const ignoredSnapshotFields = new Set([
  "id",
  "key",
  "runtimeStateId",
  "relationshipStateId",
  "personId",
  "createdAt",
  "updatedAt",
]);

export function StateChangeDetail({
  event,
  eventTypeLabel,
  fieldLabels,
  title = "变更详情",
}: StateChangeDetailProps) {
  if (!event) {
    return (
      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
        选择一条状态变更后查看详情。
      </div>
    );
  }

  const changes = snapshotChanges(event.before, event.after, fieldLabels);
  const patchEntries = patchPreviewEntries(event.patch, fieldLabels);

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#7b8ca2]">{title}</div>
          <h4 className="mt-1 text-lg font-semibold text-[#172033]">
            {eventTypeLabel(event.eventType)}
          </h4>
          <p className="mt-2 text-sm leading-7 text-[#334155]">{event.summary}</p>
        </div>
        <div className="rounded-full border border-[#c9d6e5] bg-white px-3 py-1 text-xs text-[#66758a]">
          {formatDate(event.createdAt)}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <InfoLine label="来源" value={event.source ?? "unknown"} />
        <InfoLine label="渠道" value={event.channel ?? "暂无"} />
        <InfoLine label="用户" value={event.userId ?? "暂无"} />
        <InfoLine label="会话" value={event.conversationId ?? "暂无"} />
      </div>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[#7b8ca2]">实际改动</div>
        {changes.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-[#d9e2ec] bg-white">
            {changes.map((change) => (
              <div
                key={change.key}
                className="grid gap-2 border-b border-[#edf2f7] px-4 py-3 last:border-b-0 md:grid-cols-[8rem_1fr_1fr]"
              >
                <div className="text-xs font-semibold text-[#7b8ca2]">{change.label}</div>
                <ValueBox label="变化前" value={change.before} />
                <ValueBox label="变化后" value={change.after} strong />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm leading-6 text-[#66758a]">
            这条记录没有改动核心状态字段。它更像一次信号、观察或失败记录，会作为以后复盘的材料。
          </div>
        )}
      </section>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[#7b8ca2]">程序准备写入的内容</div>
        {patchEntries.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {patchEntries.map((entry) => (
              <InfoLine key={entry.key} label={entry.label} value={entry.value} />
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm text-[#7b8ca2]">
            暂无可读的写入内容。
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-3">
        <RawDetails title="原始 patch" value={event.patch} />
        <RawDetails title="变化前快照" value={event.before} />
        <RawDetails title="变化后快照" value={event.after} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <InfoLine label="事件 ID" value={event.id} />
        <InfoLine label="消息 ID" value={event.messageId ?? "暂无"} />
      </div>
    </div>
  );
}

function snapshotChanges(
  before: unknown,
  after: unknown,
  fieldLabels: Record<string, string>
): FieldChange[] {
  if (!isRecord(before) || !isRecord(after)) return [];

  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return Array.from(keys)
    .filter((key) => !ignoredSnapshotFields.has(key))
    .filter((key) => stableStringify(before[key]) !== stableStringify(after[key]))
    .map((key) => ({
      key,
      label: fieldLabels[key] ?? key,
      before: before[key],
      after: after[key],
    }));
}

function patchPreviewEntries(
  patch: unknown,
  fieldLabels: Record<string, string>
): Array<{ key: string; label: string; value: string }> {
  if (!isRecord(patch)) return [];
  return Object.entries(patch).map(([key, value]) => ({
    key,
    label: fieldLabels[key] ?? patchFieldLabel(key),
    value: readableValue(value),
  }));
}

function patchFieldLabel(key: string): string {
  const labels: Record<string, string> = {
    deltas: "变化量",
    counts: "统计",
    signal: "信号",
    proposedPatch: "LLM 提议",
    lastRelationshipReview: "最近关系复盘",
    stateImpact: "状态影响",
    metadataPatch: "内在详情补丁",
    reason: "原因",
  };
  return labels[key] ?? key;
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-[#7b8ca2]">{label}</div>
      <div className="mt-1 break-words text-sm leading-6 text-[#334155]">{value}</div>
    </div>
  );
}

function ValueBox({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: unknown;
  strong?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-[#9aa8b8]">{label}</div>
      <div className={`mt-1 break-words text-sm leading-6 ${strong ? "text-[#172033]" : "text-[#66758a]"}`}>
        {readableValue(value)}
      </div>
    </div>
  );
}

function RawDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-lg border border-[#d9e2ec] bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#334155]">
        {title}
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-[#edf2f7] px-4 py-3 text-xs leading-5 text-[#334155]">
        {jsonText(value)}
      </pre>
    </details>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "暂无";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return jsonText(value);
}

function jsonText(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "暂无";
  } catch {
    return String(value);
  }
}

function stableStringify(value: unknown): string {
  if (!isRecord(value)) return JSON.stringify(value);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = value[key];
  }
  return JSON.stringify(sorted);
}

function formatDate(value: string | null): string {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
