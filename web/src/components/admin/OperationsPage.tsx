import { useEffect, useState } from "react";
import {
  cancelRunningTask,
  fetchRunningTasks,
  type RunningTask,
} from "../../api/lusiyuan-api";
import { RunningTasksPanel } from "./RunningTasksPanel";

interface OperationsPageProps {
  adminToken: string;
}

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新运维台。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "操作失败";
}

export function OperationsPage({ adminToken }: OperationsPageProps) {
  const [runningTasks, setRunningTasks] = useState<RunningTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [stoppingTaskId, setStoppingTaskId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function loadRunningTasks() {
    if (!adminToken) return;
    setLoading(true);
    setActionError(null);
    try {
      const data = await fetchRunningTasks(adminToken);
      setRunningTasks(data.tasks);
    } catch (error) {
      setRunningTasks([]);
      setActionError(friendlyErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function stopRunningTask(taskId: string) {
    if (!adminToken) return;
    setStoppingTaskId(taskId);
    setActionError(null);
    setActionMessage(null);
    try {
      await cancelRunningTask({ token: adminToken, taskId });
      setActionMessage("已请求停止运行中任务，任务会在当前可中断点退出。");
      await loadRunningTasks();
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setStoppingTaskId(null);
    }
  }

  useEffect(() => {
    void loadRunningTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[var(--ls-border)] bg-white p-7 shadow-[var(--ls-shadow)]">
        <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">
          Operations
        </div>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--ls-ink-strong)]">
          运维台
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--ls-ink-soft)]">
          请先在顶部输入 Admin Token。这里会展示当前正在运行的后台任务，并提供手动停止入口。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-5 shadow-[var(--ls-shadow)] md:p-6">
        <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">
          Operations
        </div>
        <h2 className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">
          运维台
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ls-ink-soft)]">
          先放运行中任务控制：WebChat、Telegram、微信和 Dream 都会出现在这里，方便你手动停止。
        </p>

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
      </section>

      <RunningTasksPanel
        tasks={runningTasks}
        loading={loading}
        stoppingTaskId={stoppingTaskId}
        onRefresh={() => void loadRunningTasks()}
        onStop={(taskId) => void stopRunningTask(taskId)}
      />
    </div>
  );
}
