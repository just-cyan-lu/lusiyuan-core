import type {
  RuntimeSourceMessage,
  RuntimeStateEventSourcesResponse,
} from "../../api/lusiyuan-api";
import {
  formatAdminDate,
  shortAdminId,
} from "./admin-detail-utils";

interface RuntimeStateSourceMaterialsProps {
  detail: RuntimeStateEventSourcesResponse | null;
  loading: boolean;
  error: string | null;
}

export function RuntimeStateSourceMaterials({
  detail,
  loading,
  error,
}: RuntimeStateSourceMaterialsProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
        正在读取来源材料...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-4 text-sm leading-6 text-[var(--ls-warning-text)]">
        {error}
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-6 text-sm text-[var(--ls-ink-soft)]">
        暂无来源材料。
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">来源材料</div>
          <h4 className="mt-1 text-lg font-semibold text-[var(--ls-ink-strong)]">这次变化参考了什么</h4>
        </div>
        <div className="rounded-full border border-[var(--ls-border-cold)] bg-white px-3 py-1 text-xs text-[var(--ls-ink-soft)]">
          {detail.messages.length} 条消息
        </div>
      </div>

      <MissingSources
        messageIds={detail.missingMessageIds}
      />

      <section className="mt-5">
        <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">消息来源</div>
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

function MessageSourceCard({ message }: { message: RuntimeSourceMessage }) {
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
            <span>会话 {shortAdminId(message.conversation.externalConversationId)}</span>
            <span>消息 {shortAdminId(message.id)}</span>
            {message.externalMessageId ? (
              <span>外部 {shortAdminId(message.externalMessageId)}</span>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-[var(--ls-ink-soft)] md:text-right">
          {formatAdminDate(message.createdAt)}
        </div>
      </div>
      <div className="mt-3 max-h-44 overflow-auto rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-3 py-2 text-sm leading-7 text-[var(--ls-ink-strong)]">
        {message.content}
      </div>
      {message.isIntermediate ? (
        <div className="mt-2 text-xs text-[var(--ls-warning-text)]">中间消息</div>
      ) : null}
    </div>
  );
}

function MissingSources({
  messageIds,
}: {
  messageIds: string[];
}) {
  if (messageIds.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--ls-warning-border)] bg-[var(--ls-panel-cold)] px-4 py-3 text-xs leading-6 text-[var(--ls-warning-text)]">
      {messageIds.length > 0 ? (
        <div>缺失消息：{messageIds.map(shortAdminId).join(" / ")}</div>
      ) : null}
    </div>
  );
}

function EmptySource({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3 text-sm text-[var(--ls-ink-soft)]">
      {text}
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
