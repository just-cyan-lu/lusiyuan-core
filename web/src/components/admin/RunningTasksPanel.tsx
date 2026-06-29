import { Button } from "animal-island-ui";
import type { RunningTask } from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

function formatDate(value: string | null | undefined): string {
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

function formatDuration(ms: number | null | undefined): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "刚刚";
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function shortId(value: string | null | undefined): string {
  if (!value) return "无";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function QueuePlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--ls-border)] bg-white px-4 py-6 text-center text-sm text-[var(--ls-ink-soft)]">
      {text}
    </div>
  );
}

export function RunningTasksPanel({
  tasks,
  loading,
  stoppingTaskId,
  onRefresh,
  onStop,
}: {
  tasks: RunningTask[];
  loading: boolean;
  stoppingTaskId: string | null;
  onRefresh: () => void;
  onStop: (taskId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Running Tasks</div>
          <h3 className="mt-2 text-xl font-semibold text-[var(--ls-ink-strong)]">运行中任务</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ls-ink-soft)]">
            展示当前正在生成回复或运行 Dream 的任务。停止后，任务会在最近的可中断点退出。
          </p>
        </div>
        <Button type="default" loading={loading} onClick={onRefresh}>
          刷新任务
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {tasks.length === 0 ? (
          <QueuePlaceholder text={loading ? "正在读取运行中任务..." : "当前没有运行中任务。"} />
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-lg border border-[var(--ls-border)] bg-white px-4 py-3"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill active={task.status === "running"} label={task.status} />
                    <span className="text-sm font-semibold text-[var(--ls-ink-strong)]">
                      {task.label}
                    </span>
                    <span className="text-xs text-[var(--ls-ink-soft)]">
                      {task.kind} · {task.source ?? "unknown"} · {formatDuration(task.ageMs)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ls-ink-soft)]">
                    <span title={task.id}>Task {shortId(task.id)}</span>
                    <span>Channel {task.channel ?? "无"}</span>
                    <span title={task.userId ?? undefined}>User {shortId(task.userId)}</span>
                    <span title={task.conversationId ?? undefined}>
                      Conversation {shortId(task.conversationId)}
                    </span>
                    <span>Started {formatDate(task.startedAt)}</span>
                  </div>
                  {task.cancelReason && (
                    <div className="mt-2 text-xs text-[var(--ls-warning-text)]">
                      停止原因：{task.cancelReason}
                    </div>
                  )}
                </div>
                <Button
                  type="default"
                  loading={stoppingTaskId === task.id}
                  disabled={task.status === "cancelling"}
                  onClick={() => onStop(task.id)}
                >
                  {task.status === "cancelling" ? "停止中" : "停止"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
