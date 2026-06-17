import type {
  RuntimeEvent,
  RuntimeSourceMessage,
  RuntimeStateEventSourcesResponse,
} from "../../api/lusiyuan-api";
import { RawJsonDetails } from "./AdminDetailPrimitives";
import {
  formatAdminDate,
  shortAdminId,
} from "./admin-detail-utils";

interface RuntimeStateSourceMaterialsProps {
  detail: RuntimeStateEventSourcesResponse | null;
  loading: boolean;
  error: string | null;
  runtimeEventTypeLabel: (eventType: string) => string;
}

export function RuntimeStateSourceMaterials({
  detail,
  loading,
  error,
  runtimeEventTypeLabel,
}: RuntimeStateSourceMaterialsProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
        正在读取来源材料...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-4 text-sm leading-6 text-[#8d6048]">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
        暂无来源材料。
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#7b8ca2]">来源材料</div>
          <h4 className="mt-1 text-lg font-semibold text-[#172033]">这次变化参考了什么</h4>
        </div>
        <div className="rounded-full border border-[#c9d6e5] bg-white px-3 py-1 text-xs text-[#66758a]">
          {detail.runtimeEvents.length} 个事件 / {detail.messages.length} 条消息
        </div>
      </div>

      <MissingSources
        runtimeEventIds={detail.missingRuntimeEventIds}
        messageIds={detail.missingMessageIds}
      />

      <section className="mt-5">
        <div className="text-xs font-semibold text-[#7b8ca2]">运行事件来源</div>
        <div className="mt-3 grid gap-3">
          {detail.runtimeEvents.length > 0 ? (
            detail.runtimeEvents.map((event) => (
              <RuntimeEventSourceCard
                key={event.id}
                event={event}
                runtimeEventTypeLabel={runtimeEventTypeLabel}
              />
            ))
          ) : (
            <EmptySource text="这次状态变化没有记录运行事件来源。" />
          )}
        </div>
      </section>

      <section className="mt-5">
        <div className="text-xs font-semibold text-[#7b8ca2]">消息来源</div>
        <div className="mt-3 grid gap-3">
          {detail.messages.length > 0 ? (
            detail.messages.map((message) => (
              <MessageSourceCard key={message.id} message={message} />
            ))
          ) : (
            <EmptySource text="这次状态变化没有记录消息来源。" />
          )}
        </div>
      </section>
    </div>
  );
}

function RuntimeEventSourceCard({
  event,
  runtimeEventTypeLabel,
}: {
  event: RuntimeEvent;
  runtimeEventTypeLabel: (eventType: string) => string;
}) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#172033]">
            {runtimeEventTypeLabel(event.eventType)}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#7b8ca2]">
            <span>{event.source}</span>
            <span>{event.status}</span>
            <span>重要度 {event.importance}</span>
            <span>ID {shortAdminId(event.id)}</span>
          </div>
        </div>
        <div className="text-xs text-[#7b8ca2] md:text-right">
          {formatAdminDate(event.createdAt)}
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-[#334155]">{event.summary}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <SourceSignal label="心情" value={event.moodSignal} />
        <SourceSignal label="精力" value={event.energySignal} />
        <SourceSignal label="压力" value={event.stressSignal} />
        <SourceSignal label="社交" value={event.socialSignal} />
      </div>
      <div className="mt-3 grid gap-2">
        <RawJsonDetails title="stateImpact" value={event.stateImpact} />
        <RawJsonDetails title="payload" value={event.payload} />
      </div>
    </div>
  );
}

function MessageSourceCard({ message }: { message: RuntimeSourceMessage }) {
  const user = message.conversation.user;
  const displayName = user.displayName || user.externalId;

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[#172033]">
            {roleLabel(message.role)} · {displayName}
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#7b8ca2]">
            <span>{message.conversation.channel}</span>
            <span>会话 {shortAdminId(message.conversation.externalConversationId)}</span>
            <span>消息 {shortAdminId(message.id)}</span>
            {message.externalMessageId ? (
              <span>外部 {shortAdminId(message.externalMessageId)}</span>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-[#7b8ca2] md:text-right">
          {formatAdminDate(message.createdAt)}
        </div>
      </div>
      <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-[#edf2f7] bg-[#f8fbff] px-3 py-2 text-sm leading-7 text-[#334155]">
        {message.content}
      </div>
      {message.isIntermediate ? (
        <div className="mt-2 text-xs text-[#8d6048]">中间消息</div>
      ) : null}
    </div>
  );
}

function MissingSources({
  runtimeEventIds,
  messageIds,
}: {
  runtimeEventIds: string[];
  messageIds: string[];
}) {
  if (runtimeEventIds.length === 0 && messageIds.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[#ead4c8] bg-[#fffaf7] px-4 py-3 text-xs leading-6 text-[#8d6048]">
      {runtimeEventIds.length > 0 ? (
        <div>缺失运行事件：{runtimeEventIds.map(shortAdminId).join(" / ")}</div>
      ) : null}
      {messageIds.length > 0 ? (
        <div>缺失消息：{messageIds.map(shortAdminId).join(" / ")}</div>
      ) : null}
    </div>
  );
}

function EmptySource({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm text-[#7b8ca2]">
      {text}
    </div>
  );
}

function SourceSignal({ label, value }: { label: string; value: string | null }) {
  return (
    <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-3 py-1 text-xs text-[#334155]">
      {label}：{value ?? "暂无"}
    </span>
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
