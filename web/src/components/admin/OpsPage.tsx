import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Tooltip } from "animal-island-ui";
import { AdminInput, AdminSelect } from "./AdminFormPrimitives";
import {
  fetchDreamDailyNotes,
  fetchDreamDeepSleep,
  fetchDreamDiary,
  fetchDreamJobs,
  fetchDreamMorningBrief,
  fetchDreamSignals,
  fetchReflectionReportDetail,
  fetchReflectionReports,
  fetchReflectionRisks,
  runDream,
  runReflection,
  type DreamDailyNote,
  type DreamDeepSleepDetail,
  type DreamDiaryEntry,
  type DreamJob,
  type DreamMorningBrief,
  type DreamSignal,
  type ReflectionReport,
  type ReflectionReportDetail,
  type ReflectionRiskFlag,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type OpsPane = "reflection" | "dream";
type ReflectionScope = "conversation" | "user" | "daily" | "global_project";
type HistoryDatePreset = "all" | "7d" | "30d" | "90d" | "custom";

interface OpsPageProps {
  adminToken: string;
  mode?: OpsPane;
}

const reflectionScopes: Array<{ value: ReflectionScope; label: string }> = [
  { value: "conversation", label: "单个会话" },
  { value: "user", label: "单个用户" },
  { value: "daily", label: "最近一天" },
  { value: "global_project", label: "全局项目" },
];

const historyDateOptions: Array<{ value: HistoryDatePreset; label: string }> = [
  { value: "all", label: "全部时间" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" },
  { value: "90d", label: "最近 90 天" },
  { value: "custom", label: "自定义" },
];

const dreamSignalTypes = [
  "all",
  "recurring_theme",
  "technical_decision",
  "project_context",
  "user_preference",
  "persona_feedback",
  "relationship_shift",
  "growth_event",
  "boundary_risk",
  "memory_conflict",
  "asset_pattern",
  "external_feedback",
  "open_question",
];

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新运行台。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  if (message.includes("disabled")) {
    return "功能开关当前关闭，请检查 .env 中的 Dream / Reflection 配置。";
  }
  return message || "操作失败";
}

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

function resolveHistoryRange(
  preset: HistoryDatePreset,
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

function formatPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "未记录";
  return `${Math.round(value * 100)}%`;
}

function shortId(value: string | null | undefined): string {
  if (!value) return "无";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function parseOptionalNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function selectExistingOrFirst<T extends { id: string }>(
  items: T[],
  currentId: string | null
): string | null {
  if (currentId && items.some((item) => item.id === currentId)) return currentId;
  return items[0]?.id ?? null;
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

function proposalMemoryMeta(proposal: {
  id: string;
  targetMemoryId: string | null;
  appliedMemoryId: string | null;
  confidence: number;
  status: string;
}): string {
  const target = proposal.targetMemoryId
    ? `Target ${shortId(proposal.targetMemoryId)}`
    : "Target 无";
  const applied = proposal.appliedMemoryId
    ? `Applied ${shortId(proposal.appliedMemoryId)}`
    : "Applied 未生成";
  return `${formatPercent(proposal.confidence)} · ${proposal.status} · ${target} · ${applied} · P ${shortId(proposal.id)}`;
}

function proposalMemoryMetaTitle(proposal: {
  id: string;
  targetMemoryId: string | null;
  appliedMemoryId: string | null;
}): string {
  return [
    `Proposal ID: ${proposal.id}`,
    `Target Memory ID: ${proposal.targetMemoryId ?? "无"}`,
    `Applied Memory ID: ${proposal.appliedMemoryId ?? "未生成"}`,
  ].join(" · ");
}

function jobCount(job: DreamJob | null, key: keyof NonNullable<DreamJob["_count"]>): number {
  return job?._count?.[key] ?? 0;
}

export function ReflectionPage({ adminToken }: OpsPageProps) {
  return <OpsPage adminToken={adminToken} mode="reflection" />;
}

export function DreamPage({ adminToken }: OpsPageProps) {
  return <OpsPage adminToken={adminToken} mode="dream" />;
}

export function OpsPage({ adminToken, mode }: OpsPageProps) {
  const fixedPane = mode ?? null;
  const [activePane, setActivePane] = useState<OpsPane>(mode ?? "reflection");
  const [reflectionScope, setReflectionScope] = useState<ReflectionScope>("conversation");
  const [reflectionUserId, setReflectionUserId] = useState("");
  const [reflectionConversationId, setReflectionConversationId] = useState("");
  const [reflectionMessageLimit, setReflectionMessageLimit] = useState("80");
  const [dreamUserId, setDreamUserId] = useState("");
  const [dreamLookbackHours, setDreamLookbackHours] = useState("24");
  const [signalFilter, setSignalFilter] = useState("all");
  const [historyDatePreset, setHistoryDatePreset] =
    useState<HistoryDatePreset>("all");
  const [historyFromDate, setHistoryFromDate] = useState("");
  const [historyToDate, setHistoryToDate] = useState("");

  const [reports, setReports] = useState<ReflectionReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<ReflectionReportDetail | null>(null);
  const [risks, setRisks] = useState<ReflectionRiskFlag[]>([]);
  const [reflectionLoading, setReflectionLoading] = useState(false);

  const [dreamJobs, setDreamJobs] = useState<DreamJob[]>([]);
  const [selectedDreamJobId, setSelectedDreamJobId] = useState<string | null>(null);
  const [dailyNotes, setDailyNotes] = useState<DreamDailyNote[]>([]);
  const [signals, setSignals] = useState<DreamSignal[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DreamDiaryEntry[]>([]);
  const [dreamLoading, setDreamLoading] = useState(false);
  const [morningBrief, setMorningBrief] = useState<DreamMorningBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [deepSleepDetail, setDeepSleepDetail] = useState<DreamDeepSleepDetail | null>(null);
  const [deepSleepLoading, setDeepSleepLoading] = useState(false);
  const [deepSleepError, setDeepSleepError] = useState<string | null>(null);
  const [briefCollapsedJobIds, setBriefCollapsedJobIds] = useState<Set<string>>(
    () => new Set()
  );

  const [pageError, setPageError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runningReflection, setRunningReflection] = useState(false);
  const [runningDream, setRunningDream] = useState(false);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null,
    [reports, selectedReportId]
  );

  const selectedDreamJob = useMemo(
    () => dreamJobs.find((job) => job.id === selectedDreamJobId) ?? dreamJobs[0] ?? null,
    [dreamJobs, selectedDreamJobId]
  );

  const latestReportDetail =
    reportDetail?.report.id === selectedReport?.id ? reportDetail : null;
  const selectedDreamJobIdForView = selectedDreamJob?.id ?? null;
  const visibleMorningBrief =
    selectedDreamJobIdForView &&
    morningBrief?.jobId === selectedDreamJobIdForView &&
    !briefCollapsedJobIds.has(selectedDreamJobIdForView)
      ? morningBrief
      : null;
  const hasLoadedMorningBrief =
    Boolean(selectedDreamJobIdForView) &&
    morningBrief?.jobId === selectedDreamJobIdForView;
  const historyRange = useMemo(
    () => resolveHistoryRange(historyDatePreset, historyFromDate, historyToDate),
    [historyDatePreset, historyFromDate, historyToDate]
  );
  const visiblePane = fixedPane ?? activePane;

  async function loadReflection() {
    if (!adminToken) return;
    setReflectionLoading(true);
    setPageError(null);
    try {
      const [nextReports, nextRisks] = await Promise.all([
        fetchReflectionReports({
          token: adminToken,
          from: historyRange.from,
          to: historyRange.to,
          limit: 30,
        }),
        fetchReflectionRisks({
          token: adminToken,
          status: "all",
          from: historyRange.from,
          to: historyRange.to,
          limit: 40,
        }),
      ]);
      setReports(nextReports);
      setRisks(nextRisks);
      setSelectedReportId((current) => selectExistingOrFirst(nextReports, current));
    } catch (error) {
      setReports([]);
      setRisks([]);
      setPageError(friendlyErrorMessage(error));
    } finally {
      setReflectionLoading(false);
    }
  }

  async function loadDream() {
    if (!adminToken) return;
    setDreamLoading(true);
    setPageError(null);
    try {
      const [nextJobs, nextNotes, nextSignals, nextDiary] = await Promise.all([
        fetchDreamJobs({
          token: adminToken,
          status: "all",
          from: historyRange.from,
          to: historyRange.to,
          limit: 30,
        }),
        fetchDreamDailyNotes({
          token: adminToken,
          from: historyRange.from,
          to: historyRange.to,
          limit: 20,
        }),
        fetchDreamSignals({
          token: adminToken,
          signalType: signalFilter,
          from: historyRange.from,
          to: historyRange.to,
          limit: 50,
        }),
        fetchDreamDiary({
          token: adminToken,
          from: historyRange.from,
          to: historyRange.to,
          limit: 20,
        }),
      ]);
      setDreamJobs(nextJobs);
      setDailyNotes(nextNotes);
      setSignals(nextSignals);
      setDiaryEntries(nextDiary);
      setSelectedDreamJobId((current) => selectExistingOrFirst(nextJobs, current));
    } catch (error) {
      setDreamJobs([]);
      setDailyNotes([]);
      setSignals([]);
      setDiaryEntries([]);
      setPageError(friendlyErrorMessage(error));
    } finally {
      setDreamLoading(false);
    }
  }

  async function loadDeepSleep(jobId: string) {
    if (!adminToken) return;
    setDeepSleepLoading(true);
    setDeepSleepError(null);
    try {
      const detail = await fetchDreamDeepSleep({
        token: adminToken,
        jobId,
      });
      setDeepSleepDetail(detail);
    } catch (error) {
      setDeepSleepDetail(null);
      setDeepSleepError(friendlyErrorMessage(error));
    } finally {
      setDeepSleepLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialReflection() {
      if (fixedPane === "dream") return;
      if (!adminToken) return;
      setReflectionLoading(true);
      try {
        const [nextReports, nextRisks] = await Promise.all([
          fetchReflectionReports({
            token: adminToken,
            from: historyRange.from,
            to: historyRange.to,
            limit: 30,
          }),
          fetchReflectionRisks({
            token: adminToken,
            status: "all",
            from: historyRange.from,
            to: historyRange.to,
            limit: 40,
          }),
        ]);
        if (cancelled) return;
        setReports(nextReports);
        setRisks(nextRisks);
        setSelectedReportId((current) => selectExistingOrFirst(nextReports, current));
        setPageError(null);
      } catch (error) {
        if (!cancelled) {
          setReports([]);
          setRisks([]);
          setPageError(friendlyErrorMessage(error));
        }
      } finally {
        if (!cancelled) setReflectionLoading(false);
      }
    }

    void loadInitialReflection();
    return () => {
      cancelled = true;
    };
  }, [adminToken, fixedPane, historyRange.from, historyRange.to]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialDream() {
      if (fixedPane === "reflection") return;
      if (!adminToken) return;
      setDreamLoading(true);
      try {
        const [nextJobs, nextNotes, nextSignals, nextDiary] = await Promise.all([
          fetchDreamJobs({
            token: adminToken,
            status: "all",
            from: historyRange.from,
            to: historyRange.to,
            limit: 30,
          }),
          fetchDreamDailyNotes({
            token: adminToken,
            from: historyRange.from,
            to: historyRange.to,
            limit: 20,
          }),
          fetchDreamSignals({
            token: adminToken,
            signalType: signalFilter,
            from: historyRange.from,
            to: historyRange.to,
            limit: 50,
          }),
          fetchDreamDiary({
            token: adminToken,
            from: historyRange.from,
            to: historyRange.to,
            limit: 20,
          }),
        ]);
        if (cancelled) return;
        setDreamJobs(nextJobs);
        setDailyNotes(nextNotes);
        setSignals(nextSignals);
        setDiaryEntries(nextDiary);
        setSelectedDreamJobId((current) => selectExistingOrFirst(nextJobs, current));
        setPageError(null);
      } catch (error) {
        if (!cancelled) {
          setDreamJobs([]);
          setDailyNotes([]);
          setSignals([]);
          setDiaryEntries([]);
          setPageError(friendlyErrorMessage(error));
        }
      } finally {
        if (!cancelled) setDreamLoading(false);
      }
    }

    void loadInitialDream();
    return () => {
      cancelled = true;
    };
  }, [adminToken, fixedPane, historyRange.from, historyRange.to, signalFilter]);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      if (!adminToken || !selectedReport) {
        setReportDetail(null);
        return;
      }

      try {
        const detail = await fetchReflectionReportDetail({
          token: adminToken,
          reportId: selectedReport.id,
        });
        if (!cancelled) setReportDetail(detail);
      } catch (error) {
        if (!cancelled) {
          setReportDetail(null);
          setPageError(friendlyErrorMessage(error));
        }
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [adminToken, selectedReport]);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedDeepSleep() {
      if (fixedPane === "reflection") return;
      if (!adminToken || !selectedDreamJob) {
        setDeepSleepDetail(null);
        return;
      }

      setDeepSleepLoading(true);
      setDeepSleepError(null);
      try {
        const detail = await fetchDreamDeepSleep({
          token: adminToken,
          jobId: selectedDreamJob.id,
        });
        if (!cancelled) setDeepSleepDetail(detail);
      } catch (error) {
        if (!cancelled) {
          setDeepSleepDetail(null);
          setDeepSleepError(friendlyErrorMessage(error));
        }
      } finally {
        if (!cancelled) setDeepSleepLoading(false);
      }
    }

    void loadSelectedDeepSleep();
    return () => {
      cancelled = true;
    };
  }, [adminToken, fixedPane, selectedDreamJob]);

  async function runReflectionNow() {
    if (!adminToken) return;
    setActionError(null);
    setActionMessage(null);

    const userId = reflectionUserId.trim();
    const conversationId = reflectionConversationId.trim();
    if (reflectionScope === "conversation" && !conversationId) {
      setActionError("选择“单个会话”时，需要先填写 Conversation ID。");
      return;
    }
    if (reflectionScope === "user" && !userId) {
      setActionError("选择“单个用户”时，需要先填写 User ID。");
      return;
    }

    setRunningReflection(true);

    try {
      const result = await runReflection({
        token: adminToken,
        scope: reflectionScope,
        userId: reflectionScope === "user" ? userId : undefined,
        conversationId: reflectionScope === "conversation" ? conversationId : undefined,
        messageLimit: parseOptionalNumber(reflectionMessageLimit),
      });
      setSelectedReportId(result.reportId);
      setActivePane("reflection");
      setActionMessage(`Reflection 已完成：${result.summary}`);
      await loadReflection();
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setRunningReflection(false);
    }
  }

  async function runDreamNow() {
    if (!adminToken) return;
    setRunningDream(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const result = await runDream({
        token: adminToken,
        userId: dreamUserId.trim() || undefined,
        lookbackHours: parseOptionalNumber(dreamLookbackHours),
      });
      setSelectedDreamJobId(result.jobId);
      setMorningBrief(null);
      setBriefError(null);
      setBriefCollapsedJobIds((current) => {
        const next = new Set(current);
        next.delete(result.jobId);
        return next;
      });
      setActivePane("dream");
      setActionMessage(
        `Dream 已完成：${result.signalCount} 个 signal，${result.proposalCount} 条提案，${result.riskCount} 个风险项。`
      );
      await loadDream();
      await loadDeepSleep(result.jobId);
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setRunningDream(false);
    }
  }

  async function loadMorningBrief() {
    if (!adminToken || !selectedDreamJob) return;
    const jobId = selectedDreamJob.id;
    if (morningBrief?.jobId === jobId) {
      setBriefCollapsedJobIds((current) => {
        const next = new Set(current);
        if (next.has(jobId)) {
          next.delete(jobId);
        } else {
          next.add(jobId);
        }
        return next;
      });
      return;
    }

    setBriefLoading(true);
    setBriefError(null);
    try {
      const brief = await fetchDreamMorningBrief({
        token: adminToken,
        jobId,
      });
      setMorningBrief(brief);
      setBriefCollapsedJobIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        return next;
      });
    } catch (error) {
      setMorningBrief(null);
      setBriefError(friendlyErrorMessage(error));
    } finally {
      setBriefLoading(false);
    }
  }

  function selectDreamJob(jobId: string) {
    setSelectedDreamJobId(jobId);
    setMorningBrief(null);
    setBriefError(null);
    setDeepSleepDetail(null);
    setDeepSleepError(null);
  }

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">
          {fixedPane === "dream" ? "Dream Cycle" : "Reflection"}
        </div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">
          {fixedPane === "dream" ? "梦境循环" : "复盘报告"}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。这里会连接真实运行记录和生成结果。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">
              {fixedPane === "dream" ? "Dream Cycle" : fixedPane === "reflection" ? "Reflection" : "Dream / Reflection"}
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">
              {fixedPane === "dream" ? "梦境循环" : fixedPane === "reflection" ? "复盘报告" : "系统运行与复盘"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              {fixedPane === "dream"
                ? "查看 Dream Cycle 的作业、Daily Note、Signal、内心日记、Deep Sleep 整合结果和 Morning Brief。"
                : fixedPane === "reflection"
                  ? "针对一段对话或一个用户上下文做短周期复盘，审核它生成的提案、风险项和成长日志。"
                  : "手动触发短周期复盘，查看 Dream Cycle 沉淀出的 Daily Note、Signal、内心日记和 Morning Brief。"}
            </p>
          </div>
          <Button
            type="default"
            loading={reflectionLoading || dreamLoading}
            onClick={() => {
              if (fixedPane === "reflection") {
                void loadReflection();
              } else if (fixedPane === "dream") {
                void loadDream();
              } else {
                void loadReflection();
                void loadDream();
              }
            }}
          >
            刷新数据
          </Button>
        </div>

        {pageError && (
          <div className="mt-4 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {pageError}
          </div>
        )}
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
      </section>

      <section className={fixedPane ? "grid gap-5" : "grid gap-5 xl:grid-cols-2"}>
        {fixedPane !== "dream" && (
          <ReflectionRunCard
            reflectionScope={reflectionScope}
            reflectionUserId={reflectionUserId}
            reflectionConversationId={reflectionConversationId}
            reflectionMessageLimit={reflectionMessageLimit}
            runningReflection={runningReflection}
            onScopeChange={setReflectionScope}
            onUserIdChange={setReflectionUserId}
            onConversationIdChange={setReflectionConversationId}
            onMessageLimitChange={setReflectionMessageLimit}
            onRun={() => void runReflectionNow()}
          />
        )}

        {fixedPane !== "reflection" && (
          <DreamRunCard
            dreamUserId={dreamUserId}
            dreamLookbackHours={dreamLookbackHours}
            runningDream={runningDream}
            onUserIdChange={setDreamUserId}
            onLookbackHoursChange={setDreamLookbackHours}
            onRun={() => void runDreamNow()}
          />
        )}
      </section>

      <section className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-[0_18px_48px_rgba(91,117,150,0.1)] md:p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {!fixedPane && (
            <div className="flex flex-wrap gap-2">
              <PaneButton
                active={activePane === "reflection"}
                label="Reflection 报告"
                onClick={() => setActivePane("reflection")}
              />
              <PaneButton
                active={activePane === "dream"}
                label="Dream 产物"
                onClick={() => setActivePane("dream")}
              />
            </div>
          )}
          <HistoryDateControls
            preset={historyDatePreset}
            fromDate={historyFromDate}
            toDate={historyToDate}
            onPresetChange={setHistoryDatePreset}
            onFromDateChange={setHistoryFromDate}
            onToDateChange={setHistoryToDate}
          />
          <div className="flex flex-wrap gap-2 text-xs text-[#66758a]">
            {fixedPane !== "dream" && (
              <StatusPill
                active={!reflectionLoading}
                label={reflectionLoading ? "Reflection 读取中" : `${reports.length} 份报告`}
              />
            )}
            {fixedPane !== "reflection" && (
              <StatusPill
                active={!dreamLoading}
                label={dreamLoading ? "Dream 读取中" : `${dreamJobs.length} 个作业`}
              />
            )}
          </div>
        </div>

        {visiblePane === "reflection" ? (
          <ReflectionPanel
            reports={reports}
            selectedReport={selectedReport}
            detail={latestReportDetail}
            risks={risks}
            loading={reflectionLoading}
            onSelectReport={setSelectedReportId}
          />
        ) : (
          <DreamPanel
            jobs={dreamJobs}
            selectedJob={selectedDreamJob}
            dailyNotes={dailyNotes}
            signals={signals}
            diaryEntries={diaryEntries}
            loading={dreamLoading}
            signalFilter={signalFilter}
            morningBrief={visibleMorningBrief}
            hasLoadedMorningBrief={hasLoadedMorningBrief}
            deepSleepDetail={deepSleepDetail}
            deepSleepLoading={deepSleepLoading}
            deepSleepError={deepSleepError}
            briefLoading={briefLoading}
            briefError={briefError}
            onSignalFilterChange={setSignalFilter}
            onSelectJob={selectDreamJob}
            onLoadBrief={() => void loadMorningBrief()}
          />
        )}
      </section>
    </div>
  );
}

