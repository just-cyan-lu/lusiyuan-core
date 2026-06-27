import type { RuntimeEvent, RuntimeStateEvent } from "../../api/lusiyuan-api";
import {
  DetailInfoLine,
  RawJsonDetails,
} from "./AdminDetailPrimitives";
import {
  formatAdminDate,
  isRecord,
  readableValue,
  textListFromJson,
} from "./admin-detail-utils";

interface RuntimeEventDetailProps {
  event: RuntimeEvent | null;
  stateEvents: RuntimeStateEvent[];
  runtimeEventTypeLabel: (eventType: string) => string;
  stateEventTypeLabel: (eventType: string) => string;
}

interface RelatedStateEvent {
  event: RuntimeStateEvent;
  reason: string;
}

const mutationGateLabels: Record<string, string> = {
  ordinary_chat_observe_only: "普通聊天只观察",
  owner_chat_allowed: "Owner 对话允许校准",
  reflection_allowed: "整理允许校准",
  dream_allowed: "梦境允许校准",
  dream_observe_only: "梦境记录，不校准",
  autonomy_allowed: "自启动允许校准",
};

const deltaLabels: Record<string, string> = {
  moodScore: "心情",
  energyLevel: "精力",
};

export function RuntimeEventDetail({
  event,
  stateEvents,
  runtimeEventTypeLabel,
  stateEventTypeLabel,
}: RuntimeEventDetailProps) {
  if (!event) {
    return (
      <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
        选择一条运行事件后查看详情。
      </div>
    );
  }

  const stateImpact = recordFrom(event.stateImpact);
  const payload = recordFrom(event.payload);
  const relatedStateEvents = findRelatedStateEvents(event, stateEvents);
  const canMutate = stateImpact.canMutateRuntimeState === true;
  const mutationGate =
    typeof stateImpact.mutationGate === "string" ? stateImpact.mutationGate : null;

  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">事件解释</div>
          <h4 className="mt-1 text-lg font-semibold text-[var(--ls-ink-strong)]">
            {runtimeEventTypeLabel(event.eventType)}
          </h4>
          <p className="mt-2 text-sm leading-7 text-[var(--ls-ink-strong)]">{event.summary}</p>
        </div>
        <div className="rounded-full border border-[var(--ls-border-cold)] bg-white px-3 py-1 text-xs text-[var(--ls-ink-soft)]">
          {formatAdminDate(event.createdAt)}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        <DetailInfoLine label="来源" value={event.source} />
        <DetailInfoLine label="状态" value={event.status} />
        <DetailInfoLine label="渠道" value={event.channel ?? "暂无"} />
        <DetailInfoLine label="主题" value={event.topic ?? "暂无主题"} />
      </div>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">事件信号</div>
        <div className="mt-3 grid gap-3 md:grid-cols-[8rem_1fr]">
          <div className="rounded-lg border border-[var(--ls-border)] bg-white px-3 py-3">
            <div className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">重要度</div>
            <div className="mt-1 text-lg font-semibold text-[var(--ls-ink-strong)]">{event.importance}</div>
            <div className="mt-2 h-2 rounded-full bg-[var(--ls-panel-cold-deep)]">
              <div
                className="h-2 rounded-full bg-[var(--ls-link-soft)]"
                style={{ width: `${Math.min(Math.max(event.importance, 0), 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg border border-[var(--ls-border)] bg-white px-3 py-3">
            <div className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">观察到的状态信号</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <SignalPill label="心情" value={event.moodSignal} />
              <SignalPill label="精力" value={event.energySignal} />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">能不能影响长期状态</div>
        <div className="mt-3 rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                canMutate ? "bg-[var(--ls-success-bg)] text-[var(--ls-success-text)]" : "bg-[var(--ls-warning-bg)] text-[var(--ls-warning-text)]"
              }`}
            >
              {canMutate ? "有资格进入校准" : "只作为事件材料"}
            </span>
            <span className="rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-1 text-xs text-[var(--ls-ink-soft)]">
              {mutationGate ? mutationGateLabels[mutationGate] ?? mutationGate : "暂无入口规则"}
            </span>
          </div>
          <p className="mt-3 text-sm leading-7 text-[var(--ls-ink-strong)]">
            {stateImpactText(event, stateImpact, relatedStateEvents)}
          </p>
        </div>
      </section>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">候选影响</div>
        <div className="mt-3 grid gap-2">
          {impactPreviewEntries(stateImpact).length > 0 ? (
            impactPreviewEntries(stateImpact).map((entry) => (
              <DetailInfoLine key={entry.label} label={entry.label} value={entry.value} />
            ))
          ) : (
            <div className="rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3 text-sm text-[var(--ls-ink-soft)]">
              暂无候选影响。
            </div>
          )}
        </div>
      </section>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">和状态变化的关系</div>
        {relatedStateEvents.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {relatedStateEvents.map(({ event: stateEvent, reason }) => (
              <div
                key={stateEvent.id}
                className="rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[var(--ls-ink-strong)]">
                      {stateEventTypeLabel(stateEvent.eventType)}
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--ls-ink-strong)]">
                      {stateEvent.summary}
                    </p>
                    <div className="mt-2 text-xs text-[var(--ls-ink-soft)]">{reason}</div>
                  </div>
                  <div className="text-xs text-[var(--ls-ink-soft)] md:text-right">
                    {formatAdminDate(stateEvent.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3 text-sm leading-6 text-[var(--ls-ink-soft)]">
            最近状态变更里没有找到对应写入。它可能只是普通事件材料，也可能是候选影响被程序拦下，或对应变化已经不在最近列表里。
          </div>
        )}
      </section>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">来源信息</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <DetailInfoLine label="用户" value={event.userId ?? "暂无"} />
          <DetailInfoLine label="会话" value={event.conversationId ?? "暂无"} />
          <DetailInfoLine label="消息" value={event.messageId ?? "暂无"} />
          <DetailInfoLine label="事件 ID" value={event.id} />
        </div>
      </section>

      <div className="mt-5 grid gap-3">
        <RawJsonDetails title="原始 stateImpact" value={event.stateImpact} />
        <RawJsonDetails title="原始 payload" value={event.payload} />
      </div>

      {isRecord(payload) && isRecord(payload.generatedPatch) ? (
        <div className="mt-5 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-panel-cold)] px-4 py-3 text-xs leading-6 text-[var(--ls-warning-text)]">
          这条事件里带有候选状态补丁；是否真的写入，要看右侧“和状态变化的关系”，不要把候选补丁当成最终状态。
        </div>
      ) : null}
    </div>
  );
}

function SignalPill({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="rounded-full border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-1 text-xs text-[var(--ls-ink-strong)]">
      {label}：{value ?? "暂无"}
    </span>
  );
}

function recordFrom(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function impactPreviewEntries(
  stateImpact: Record<string, unknown>
): Array<{ label: string; value: string }> {
  const entries: Array<{ label: string; value: string }> = [];

  if (isRecord(stateImpact.candidateDeltas)) {
    entries.push({
      label: "候选数值变化",
      value: Object.entries(stateImpact.candidateDeltas)
        .map(([key, value]) => `${deltaLabels[key] ?? key} ${formatSignedNumber(value)}`)
        .join(" / "),
    });
  }

  appendIfPresent(entries, "候选目标", stateImpact.candidateGoal);
  appendIfPresent(entries, "候选关注", stateImpact.candidateFocus);
  appendIfPresent(entries, "候选活动", stateImpact.candidateActivity);
  appendIfPresent(entries, "提案数量", stateImpact.proposalCount);
  appendIfPresent(entries, "风险数量", stateImpact.riskCount);
  appendIfPresent(entries, "梦境信号", stateImpact.signalCount);
  appendIfPresent(entries, "最近两小时聊天", stateImpact.recentChatCount);
  appendIfPresent(entries, "最近一天聊天", stateImpact.dayChatCount);
  appendIfPresent(entries, "距离上次聊天", formatHours(stateImpact.hoursSinceLastChat));
  appendIfPresent(entries, "说明", stateImpact.note);

  return entries.filter((entry) => entry.value !== "暂无");
}

function appendIfPresent(
  entries: Array<{ label: string; value: string }>,
  label: string,
  value: unknown
) {
  const text = readableValue(value);
  if (text !== "暂无") entries.push({ label, value: text });
}

function formatSignedNumber(value: unknown): string {
  if (typeof value !== "number") return readableValue(value);
  return value > 0 ? `+${value}` : String(value);
}

function formatHours(value: unknown): string | null {
  if (typeof value !== "number") return null;
  return `${Math.round(value)} 小时`;
}

function stateImpactText(
  event: RuntimeEvent,
  stateImpact: Record<string, unknown>,
  relatedStateEvents: RelatedStateEvent[]
): string {
  if (relatedStateEvents.length > 0) {
    return "这条事件已经能在最近状态变更里找到对应写入。下面的状态变化才是最终结果。";
  }
  if (stateImpact.canMutateRuntimeState === true) {
    return "这条事件有资格影响长期状态，但最近状态变更里还没有找到对应写入。可能是自动校准关闭、校验后没有变化，或对应变化不在当前最近列表中。";
  }
  if (event.eventType === "chat_turn") {
    return "普通聊天默认不会直接改全局运行态。它会先进入事件池，等待 Dream 或自启动整理。";
  }
  return "这条事件目前只作为运行材料保存，不代表长期状态已经改变。";
}

function findRelatedStateEvents(
  event: RuntimeEvent,
  stateEvents: RuntimeStateEvent[]
): RelatedStateEvent[] {
  const related = stateEvents
    .map((stateEvent) => ({
      event: stateEvent,
      reason: relationReason(event, stateEvent),
    }))
    .filter((item): item is RelatedStateEvent => Boolean(item.reason));

  return related.slice(0, 3);
}

function relationReason(event: RuntimeEvent, stateEvent: RuntimeStateEvent): string | null {
  const sourceRuntimeEventIds = textListFromJson(stateEvent.sourceRuntimeEventIds);
  const sourceMessageIds = textListFromJson(stateEvent.sourceMessageIds);

  if (sourceRuntimeEventIds.includes(event.id)) {
    return "明确记录为这次状态变化的来源事件。";
  }

  if (event.messageId && sourceMessageIds.includes(event.messageId)) {
    return "这条事件的消息被明确记录为状态变化来源。";
  }

  return null;
}
