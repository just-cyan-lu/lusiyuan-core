import { useEffect, useMemo, useState } from "react";
import { Button } from "animal-island-ui";
import {
  applyMemoryProposalGlobally,
  applyMemoryProposal,
  approveMemoryProposal,
  fetchMemoryProposals,
  rejectMemoryProposal,
  revokeMemoryProposal,
  type MemoryProposal,
  type MemoryProposalStatus,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type ProposalStatusFilter = MemoryProposalStatus | "all";
type ProposalRiskFilter = "all" | "low" | "medium" | "high";
type ProposalAction =
  | "approve"
  | "approveApply"
  | "reject"
  | "apply"
  | "applyGlobal"
  | "revoke";
type ProposalBulkAction = "approvePending" | "applyApproved";

interface MemoryProposalsPageProps {
  adminToken: string;
  onOpenMemory?: (memoryId: string) => void;
}

const statusOptions: Array<{ value: ProposalStatusFilter; label: string }> = [
  { value: "pending", label: "待审核" },
  { value: "approved", label: "已批准" },
  { value: "applied", label: "已应用" },
  { value: "rejected", label: "已拒绝" },
  { value: "all", label: "全部" },
];

const statusLabels: Record<string, string> = {
  pending: "待审核",
  approved: "已批准",
  rejected: "已拒绝",
  applied: "已应用",
  ignored: "已忽略",
};

const proposalTypeLabels: Record<string, string> = {
  create_memory: "新增记忆",
  update_memory: "更新记忆",
  supersede_memory: "替换记忆",
  archive_memory: "归档记忆",
};

const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

const riskOptions: Array<{ value: ProposalRiskFilter; label: string }> = [
  { value: "all", label: "全部风险" },
  { value: "low", label: "低风险" },
  { value: "medium", label: "中风险" },
  { value: "high", label: "高风险" },
];

const proposalTypeOptions = [
  "all",
  "create_memory",
  "update_memory",
  "supersede_memory",
  "archive_memory",
];

const scopeOptions = ["all", "user", "global", "project"];

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新提案队列。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
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

function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function shortId(value: string | null): string {
  if (!value) return "无";
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

function fullValue(value: string | null): string {
  return value ?? "无";
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

function isEnabledForAction(proposal: MemoryProposal | null, action: ProposalAction): boolean {
  if (!proposal) return false;
  if (action === "approve") return proposal.status === "pending";
  if (action === "approveApply") return proposal.status === "pending";
  if (action === "reject") return proposal.status === "pending" || proposal.status === "approved";
  if (action === "apply" || action === "applyGlobal") return proposal.status === "approved";
  return proposal.status === "approved" || proposal.status === "applied";
}

export function MemoryProposalsPage({ adminToken, onOpenMemory }: MemoryProposalsPageProps) {
  const [statusFilter, setStatusFilter] = useState<ProposalStatusFilter>("pending");
  const [riskFilter, setRiskFilter] = useState<ProposalRiskFilter>("all");
  const [proposalTypeFilter, setProposalTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [proposals, setProposals] = useState<MemoryProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<ProposalAction | null>(null);
  const [busyBulkAction, setBusyBulkAction] = useState<ProposalBulkAction | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === selectedId) ?? proposals[0] ?? null,
    [proposals, selectedId]
  );

  async function loadProposals() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    setActionMessage(null);
    setActionError(null);

    try {
      const next = await fetchMemoryProposals({
        token: adminToken,
        status: statusFilter,
        riskLevel: riskFilter,
        proposalType: proposalTypeFilter,
        scope: scopeFilter,
        query: query.trim() || undefined,
        limit: 80,
      });
      setProposals(next);
      setSelectedId((current) => next.find((proposal) => proposal.id === current)?.id ?? next[0]?.id ?? null);
    } catch (err) {
      setProposals([]);
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialProposals() {
      if (!adminToken) return;
      await Promise.resolve();
      if (cancelled) return;
      setLoading(true);
      try {
        const next = await fetchMemoryProposals({
          token: adminToken,
          status: statusFilter,
          riskLevel: riskFilter,
          proposalType: proposalTypeFilter,
          scope: scopeFilter,
          query: query.trim() || undefined,
          limit: 80,
        });
        if (!cancelled) {
          setProposals(next);
          setSelectedId(
            (current) => next.find((proposal) => proposal.id === current)?.id ?? next[0]?.id ?? null
          );
          setError(null);
          setActionMessage(null);
          setActionError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setProposals([]);
          setError(friendlyErrorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInitialProposals();
    return () => {
      cancelled = true;
    };
  }, [adminToken, proposalTypeFilter, query, riskFilter, scopeFilter, statusFilter]);

  const statusSummary = useMemo(() => {
    return proposals.reduce<Record<string, number>>((acc, proposal) => {
      acc[proposal.status] = (acc[proposal.status] ?? 0) + 1;
      return acc;
    }, {});
  }, [proposals]);

  async function runAction(action: ProposalAction) {
    if (!selectedProposal || !adminToken || !isEnabledForAction(selectedProposal, action)) return;

    setBusyAction(action);
    setActionError(null);
    setActionMessage(null);

    try {
      const updated = await runSingleProposalAction(action, selectedProposal.id);

      setProposals((current) =>
        current.map((proposal) => (proposal.id === updated.id ? updated : proposal))
      );
      setSelectedId(updated.id);
      setActionMessage(actionMessageFor(action));
      if (action === "reject") setRejectReason("");
    } catch (err) {
      setActionError(friendlyErrorMessage(err));
    } finally {
      setBusyAction(null);
    }
  }

  async function runSingleProposalAction(
    action: ProposalAction,
    proposalId: string
  ): Promise<MemoryProposal> {
    if (action === "approve") {
      return approveMemoryProposal({ token: adminToken, proposalId });
    }
    if (action === "approveApply") {
      const approved = await approveMemoryProposal({ token: adminToken, proposalId });
      return applyMemoryProposal({ token: adminToken, proposalId: approved.id });
    }
    if (action === "reject") {
      return rejectMemoryProposal({
        token: adminToken,
        proposalId,
        reason: rejectReason.trim() || undefined,
      });
    }
    if (action === "apply") {
      return applyMemoryProposal({ token: adminToken, proposalId });
    }
    if (action === "applyGlobal") {
      return applyMemoryProposalGlobally({ token: adminToken, proposalId });
    }
    return revokeMemoryProposal({ token: adminToken, proposalId });
  }

  async function runBulkAction(action: ProposalBulkAction) {
    if (!adminToken || busyBulkAction) return;
    const targets = proposals.filter((proposal) =>
      action === "approvePending" ? proposal.status === "pending" : proposal.status === "approved"
    );
    if (targets.length === 0) {
      setActionError(action === "approvePending" ? "当前筛选下没有待批准提案。" : "当前筛选下没有已批准提案。");
      return;
    }

    const confirmed = window.confirm(
      action === "approvePending"
        ? `确认批准当前筛选下 ${targets.length} 条待审核提案吗？批准不会直接写入记忆。`
        : `确认应用当前筛选下 ${targets.length} 条已批准提案到各自用户记忆吗？`
    );
    if (!confirmed) return;

    setBusyBulkAction(action);
    setActionError(null);
    setActionMessage(null);

    const updated: MemoryProposal[] = [];
    const failed: string[] = [];
    for (const proposal of targets) {
      try {
        const result =
          action === "approvePending"
            ? await approveMemoryProposal({ token: adminToken, proposalId: proposal.id })
            : await applyMemoryProposal({ token: adminToken, proposalId: proposal.id });
        updated.push(result);
      } catch (err) {
        failed.push(`${shortId(proposal.id)}: ${friendlyErrorMessage(err)}`);
      }
    }

    setProposals((current) =>
      current.map((proposal) => updated.find((item) => item.id === proposal.id) ?? proposal)
    );
    setActionMessage(
      action === "approvePending"
        ? `批量批准完成：成功 ${updated.length} 条，失败 ${failed.length} 条。`
        : `批量应用完成：成功 ${updated.length} 条，失败 ${failed.length} 条。`
    );
    setActionError(failed.length > 0 ? failed.slice(0, 3).join("\n") : null);
    setBusyBulkAction(null);
  }

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Memory Review</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">记忆提案审核</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          这里会读取 Reflection / Dream 生成的 MemoryProposal。请先在顶部输入 Admin Token，
          页面只会把 token 保存在浏览器本地。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Memory Review</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">记忆提案审核</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              逐条检查提案内容、理由、置信度和风险等级，再决定批准、拒绝或应用到长期记忆。长期测试时优先处理低风险、用户范围的提案。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="primary"
              loading={busyBulkAction === "approvePending"}
              disabled={loading || (busyBulkAction !== null && busyBulkAction !== "approvePending")}
              onClick={() => void runBulkAction("approvePending")}
            >
              批准当前待审
            </Button>
            <Button
              type="primary"
              loading={busyBulkAction === "applyApproved"}
              disabled={loading || (busyBulkAction !== null && busyBulkAction !== "applyApproved")}
              onClick={() => void runBulkAction("applyApproved")}
            >
              应用当前已批准
            </Button>
            <Button type="default" loading={loading} onClick={() => void loadProposals()}>
              刷新队列
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <label>
            <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">搜索</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="内容 / 理由 / ID / report"
              className="field-input h-10"
            />
          </label>
          <FilterSelect
            label="风险"
            value={riskFilter}
            onChange={(value) => setRiskFilter(value as ProposalRiskFilter)}
            options={riskOptions}
          />
          <FilterSelect
            label="提案类型"
            value={proposalTypeFilter}
            onChange={setProposalTypeFilter}
            options={proposalTypeOptions.map((value) => ({
              value,
              label: value === "all" ? "全部类型" : proposalTypeLabels[value] ?? value,
            }))}
          />
          <FilterSelect
            label="范围"
            value={scopeFilter}
            onChange={setScopeFilter}
            options={scopeOptions.map((value) => ({
              value,
              label: value === "all" ? "全部范围" : value,
            }))}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {statusOptions.map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`admin-pill-button rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active ? "is-active" : ""
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
          {error}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(22rem,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#172033]">提案队列</h3>
              <p className="mt-1 text-xs text-[#7b8ca2]">
                当前筛选 {proposals.length} 条
              </p>
            </div>
            <StatusPill active={proposals.length > 0} label={loading ? "读取中" : "已读取"} />
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(statusSummary).map(([status, count]) => (
              <span
                key={status}
                className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-xs text-[#66758a]"
              >
                {statusLabels[status] ?? status}: {count}
              </span>
            ))}
          </div>

          {loading && proposals.length === 0 ? (
            <QueuePlaceholder text="正在读取提案…" />
          ) : proposals.length === 0 ? (
            <QueuePlaceholder text="当前筛选下没有提案。" />
          ) : (
            <div className="grid max-h-[44rem] gap-2 overflow-y-auto pr-1">
              {proposals.map((proposal) => (
                <ProposalListItem
                  key={proposal.id}
                  proposal={proposal}
                  selected={proposal.id === selectedProposal?.id}
                  onSelect={() => {
                    setSelectedId(proposal.id);
                    setActionError(null);
                    setActionMessage(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <ProposalDetail
          proposal={selectedProposal}
          rejectReason={rejectReason}
          actionError={actionError}
          actionMessage={actionMessage}
          busyAction={busyAction}
          onOpenMemory={onOpenMemory}
          onRejectReasonChange={setRejectReason}
          onRunAction={runAction}
        />
      </section>
    </div>
  );
}

function actionMessageFor(action: ProposalAction): string {
  if (action === "approve") return "提案已批准，但还没有写入记忆。";
  if (action === "approveApply") return "提案已批准并应用到当前用户记忆。";
  if (action === "reject") return "提案已拒绝。";
  if (action === "apply") return "提案已应用到当前用户记忆。";
  if (action === "applyGlobal") return "提案已作为全局记忆应用。";
  return "提案已撤回。";
}

function QueuePlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-white px-4 py-8 text-center text-sm text-[#66758a]">
      {text}
    </div>
  );
}

function ProposalListItem({
  proposal,
  selected,
  onSelect,
}: {
  proposal: MemoryProposal;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`admin-layout-button block w-full rounded-lg border px-4 py-3 text-left transition ${
        selected ? "is-active" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#172033]">
              {proposalTypeLabels[proposal.proposalType] ?? proposal.proposalType}
            </span>
            <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-[#66758a]">
              {proposal.scope}/{proposal.type}
            </span>
          </div>
          <p
            className="mt-2 line-clamp-2 text-sm leading-6 text-[#334155]"
            title={proposal.summary || proposal.content}
          >
            {proposal.summary || proposal.content}
          </p>
        </div>
        <StatusPill active={proposal.status === "pending"} label={statusLabels[proposal.status] ?? proposal.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#7b8ca2]">
        <span>{formatConfidence(proposal.confidence)}</span>
        <span>·</span>
        <span>{riskLabels[proposal.riskLevel] ?? proposal.riskLevel}</span>
        <span>·</span>
        <span>{formatDate(proposal.createdAt)}</span>
      </div>
    </button>
  );
}

function ProposalDetail({
  proposal,
  rejectReason,
  actionError,
  actionMessage,
  busyAction,
  onOpenMemory,
  onRejectReasonChange,
  onRunAction,
}: {
  proposal: MemoryProposal | null;
  rejectReason: string;
  actionError: string | null;
  actionMessage: string | null;
  busyAction: ProposalAction | null;
  onOpenMemory?: (memoryId: string) => void;
  onRejectReasonChange: (value: string) => void;
  onRunAction: (action: ProposalAction) => Promise<void>;
}) {
  if (!proposal) {
    return (
      <div className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-[#172033]">提案详情</h3>
        <p className="mt-3 text-sm leading-7 text-[#66758a]">
          从左侧选择一条提案后，这里会显示完整内容和审核动作。
        </p>
      </div>
    );
  }

  const tags = toTextList(proposal.tags);
  const entities = toTextList(proposal.entities);
  const sourceMessageIds = toTextList(proposal.sourceMessageIds);

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.1)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">Proposal Detail</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">
            {proposalTypeLabels[proposal.proposalType] ?? proposal.proposalType}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill active={proposal.status === "pending"} label={statusLabels[proposal.status] ?? proposal.status} />
          <RiskPill risk={proposal.riskLevel} />
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Metric label="置信度" value={formatConfidence(proposal.confidence)} />
        <Metric label="类型" value={`${proposal.scope}/${proposal.type}`} />
        <Metric label="创建时间" value={formatDate(proposal.createdAt)} title={proposal.createdAt} />
      </div>

      <section className="mt-5 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
        <h4 className="text-sm font-semibold text-[#172033]">提案内容</h4>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#334155]">
          {proposal.content}
        </p>
      </section>

      {proposal.summary && (
        <section className="mt-4 rounded-lg border border-[#d9e2ec] bg-white p-4">
          <h4 className="text-sm font-semibold text-[#172033]">摘要</h4>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#617188]">
            {proposal.summary}
          </p>
        </section>
      )}

      <section className="mt-4 rounded-lg border border-[#d9e2ec] bg-white p-4">
        <h4 className="text-sm font-semibold text-[#172033]">生成理由</h4>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#617188]">
          {proposal.reason}
        </p>
      </section>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <DetailRow label="Proposal ID" value={shortId(proposal.id)} title={proposal.id} />
        <DetailRow label="Report ID" value={shortId(proposal.reportId)} title={proposal.reportId} />
        <DetailRow label="User ID" value={shortId(proposal.userId)} title={fullValue(proposal.userId)} />
        <DetailRow
          label="Conversation"
          value={shortId(proposal.conversationId)}
          title={fullValue(proposal.conversationId)}
        />
        <DetailRow label="Channel" value={proposal.channel ?? "无"} />
        <DetailRow
          label="Target Memory"
          value={shortId(proposal.targetMemoryId)}
          title={fullValue(proposal.targetMemoryId)}
        />
        <DetailRow
          label="Applied Memory"
          value={shortId(proposal.appliedMemoryId)}
          title={fullValue(proposal.appliedMemoryId)}
        />
        <DetailRow label="Reviewed By" value={proposal.reviewedBy ?? "未审核"} />
        <DetailRow label="Reviewed At" value={formatDate(proposal.reviewedAt)} title={fullValue(proposal.reviewedAt)} />
        <DetailRow label="Updated At" value={formatDate(proposal.updatedAt)} title={proposal.updatedAt} />
        <DetailRow label="Raw Status" value={proposal.status} />
        <DetailRow label="Raw Proposal Type" value={proposal.proposalType} />
      </div>

      <TagBlock title="Tags" items={tags} />
      <TagBlock title="Entities" items={entities} />
      <TagBlock
        title="Source Messages"
        items={sourceMessageIds.map(shortId)}
        itemTitles={sourceMessageIds}
      />

      <JsonBlock title="Metadata" value={proposal.metadata} />

      <div className="mt-5">
        <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm leading-6 text-[#617188]">
          <span className="font-semibold text-[#172033]">按钮说明：</span>
          仅批准只是通过审核，不写入记忆；应用到当前用户会让这条记忆只对当前用户生效；全局应用会写成陆思源基础记忆，对所有用户生效；撤回会撤销批准或让已应用记忆失效。
        </div>
      </div>

      <div className="mt-5">
        <label className="text-sm font-semibold text-[#172033]" htmlFor="reject-reason">
          拒绝原因
        </label>
        <textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(event) => onRejectReasonChange(event.target.value)}
          rows={3}
          placeholder="可选。拒绝时会写入 proposal metadata。"
          className="mt-2 w-full resize-none rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-2 text-sm leading-6 text-[#172033] outline-none placeholder:text-[#9aa8b8] focus:border-[#a9bfd7]"
        />
      </div>

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
        <ActionButton
          label="批准并应用"
          action="approveApply"
          proposal={proposal}
          busyAction={busyAction}
          onRunAction={onRunAction}
        />
        <ActionButton
          label="仅批准"
          action="approve"
          proposal={proposal}
          busyAction={busyAction}
          onRunAction={onRunAction}
        />
        <ActionButton
          label="拒绝"
          action="reject"
          proposal={proposal}
          busyAction={busyAction}
          onRunAction={onRunAction}
        />
        <ActionButton
          label="应用到当前用户"
          action="apply"
          proposal={proposal}
          busyAction={busyAction}
          onRunAction={onRunAction}
        />
        <ActionButton
          label="全局应用"
          action="applyGlobal"
          proposal={proposal}
          busyAction={busyAction}
          onRunAction={onRunAction}
        />
        <ActionButton
          label="撤回"
          action="revoke"
          proposal={proposal}
          busyAction={busyAction}
          onRunAction={onRunAction}
        />
        {proposal.appliedMemoryId && onOpenMemory && (
          <Button type="default" onClick={() => onOpenMemory(proposal.appliedMemoryId ?? "")}>
            查看已应用记忆
          </Button>
        )}
      </div>
    </div>
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
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input h-10"
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

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <div className="text-xs text-[#7b8ca2]">{label}</div>
      <div className="mt-2 truncate text-sm font-semibold text-[#172033]" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function DetailRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-2">
      <div className="text-[11px] text-[#7b8ca2]">{label}</div>
      <div className="mt-1 break-words text-sm text-[#334155]" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function TagBlock({
  title,
  items,
  itemTitles,
}: {
  title: string;
  items: string[];
  itemTitles?: string[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-[#172033]">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            title={itemTitles?.[index] ?? item}
            className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#66758a]"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  const text = JSON.stringify(value, null, 2);
  return (
    <section className="mt-4 rounded-lg border border-[#d9e2ec] bg-white p-4">
      <h4 className="text-sm font-semibold text-[#172033]">{title}</h4>
      <pre
        title={text}
        className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-[#f8fbff] p-3 text-xs leading-5 text-[#334155]"
      >
        {text}
      </pre>
    </section>
  );
}

function RiskPill({ risk }: { risk: string }) {
  const high = risk === "high";
  const medium = risk === "medium";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${
        high
          ? "border-[#ead4c8] bg-[#fff6f1] text-[#9a6a4f]"
          : medium
            ? "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34]"
            : "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]"
      }`}
    >
      {riskLabels[risk] ?? risk}
    </span>
  );
}

function ActionButton({
  label,
  action,
  proposal,
  busyAction,
  onRunAction,
}: {
  label: string;
  action: ProposalAction;
  proposal: MemoryProposal;
  busyAction: ProposalAction | null;
  onRunAction: (action: ProposalAction) => Promise<void>;
}) {
  const enabled = isEnabledForAction(proposal, action);
  const busy = busyAction === action;
  return (
    <Button
      type={action === "reject" ? "default" : action === "revoke" ? "default" : "primary"}
      danger={action === "reject"}
      loading={busy}
      disabled={!enabled || busyAction !== null}
      onClick={() => void onRunAction(action)}
    >
      {label}
    </Button>
  );
}