function RunCard({
  eyebrow,
  title,
  description,
  busy,
  buttonLabel,
  onRun,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  busy: boolean;
  buttonLabel: string;
  onRun: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">{eyebrow}</div>
          <h3 className="mt-2 text-xl font-semibold text-[#172033]">{title}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#617188]">{description}</p>
        </div>
        <Button type="primary" loading={busy} onClick={onRun}>
          {buttonLabel}
        </Button>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function ReflectionRunCard({
  reflectionScope,
  reflectionUserId,
  reflectionConversationId,
  reflectionMessageLimit,
  runningReflection,
  onScopeChange,
  onUserIdChange,
  onConversationIdChange,
  onMessageLimitChange,
  onRun,
}: {
  reflectionScope: ReflectionScope;
  reflectionUserId: string;
  reflectionConversationId: string;
  reflectionMessageLimit: string;
  runningReflection: boolean;
  onScopeChange: (value: ReflectionScope) => void;
  onUserIdChange: (value: string) => void;
  onConversationIdChange: (value: string) => void;
  onMessageLimitChange: (value: string) => void;
  onRun: () => void;
}) {
  return (
    <RunCard
      eyebrow="Reflection"
      title="手动复盘"
      description="适合在一段对话或一个用户上下文后，抽取记忆提案、成长日志和风险项。"
      busy={runningReflection}
      buttonLabel={runningReflection ? "复盘中" : "运行 Reflection"}
      onRun={onRun}
    >
      <div className="admin-select-host grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-[#7b8ca2]">复盘范围</span>
          <AdminSelect
            ariaLabel="复盘范围"
            value={reflectionScope}
            onChange={(value) => onScopeChange(value as ReflectionScope)}
            options={reflectionScopes.map((scope) => ({ key: scope.value, label: scope.label }))}
          />
        </div>
        <Field label="读取消息数">
          <AdminInput
            value={reflectionMessageLimit}
            onChange={(event) => onMessageLimitChange(event.target.value)}
            type="number"
            min={1}
            aria-label="读取消息数"
          />
        </Field>
        <Field label="User ID">
          <AdminInput
            value={reflectionUserId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="选择“单个用户”时填写"
            disabled={reflectionScope !== "user"}
            aria-label="User ID"
          />
        </Field>
        <Field label="Conversation ID">
          <AdminInput
            value={reflectionConversationId}
            onChange={(event) => onConversationIdChange(event.target.value)}
            placeholder="选择“单个会话”时填写"
            disabled={reflectionScope !== "conversation"}
            aria-label="Conversation ID"
          />
        </Field>
      </div>
    </RunCard>
  );
}

function DreamRunCard({
  dreamUserId,
  dreamLookbackHours,
  runningDream,
  onUserIdChange,
  onLookbackHoursChange,
  onRun,
}: {
  dreamUserId: string;
  dreamLookbackHours: string;
  runningDream: boolean;
  onUserIdChange: (value: string) => void;
  onLookbackHoursChange: (value: string) => void;
  onRun: () => void;
}) {
  return (
    <RunCard
      eyebrow="Dream Cycle"
      title="手动梦境循环"
      description="汇总近期事件，生成 Daily Note、Dream Signal、内心日记，并进入 Deep Sleep 整合。"
      busy={runningDream}
      buttonLabel={runningDream ? "运行中" : "运行 Dream"}
      onRun={onRun}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="User ID（可选）">
          <AdminInput
            value={dreamUserId}
            onChange={(event) => onUserIdChange(event.target.value)}
            placeholder="不填则运行全局 daily"
            aria-label="User ID（可选）"
          />
        </Field>
        <Field label="回看小时数">
          <AdminInput
            value={dreamLookbackHours}
            onChange={(event) => onLookbackHoursChange(event.target.value)}
            type="number"
            min={1}
            aria-label="回看小时数"
          />
        </Field>
      </div>
    </RunCard>
  );
}

function ReflectionPanel({
  reports,
  selectedReport,
  detail,
  risks,
  loading,
  onSelectReport,
}: {
  reports: ReflectionReport[];
  selectedReport: ReflectionReport | null;
  detail: ReflectionReportDetail | null;
  risks: ReflectionRiskFlag[];
  loading: boolean;
  onSelectReport: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]">
      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
        <PanelHeader
          title="报告队列"
          subtitle={loading ? "正在读取 Reflection 报告" : `最近 ${reports.length} 份报告`}
        />
        {reports.length === 0 ? (
          <QueuePlaceholder text={loading ? "正在读取报告..." : "还没有 Reflection 报告。"} />
        ) : (
          <div className="grid max-h-[42rem] gap-2 overflow-y-auto pr-1">
            {reports.map((report) => (
              <button
                key={report.id}
                type="button"
                onClick={() => onSelectReport(report.id)}
                className={`admin-layout-button block w-full rounded-lg border px-4 py-3 text-left transition ${
                  report.id === selectedReport?.id ? "is-active" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 min-w-0 text-sm font-medium leading-6 text-[#172033]" title={report.summary}>
                    {report.summary}
                  </p>
                  <StatusPill active={report.confidence >= 0.8} label={formatPercent(report.confidence)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#7b8ca2]">
                  <Tooltip title={report.id} variant="island" placement="bottom">
                    <span>{shortId(report.id)}</span>
                  </Tooltip>
                  <span>·</span>
                  <span>{formatDate(report.createdAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          <PanelHeader title="风险雷达" subtitle={`最近 ${risks.length} 条风险项`} />
          {risks.length === 0 ? (
            <QueuePlaceholder text="当前没有风险项。" />
          ) : (
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
              {risks.slice(0, 8).map((risk) => (
                <RiskItem key={risk.id} risk={risk} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ReflectionDetail report={selectedReport} detail={detail} />
    </div>
  );
}

function ReflectionDetail({
  report,
  detail,
}: {
  report: ReflectionReport | null;
  detail: ReflectionReportDetail | null;
}) {
  if (!report) {
    return (
      <div className="rounded-lg border border-[#d9e2ec] bg-white p-6">
        <h3 className="text-base font-semibold text-[#172033]">报告详情</h3>
        <p className="mt-3 text-sm leading-7 text-[#66758a]">
          运行一次 Reflection 后，这里会展示报告摘要、提案、风险项和成长日志。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">Reflection Detail</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">复盘报告</h3>
          <p className="mt-2 text-xs text-[#7b8ca2]" title={report.id}>
            {shortId(report.id)} · {formatDate(report.createdAt)}
          </p>
        </div>
        <StatusPill active={report.confidence >= 0.8} label={formatPercent(report.confidence)} />
      </div>

      <section className="mt-5 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
        <h4 className="text-sm font-semibold text-[#172033]">Summary</h4>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#334155]">
          {report.summary}
        </p>
      </section>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Metric label="Memory Proposals" value={String(detail?.proposals.length ?? 0)} />
        <Metric label="Risk Flags" value={String(detail?.riskFlags.length ?? 0)} />
        <Metric label="Growth Logs" value={String(detail?.growthLogs.length ?? 0)} />
      </div>

      <SectionList
        title="记忆提案"
        emptyText="这份报告没有生成记忆提案。"
        items={detail?.proposals ?? []}
        renderItem={(proposal) => (
          <CompactItem
            title={`${proposal.proposalType} · ${proposal.scope}/${proposal.type}`}
            body={proposal.summary || proposal.content}
            meta={proposalMemoryMeta(proposal)}
            metaTitle={proposalMemoryMetaTitle(proposal)}
          />
        )}
      />

      <SectionList
        title="风险项"
        emptyText="这份报告没有风险项。"
        items={detail?.riskFlags ?? []}
        renderItem={(risk) => (
          <CompactItem
            title={`${risk.severity} · ${risk.type}`}
            body={risk.description}
            meta={risk.status}
          />
        )}
      />

      <SectionList
        title="成长日志提案"
        emptyText="这份报告没有成长日志提案。"
        items={detail?.growthLogs ?? []}
        renderItem={(log) => (
          <CompactItem
            title={log.title}
            body={log.content}
            meta={`${formatPercent(log.confidence)} · ${log.status}`}
          />
        )}
      />
    </div>
  );
}

function DreamPanel({
  jobs,
  selectedJob,
  dailyNotes,
  signals,
  diaryEntries,
  loading,
  signalFilter,
  morningBrief,
  hasLoadedMorningBrief,
  deepSleepDetail,
  deepSleepLoading,
  deepSleepError,
  briefLoading,
  briefError,
  onSignalFilterChange,
  onSelectJob,
  onLoadBrief,
}: {
  jobs: DreamJob[];
  selectedJob: DreamJob | null;
  dailyNotes: DreamDailyNote[];
  signals: DreamSignal[];
  diaryEntries: DreamDiaryEntry[];
  loading: boolean;
  signalFilter: string;
  morningBrief: DreamMorningBrief | null;
  hasLoadedMorningBrief: boolean;
  deepSleepDetail: DreamDeepSleepDetail | null;
  deepSleepLoading: boolean;
  deepSleepError: string | null;
  briefLoading: boolean;
  briefError: string | null;
  onSignalFilterChange: (value: string) => void;
  onSelectJob: (id: string) => void;
  onLoadBrief: () => void;
}) {
  const scopedNotes = selectedJob
    ? dailyNotes.filter((note) => note.jobId === selectedJob.id)
    : dailyNotes;
  const scopedSignals = selectedJob
    ? signals.filter((signal) => signal.jobId === selectedJob.id)
    : signals;
  const scopedDiary = selectedJob
    ? diaryEntries.filter((entry) => entry.jobId === selectedJob.id)
    : diaryEntries;

  const visibleNotes = scopedNotes.length > 0 ? scopedNotes : dailyNotes;
  const visibleSignals = scopedSignals.length > 0 ? scopedSignals : signals;
  const visibleDiary = scopedDiary.length > 0 ? scopedDiary : diaryEntries;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(20rem,0.85fr)_minmax(0,1.15fr)]">
      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
        <PanelHeader
          title="Dream 作业"
          subtitle={loading ? "正在读取 Dream 作业" : `最近 ${jobs.length} 个作业`}
        />
        {jobs.length === 0 ? (
          <QueuePlaceholder text={loading ? "正在读取作业..." : "还没有 Dream 作业。"} />
        ) : (
          <div className="grid max-h-[42rem] gap-2 overflow-y-auto pr-1">
            {jobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => onSelectJob(job.id)}
                className={`admin-layout-button block w-full rounded-lg border px-4 py-3 text-left transition ${
                  job.id === selectedJob?.id ? "is-active" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#172033]" title={job.id}>
                      {job.triggerType} · {job.scope}
                    </div>
                    <div className="mt-2 truncate text-xs text-[#7b8ca2]" title={job.phase ?? "无 phase"}>
                      phase: {job.phase ?? "未记录"}
                    </div>
                  </div>
                  <StatusPill active={job.status === "completed"} label={job.status} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#7b8ca2]">
                  <span>{formatDate(job.createdAt)}</span>
                  <span>·</span>
                  <span>{jobCount(job, "signals")} signals</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <DreamJobDetail
          job={selectedJob}
          morningBrief={morningBrief}
          hasLoadedMorningBrief={hasLoadedMorningBrief}
          briefLoading={briefLoading}
          briefError={briefError}
          onLoadBrief={onLoadBrief}
        />

        <DeepSleepPanel
          detail={deepSleepDetail}
          loading={deepSleepLoading}
          error={deepSleepError}
        />

        <div className="grid gap-5 lg:grid-cols-2">
          <ContentPanel title="Daily Note" subtitle={`展示 ${visibleNotes.length} 条`}>
            {visibleNotes.length === 0 ? (
              <QueuePlaceholder text="还没有 Daily Note。" />
            ) : (
              <div className="grid gap-2">
                {visibleNotes.slice(0, 4).map((note) => (
                  <CompactItem
                    key={note.id}
                    title={note.title ?? "Daily Note"}
                    body={note.summary}
                    meta={`${note.scope} · ${formatDate(note.date)}`}
                  />
                ))}
              </div>
            )}
          </ContentPanel>

          <ContentPanel
            title="Dream Signal"
            subtitle={`展示 ${visibleSignals.length} 条`}
            action={
              <AdminSelect
                ariaLabel="Dream Signal 类型"
                value={signalFilter}
                onChange={onSignalFilterChange}
                options={dreamSignalTypes.map((type) => ({
                  key: type,
                  label: type === "all" ? "全部类型" : type,
                }))}
              />
            }
          >
            {visibleSignals.length === 0 ? (
              <QueuePlaceholder text="当前筛选下没有 Signal。" />
            ) : (
              <div className="grid gap-2">
                {visibleSignals.slice(0, 6).map((signal) => (
                  <CompactItem
                    key={signal.id}
                    title={`${signal.signalType} · ${signal.riskLevel}`}
                    body={signal.summary || signal.content}
                    meta={`${formatPercent(signal.confidence)} · strength ${signal.strength}`}
                  />
                ))}
              </div>
            )}
          </ContentPanel>
        </div>

        <ContentPanel title="Dream Diary" subtitle={`展示 ${visibleDiary.length} 篇`}>
          {visibleDiary.length === 0 ? (
            <QueuePlaceholder text="还没有 Dream Diary。" />
          ) : (
            <div className="grid gap-2">
              {visibleDiary.slice(0, 3).map((entry) => (
                <CompactItem
                  key={entry.id}
                  title={entry.title ?? "Dream Diary"}
                  body={entry.content}
                  meta={`${entry.visibility} · ${formatDate(entry.date)}`}
                />
              ))}
            </div>
          )}
        </ContentPanel>
      </div>
    </div>
  );
}

function DreamJobDetail({
  job,
  morningBrief,
  hasLoadedMorningBrief,
  briefLoading,
  briefError,
  onLoadBrief,
}: {
  job: DreamJob | null;
  morningBrief: DreamMorningBrief | null;
  hasLoadedMorningBrief: boolean;
  briefLoading: boolean;
  briefError: string | null;
  onLoadBrief: () => void;
}) {
  if (!job) {
    return (
      <div className="rounded-lg border border-[#d9e2ec] bg-white p-6">
        <h3 className="text-base font-semibold text-[#172033]">Dream 详情</h3>
        <p className="mt-3 text-sm leading-7 text-[#66758a]">
          运行一次 Dream 后，这里会展示作业状态和关联产物。
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">Dream Detail</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">
            {job.triggerType} · {job.scope}
          </h3>
          <p className="mt-2 text-xs text-[#7b8ca2]" title={job.id}>
            {shortId(job.id)} · {formatDate(job.createdAt)}
          </p>
        </div>
        <StatusPill active={job.status === "completed"} label={job.status} />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric label="Daily Notes" value={String(jobCount(job, "dailyNotes"))} />
        <Metric label="Signals" value={String(jobCount(job, "signals"))} />
        <Metric label="Diary" value={String(jobCount(job, "diaryEntries"))} />
        <Metric label="Reports" value={String(jobCount(job, "reports"))} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DetailRow label="Phase" value={job.phase ?? "未记录"} />
        <DetailRow label="User ID" value={shortId(job.userId)} title={job.userId ?? "无"} />
        <DetailRow label="From" value={formatDate(job.fromTime)} title={job.fromTime ?? "无"} />
        <DetailRow label="To" value={formatDate(job.toTime)} title={job.toTime ?? "无"} />
      </div>

      {job.error && (
        <div className="mt-4 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm leading-6 text-[#8d6048]">
          {job.error}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="primary" loading={briefLoading} onClick={onLoadBrief}>
          {morningBrief
            ? "收起 Morning Brief"
            : hasLoadedMorningBrief
              ? "展开 Morning Brief"
              : "查看 Morning Brief"}
        </Button>
        {briefError && <span className="text-sm text-[#8d6048]">{briefError}</span>}
      </div>

      {morningBrief && (
        <section className="mt-5 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
          <h4 className="text-sm font-semibold text-[#172033]">Morning Brief</h4>
          <pre
            title={morningBrief.summary}
            className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#334155]"
          >
            {morningBrief.summary}
          </pre>
          <TagList
            title="Top Signals"
            items={morningBrief.topSignals.map(
              (signal) => `${signal.signalType}: ${signal.content} (${formatPercent(signal.confidence)})`
            )}
          />
        </section>
      )}
    </div>
  );
}

function DeepSleepPanel({
  detail,
  loading,
  error,
}: {
  detail: DreamDeepSleepDetail | null;
  loading: boolean;
  error: string | null;
}) {
  const latestReport = detail?.reports[0] ?? null;

  return (
    <section className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">Deep Sleep</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">深度整合结果</h3>
          <p className="mt-2 text-sm leading-6 text-[#617188]">
            Deep Sleep 会把 Dream Signal 整合成正式提案和风险项，但不会直接写入长期记忆。
          </p>
        </div>
        <StatusPill active={!loading} label={loading ? "读取中" : `${detail?.reports.length ?? 0} 份报告`} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
          {error}
        </div>
      )}

      {!loading && !latestReport ? (
        <QueuePlaceholder text="这个 Dream Job 还没有 Deep Sleep 整合报告。" />
      ) : latestReport ? (
        <>
          <section className="mt-5 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
            <h4 className="text-sm font-semibold text-[#172033]">Summary</h4>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#334155]">
              {latestReport.summary || "Deep Sleep 没有生成摘要。"}
            </p>
          </section>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Metric label="Candidates" value={String(latestReport.candidateCount)} />
            <Metric label="Promoted" value={String(latestReport.promotedCount)} />
            <Metric label="Rejected" value={String(latestReport.rejectedCount)} />
            <Metric label="Risks" value={String(latestReport.riskCount)} />
          </div>

          <SectionList
            title="本轮记忆提案"
            emptyText="Deep Sleep 没有生成记忆提案。"
            items={detail?.proposals ?? []}
            renderItem={(proposal) => (
              <CompactItem
                title={`${proposal.proposalType} · ${proposal.scope}/${proposal.type}`}
                body={proposal.summary || proposal.content}
                meta={proposalMemoryMeta(proposal)}
                metaTitle={proposalMemoryMetaTitle(proposal)}
              />
            )}
          />

          <SectionList
            title="本轮风险项"
            emptyText="Deep Sleep 没有生成风险项。"
            items={detail?.riskFlags ?? []}
            renderItem={(risk) => (
              <CompactItem
                title={`${risk.severity} · ${risk.type}`}
                body={risk.description}
                meta={risk.status}
              />
            )}
          />

          <SectionList
            title="本轮成长日志提案"
            emptyText="Deep Sleep 没有生成成长日志提案。"
            items={detail?.growthLogs ?? []}
            renderItem={(log) => (
              <CompactItem
                title={log.title}
                body={log.content}
                meta={`${formatPercent(log.confidence)} · ${log.status}`}
              />
            )}
          />
        </>
      ) : null}
    </section>
  );
}

function HistoryDateControls({
  preset,
  fromDate,
  toDate,
  onPresetChange,
  onFromDateChange,
  onToDateChange,
}: {
  preset: HistoryDatePreset;
  fromDate: string;
  toDate: string;
  onPresetChange: (value: HistoryDatePreset) => void;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
}) {
  return (
    <div className="admin-select-host flex flex-wrap items-end gap-2">
      <div className="block">
        <span className="text-[11px] font-medium text-[#7b8ca2]">时间范围</span>
        <AdminSelect
          ariaLabel="时间范围"
          value={preset}
          onChange={(value) => onPresetChange(value as HistoryDatePreset)}
          options={historyDateOptions.map((option) => ({ key: option.value, label: option.label }))}
        />
      </div>
      <label className="block">
        <span className="text-[11px] font-medium text-[#7b8ca2]">开始</span>
        <AdminInput
          type="date"
          value={fromDate}
          onChange={(event) => {
            onFromDateChange(event.target.value);
            onPresetChange("custom");
          }}
          aria-label="开始日期"
          className="mt-1"
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-medium text-[#7b8ca2]">结束</span>
        <AdminInput
          type="date"
          value={toDate}
          onChange={(event) => {
            onToDateChange(event.target.value);
            onPresetChange("custom");
          }}
          aria-label="结束日期"
          className="mt-1"
        />
      </label>
    </div>
  );
}

function PaneButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`admin-pill-button rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "is-active" : ""
      }`}
    >
      {label}
    </button>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-base font-semibold text-[#172033]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-[#7b8ca2]">{subtitle}</p>
    </div>
  );
}

function ContentPanel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-select-host rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-[#172033]">{title}</h3>
          <p className="mt-1 text-xs text-[#7b8ca2]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionList<T>({
  title,
  emptyText,
  items,
  renderItem,
}: {
  title: string;
  emptyText: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <section className="mt-5">
      <h4 className="text-sm font-semibold text-[#172033]">{title}</h4>
      {items.length === 0 ? (
        <div className="mt-2 rounded-lg border border-dashed border-[#cdd9e6] bg-[#f8fbff] px-4 py-5 text-sm text-[#66758a]">
          {emptyText}
        </div>
      ) : (
        <div className="mt-2 grid gap-2">{items.map(renderItem)}</div>
      )}
    </section>
  );
}

function CompactItem({
  title,
  body,
  meta,
  metaTitle,
}: {
  title: string;
  body: string;
  meta: string;
  metaTitle?: string;
}) {
  return (
    <article className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="text-sm font-semibold text-[#172033]" title={title}>
          {title}
        </h4>
        <span
          className="max-w-full text-xs text-[#7b8ca2] sm:max-w-[18rem] sm:truncate"
          title={metaTitle ?? meta}
        >
          {meta}
        </span>
      </div>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#617188]" title={body}>
        {body}
      </p>
    </article>
  );
}

function RiskItem({ risk }: { risk: ReflectionRiskFlag }) {
  return (
    <article className="rounded-lg border border-[#d9e2ec] bg-white px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-[#172033]" title={risk.type}>
            {risk.type}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#617188]" title={risk.description}>
            {risk.description}
          </p>
        </div>
        <RiskPill severity={risk.severity} />
      </div>
    </article>
  );
}

function RiskPill({ severity }: { severity: string }) {
  const high = severity === "high";
  const medium = severity === "medium";
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs ${
        high
          ? "border-[#ead4c8] bg-[#fff6f1] text-[#9a6a4f]"
          : medium
            ? "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34]"
            : "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]"
      }`}
    >
      {severity}
    </span>
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
      <div className="mt-1 truncate text-sm text-[#334155]" title={title ?? value}>
        {value}
      </div>
    </div>
  );
}

function TagList({ title, items }: { title: string; items: string[] }) {
  const normalized = items.flatMap((item) => toTextList(item));
  if (normalized.length === 0) return null;
  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-[#172033]">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {normalized.map((item, index) => (
          <span
            key={`${item}-${index}`}
            title={item}
            className="max-w-full truncate rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-xs text-[#66758a]"
          >
            {item}
          </span>
        ))}
      </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-[#7b8ca2]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
