import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, Card, Form, Icon, Input, type CardColor, type IconName } from "animal-island-ui";
import { AdminSelect } from "./AdminFormPrimitives";
import {
  analyzeExpressionLearningExample,
  createExpressionLearningExample,
  deleteExpressionLearningExample,
  deleteExpressionLearningTrainingRecord,
  downloadExpressionLearningTrainingExport,
  fetchExpressionLearningExamples,
  fetchExpressionLearningTrainingRecords,
  generateExpressionLearningDraft,
  generateExpressionLearningPracticeQuestion,
  reanalyzeExpressionLearningExample,
  runExpressionLearningPracticeBatchNow,
  saveExpressionLearningTrainingDraft,
  updateExpressionLearningExample,
  type ExpressionLearningAnalysis,
  type ExpressionLearningCreateInput,
  type ExpressionLearningExample,
  type ExpressionLearningPracticeQuestion,
  type ExpressionLearningPracticeQuestionResponse,
  type ExpressionLearningResponse,
  type ExpressionLearningTrainingDraftInput,
  type ExpressionLearningTrainingRecord,
  type ExpressionLearningTrainingRecordsResponse,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface Props {
  adminToken: string;
}

const emptyState: ExpressionLearningResponse = {
  examples: [],
  summary: { total: 0, active: 0, pending: 0, skipped: 0 },
  scenes: [],
};

const emptyExerciseState: ExpressionLearningTrainingRecordsResponse = {
  records: [],
  summary: { total: 0, open: 0, archived: 0, completed: 0, dismissed: 0 },
};

type LearningTab = "library" | "exercises" | "manual";

type TeachingSeed = {
  record: ExpressionLearningTrainingRecord;
  revision: number;
};

type ExpressionLearningPatch = Omit<
  Parameters<typeof updateExpressionLearningExample>[0],
  "token" | "exampleId"
>;

const defaultSceneOptions = [
  { key: "general", label: "通用" },
  { key: "chat", label: "聊天" },
  { key: "reply", label: "回复评论" },
];

function sceneLabel(value: string) {
  return ({
    general: "通用",
    chat: "聊天",
    reply: "回复评论",
  } as Record<string, string>)[value] ?? value;
}

function sceneOptions(_extraScenes: string[] = []) {
  return defaultSceneOptions;
}

function sceneFilterOptions(extraScenes: string[] = []) {
  return [
    { key: "all", label: "全部场景" },
    ...sceneOptions(extraScenes),
  ];
}

function actionLabel(value: string) {
  return ({
    owner_written: "你直接写的",
    edited_draft: "修改草稿后发布",
    accepted_draft: "直接采用草稿",
    skipped: "决定不回复",
    owner_taught: "主动教学",
  } as Record<string, string>)[value] ?? value;
}

function outcomeLabel(value: string) {
  return ({
    sent: "发布了回复",
    skipped: "决定不回复",
  } as Record<string, string>)[value] ?? value;
}

function statusLabel(value: string) {
  return ({
    pending: "待审核",
    active: "参与生成",
    disabled: "已停用",
  } as Record<string, string>)[value] ?? value;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function recordString(value: unknown, key: string): string {
  const item = recordObject(value)[key];
  return typeof item === "string" ? item : "";
}

function questionFromTrainingRecord(
  record: ExpressionLearningTrainingRecord
): ExpressionLearningPracticeQuestion | null {
  const raw = recordObject(record.generatedQuestion);
  const contextText = record.contextText ?? recordString(raw, "contextText");
  if (!contextText) return null;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((item): item is string => typeof item === "string")
    : [];
  return {
    scene: recordString(raw, "scene") || record.scene,
    contextText,
    draftText: (record.draftText ?? recordString(raw, "draftText")) || null,
    teachingFocus: recordString(raw, "teachingFocus"),
    expectedOwnerInput: recordString(raw, "expectedOwnerInput"),
    tags,
  };
}

function analysisFromTrainingRecord(record: ExpressionLearningTrainingRecord): ExpressionLearningAnalysis | null {
  const raw = recordObject(record.analysisSnapshot);
  const lesson = recordString(raw, "lesson");
  if (!lesson) return null;
  return {
    lesson,
    reasoning: recordString(raw, "reasoning"),
    strategy: recordString(raw, "strategy"),
    tone: recordString(raw, "tone"),
    avoidances: textList(raw.avoidances),
    tags: textList(raw.tags),
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0.7,
  };
}

function exerciseStatus(record: ExpressionLearningTrainingRecord) {
  if (record.example?.status === "active") {
    return { key: "active", label: "已启用", active: true };
  }
  if (record.example?.status === "disabled") {
    return { key: "disabled", label: "已停用", active: false };
  }
  if (record.status === "question_generated") {
    return { key: "question_generated", label: "刚出题", active: false };
  }
  return { key: "draft_saved", label: "草稿中", active: false };
}

function exerciseQuestionText(record: ExpressionLearningTrainingRecord): string {
  return (record.contextText ?? recordString(record.generatedQuestion, "contextText")) || "未填写题目";
}

export function ExpressionLearningPage({ adminToken }: Props) {
  const [activeTab, setActiveTab] = useState<LearningTab>("library");
  const [state, setState] = useState(emptyState);
  const [exerciseState, setExerciseState] = useState(emptyExerciseState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [teachingSeed, setTeachingSeed] = useState<TeachingSeed | null>(null);
  const [scene, setScene] = useState("all");
  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [query, setQuery] = useState("");
  const [exerciseCreatedFrom, setExerciseCreatedFrom] = useState("");
  const [exerciseCreatedTo, setExerciseCreatedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [batching, setBatching] = useState(false);
  const [exporting, setExporting] = useState<"json" | "jsonl" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => state.examples.find((example) => example.id === selectedId) ?? state.examples[0] ?? null,
    [selectedId, state.examples],
  );

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchExpressionLearningExamples({
        token: adminToken,
        scene,
        status,
        outcome,
        query,
      });
      setState(result);
      if (!result.examples.some((example) => example.id === selectedId)) {
        setSelectedId(result.examples[0]?.id ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadExercises() {
    if (!adminToken) return;
    setError(null);
    try {
      const result = await fetchExpressionLearningTrainingRecords({
        token: adminToken,
        sourceType: "exercise",
        status: "all",
        createdFrom: exerciseCreatedFrom || undefined,
        createdTo: exerciseCreatedTo || undefined,
        limit: 300,
      });
      setExerciseState(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refreshAll() {
    await Promise.all([load(), loadExercises()]);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, scene, status, outcome, query]);

  useEffect(() => {
    void loadExercises();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, exerciseCreatedFrom, exerciseCreatedTo]);

  async function save(exampleId: string, patch: ExpressionLearningPatch) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      await updateExpressionLearningExample({ ...patch, token: adminToken, exampleId });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function reanalyze(exampleId: string) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      await reanalyzeExpressionLearningExample({ token: adminToken, exampleId });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function createTeachingExample(input: Omit<ExpressionLearningCreateInput, "token">) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const { example } = await createExpressionLearningExample({
        ...input,
        token: adminToken,
      });
      await refreshAll();
      setSelectedId(example.id);
      setActiveTab("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function generatePractice(input: {
    scene: string;
    focus?: string | null;
  }): Promise<ExpressionLearningPracticeQuestionResponse | null> {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await generateExpressionLearningPracticeQuestion({
        ...input,
        token: adminToken,
      });
      await loadExercises();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function runBatchPracticeNow() {
    if (!adminToken) return;
    setBatching(true);
    setError(null);
    try {
      await runExpressionLearningPracticeBatchNow({ token: adminToken });
      await loadExercises();
      setActiveTab("exercises");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBatching(false);
    }
  }

  async function generateDraft(input: {
    scene: string;
    contextText: string;
  }): Promise<{ draftText: string; trainingRecordId: string | null } | null> {
    if (!adminToken) return null;
    setDrafting(true);
    setError(null);
    try {
      const result = await generateExpressionLearningDraft({
        ...input,
        token: adminToken,
      });
      return {
        draftText: result.draftText,
        trainingRecordId: result.trainingRecord?.id ?? null,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setDrafting(false);
    }
  }

  async function exportTraining(format: "json" | "jsonl") {
    if (!adminToken) return;
    setExporting(format);
    setError(null);
    try {
      const blob = await downloadExpressionLearningTrainingExport({
        token: adminToken,
        format,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `lusiyuan-expression-training-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  }

  async function analyzeTeaching(input: Omit<ExpressionLearningCreateInput, "token">) {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await analyzeExpressionLearningExample({ ...input, token: adminToken });
      return result.analysis;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function saveTrainingDraft(
    input: Omit<ExpressionLearningTrainingDraftInput, "token">
  ): Promise<ExpressionLearningTrainingRecord | null> {
    if (!adminToken) return null;
    setWorking(true);
    setError(null);
    try {
      const result = await saveExpressionLearningTrainingDraft({
        ...input,
        token: adminToken,
      });
      await loadExercises();
      return result.record;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function deleteExercise(recordId: string) {
    if (!adminToken) return;
    if (!window.confirm("确认删除这道未完成的习题吗？删除后不可恢复。")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await deleteExpressionLearningTrainingRecord({ token: adminToken, recordId });
      await loadExercises();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  function editExercise(record: ExpressionLearningTrainingRecord) {
    setTeachingSeed({ record, revision: Date.now() });
    setActiveTab("manual");
  }

  async function deleteExample(exampleId: string) {
    if (!adminToken) return;
    if (!window.confirm("确认删除这条已停用经验吗？删除后不可恢复，对应习题也会一起删除。")) {
      return;
    }
    setWorking(true);
    setError(null);
    try {
      await deleteExpressionLearningExample({ token: adminToken, exampleId });
      if (selectedId === exampleId) {
        setSelectedId(null);
      }
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  const skippedRatio = state.summary.total > 0
    ? Math.round((state.summary.skipped / state.summary.total) * 100)
    : 0;
  const activeRatio = state.summary.total > 0
    ? Math.round((state.summary.active / state.summary.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      <Card className="admin-learning-hero overflow-hidden p-6 md:p-8" pattern="app-pink">
        <div className="flex flex-wrap items-center gap-2">
          <span className="admin-chip admin-chip-mint">
            <Icon name="icon-design" size={16} />
            Expression Learning
          </span>
          <span className="admin-chip admin-chip-pink">表达选择 · 不是人格</span>
          <span className="admin-chip admin-chip-yellow">不会改写长期记忆</span>
        </div>

        <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-black leading-tight text-[var(--ls-ink-strong)] md:text-[2.1rem]">
              表达学习
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[var(--ls-ink)] md:text-[0.95rem]">
              这里记录你如何修改、采用或放弃思源的回复。它学习的是表达选择，不会改写人格和长期记忆。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="default"
              size="middle"
              onClick={() => void exportTraining("json")}
              disabled={Boolean(exporting)}
              loading={exporting === "json"}
            >
              导出 JSON
            </Button>
            <Button
              type="default"
              size="middle"
              onClick={() => void exportTraining("jsonl")}
              disabled={Boolean(exporting)}
              loading={exporting === "jsonl"}
            >
              导出 JSONL
            </Button>
            <Button
              type="default"
              size="middle"
              onClick={() => void runBatchPracticeNow()}
              disabled={batching || working}
              loading={batching}
              icon={<Icon name="icon-camera" size={18} />}
            >
              立即批量出题
            </Button>
            <Button
              type="primary"
              size="middle"
              icon={<Icon name="icon-variant" size={18} />}
              onClick={() => void refreshAll()}
              disabled={loading}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="全部经验"
          value={state.summary.total}
          icon="icon-critterpedia"
          tone="app-blue"
          accent="学习过的所有表达笔记"
        />
        <Metric
          label="正在参与生成"
          value={state.summary.active}
          icon="icon-miles"
          tone="app-yellow"
          accent={`占总经验 ${activeRatio}% · 当前会影响回复`}
        />
        <Metric
          label="待审核"
          value={state.summary.pending}
          icon="icon-camera"
          tone="warm-peach-pink"
          accent="练习或导入结果，确认后才参与生成"
        />
        <Metric
          label="学会不回复"
          value={state.summary.skipped}
          icon="icon-variant"
          tone="app-green"
          accent={`占总经验 ${skippedRatio}% · 决定不答也是经验`}
        />
      </section>

      <LearningTabs active={activeTab} onChange={setActiveTab} />

      {error && (
        <div className="rounded-[20px] border-2 border-[var(--ls-pink)] bg-[var(--ls-pink-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-pink-text)]">
          {error}
        </div>
      )}

      {activeTab === "manual" && (
        <ManualTeachingPanel
          working={working}
          drafting={drafting}
          onCreate={(input) => void createTeachingExample(input)}
          onAnalyze={(input) => analyzeTeaching(input)}
          onGenerateQuestion={(input) => generatePractice(input)}
          onGenerateDraft={generateDraft}
          onSaveDraft={(input) => saveTrainingDraft(input)}
          editSeed={teachingSeed}
        />
      )}

      {activeTab === "exercises" && (
        <ExerciseLibraryPanel
          records={exerciseState.records}
          working={working}
          onEdit={editExercise}
          onDelete={(recordId) => void deleteExercise(recordId)}
          createdFrom={exerciseCreatedFrom}
          createdTo={exerciseCreatedTo}
          onCreatedFromChange={setExerciseCreatedFrom}
          onCreatedToChange={setExerciseCreatedTo}
          onClearDateFilter={() => {
            setExerciseCreatedFrom("");
            setExerciseCreatedTo("");
          }}
        />
      )}

      {activeTab === "library" && (
        <>
          <Card className="admin-select-host p-4 md:p-5" pattern="none">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
              <Icon name="icon-map" size={14} />
              筛选条件
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">场景</span>
                <AdminSelect
                  ariaLabel="场景"
                  value={scene}
                  onChange={setScene}
                  options={sceneFilterOptions(state.scenes)}
                />
              </label>
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">状态</span>
                <AdminSelect
                  ariaLabel="状态"
                  value={status}
                  onChange={setStatus}
                  options={[
                    { key: "all", label: "全部状态" },
                    { key: "pending", label: "待审核" },
                    { key: "active", label: "参与生成" },
                    { key: "disabled", label: "已停用" },
                  ]}
                />
              </label>
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">最终决定</span>
                <AdminSelect
                  ariaLabel="最终决定"
                  value={outcome}
                  onChange={setOutcome}
                  options={[
                    { key: "all", label: "全部决定" },
                    { key: "sent", label: "发布回复" },
                    { key: "skipped", label: "不回复" },
                  ]}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">搜索</span>
                <Input
                  value={query}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                  placeholder="情境、回复或经验"
                  className="h-10"
                  allowClear
                />
              </label>
            </div>
          </Card>

          <section className="grid min-h-[36rem] gap-5 2xl:grid-cols-[minmax(32rem,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
            <Icon name="icon-critterpedia" size={14} />
            <span>经验列表</span>
            <span className="admin-chip admin-chip-mint !py-0.5">{state.examples.length}</span>
            <span className="ml-auto text-[10px] font-semibold tracking-normal text-[var(--ls-ink-faint)]">点击切换查看</span>
          </div>

          {state.examples.map((example) => (
            <ExampleRow
              key={example.id}
              example={example}
              active={selected?.id === example.id}
              onSelect={() => setSelectedId(example.id)}
            />
          ))}

          {!loading && state.examples.length === 0 && (
            <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
              还没有表达经验。可以先用教学练习创建第一条。
            </div>
          )}
        </div>

        {selected ? (
          <ExpressionDetail
            key={selected.id}
            example={selected}
            working={working}
            onSave={(patch) => void save(selected.id, patch)}
            onDelete={() => void deleteExample(selected.id)}
            onReanalyze={() => void reanalyze(selected.id)}
          />
        ) : (
          <Card className="p-5" pattern="none">
            <p className="text-sm text-[var(--ls-ink-soft)]">选择一条经验查看详情。</p>
          </Card>
        )}
      </section>
        </>
      )}
    </div>
  );
}

function LearningTabs({
  active,
  onChange,
}: {
  active: LearningTab;
  onChange: (tab: LearningTab) => void;
}) {
  const tabs: Array<{ key: LearningTab; label: string; description: string; icon: IconName }> = [
    { key: "library", label: "经验库", description: "查看、审核和修正经验", icon: "icon-critterpedia" },
    { key: "exercises", label: "习题库", description: "继续编辑未完成题目", icon: "icon-camera" },
    { key: "manual", label: "教学练习", description: "出题、试答、分析、保存", icon: "icon-diy" },
  ];
  return (
    <Card className="grid gap-3 p-3 md:grid-cols-3" pattern="none">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`admin-stacked-tab-button ${
            active === tab.key ? "admin-stacked-tab-button-active" : ""
          }`}
        >
          <span className="admin-stacked-tab-icon">
            <Icon name={tab.icon} size={20} />
          </span>
          <span className="admin-stacked-tab-copy">
            <span className="admin-stacked-tab-title">{tab.label}</span>
            <span className="admin-stacked-tab-description">{tab.description}</span>
          </span>
        </button>
      ))}
    </Card>
  );
}

function ExerciseLibraryPanel({
  records,
  working,
  onEdit,
  onDelete,
  createdFrom,
  createdTo,
  onCreatedFromChange,
  onCreatedToChange,
  onClearDateFilter,
}: {
  records: ExpressionLearningTrainingRecord[];
  working: boolean;
  onEdit: (record: ExpressionLearningTrainingRecord) => void;
  onDelete: (recordId: string) => void;
  createdFrom: string;
  createdTo: string;
  onCreatedFromChange: (value: string) => void;
  onCreatedToChange: (value: string) => void;
  onClearDateFilter: () => void;
}) {
  const [scene, setScene] = useState("all");
  const sceneValues = records.map((record) => record.scene);
  const filteredRecords = scene === "all"
    ? records
    : records.filter((record) => record.scene === scene);

  return (
    <Card className="space-y-4 p-5" pattern="app-blue">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
            Exercise Library
          </div>
          <h3 className="mt-2 text-2xl font-black text-[var(--ls-ink-strong)]">习题库</h3>
          <p className="mt-2 text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            系统出的题和你保存过的手写题都会在这里。未完成题可以继续编辑，保存经验后状态跟随经验启用/停用。
          </p>
        </div>
        <span className="admin-chip admin-chip-mint">{records.length} 道题</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(12rem,16rem)_minmax(10rem,14rem)_minmax(10rem,14rem)_auto] lg:items-end">
        <label className="admin-select-below flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">场景</span>
          <AdminSelect
            ariaLabel="习题库场景"
            value={scene}
            onChange={setScene}
            options={sceneFilterOptions(sceneValues)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">出题开始</span>
          <Input
            type="date"
            value={createdFrom}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onCreatedFromChange(event.target.value)}
            className="h-10"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">出题结束</span>
          <Input
            type="date"
            value={createdTo}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onCreatedToChange(event.target.value)}
            className="h-10"
          />
        </label>
        <Button
          type="default"
          size="middle"
          onClick={onClearDateFilter}
          disabled={!createdFrom && !createdTo}
        >
          清除时间
        </Button>
      </div>

      <div className="space-y-2">
        {filteredRecords.map((record) => (
          <ExerciseRow
            key={record.id}
            record={record}
            working={working}
            onEdit={() => onEdit(record)}
            onDelete={() => onDelete(record.id)}
          />
        ))}

        {records.length === 0 && (
          <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            还没有习题。去教学练习里点一次“系统出题”，第一道题就会出现在这里。
          </div>
        )}

        {records.length > 0 && filteredRecords.length === 0 && (
          <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            当前场景下还没有习题。
          </div>
        )}
      </div>
    </Card>
  );
}

function ExerciseRow({
  record,
  working,
  onEdit,
  onDelete,
}: {
  record: ExpressionLearningTrainingRecord;
  working: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = exerciseStatus(record);
  const canEdit = !record.exampleId;
  return (
    <div className="admin-island-row px-4 py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-chip admin-chip-yellow">{sceneLabel(record.scene)}</span>
            <StatusPill active={status.active} label={status.label} />
            <span className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">
              出题 {formatTime(record.createdAt)}
            </span>
            {record.updatedAt !== record.createdAt && (
              <span className="text-[11px] font-semibold text-[var(--ls-ink-faint)]">
                更新 {formatTime(record.updatedAt)}
              </span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">
            {exerciseQuestionText(record)}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--ls-ink-muted)]">
            <span>表达场景</span>
            {record.finalText && (
              <>
                <span className="text-[var(--ls-3d-shadow)]">·</span>
                <span>已有你的回复</span>
              </>
            )}
            {analysisFromTrainingRecord(record) && (
              <>
                <span className="text-[var(--ls-3d-shadow)]">·</span>
                <span>已分析</span>
              </>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="primary" size="small" onClick={onEdit} disabled={working}>
              继续编辑
            </Button>
            <Button
              type="default"
              size="small"
              onClick={onDelete}
              disabled={working}
              className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]"
            >
              删除
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ScopeHelp() {
  return (
    <div className="grid gap-3 rounded-[20px] border-2 border-dashed border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4 text-xs font-semibold leading-6 text-[var(--ls-ink-muted)] md:grid-cols-3">
      <div>
        <span className="font-black text-[var(--ls-ink-strong)]">通用</span>
        <p className="mt-1">`general` 适合跨场景都能参考的表达经验。</p>
      </div>
      <div>
        <span className="font-black text-[var(--ls-ink-strong)]">聊天</span>
        <p className="mt-1">`chat` 适合私聊、Web Chat、微信、Telegram 这类对话。</p>
      </div>
      <div>
        <span className="font-black text-[var(--ls-ink-strong)]">回复评论</span>
        <p className="mt-1">`reply` 适合小红书、B 站等公开评论回复。</p>
      </div>
    </div>
  );
}

type TeachingForm = {
  scene: string;
  contextText: string;
  draftText: string;
  finalText: string;
  outcome: "sent" | "skipped" | "bad_question";
  ownerNote: string;
  status: "pending" | "active" | "disabled";
};

const defaultTeachingForm: TeachingForm = {
  scene: "general",
  contextText: "",
  draftText: "",
  finalText: "",
  outcome: "sent",
  ownerNote: "",
  status: "active",
};

type AnalysisEditForm = {
  lesson: string;
  reasoning: string;
  strategy: string;
  tone: string;
  avoidancesText: string;
  tagsText: string;
  confidence: number;
};

function listToText(value: string[]) {
  return value.join("\n");
}

function textToList(value: string) {
  return value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function analysisToEditForm(analysis: ExpressionLearningAnalysis): AnalysisEditForm {
  return {
    lesson: analysis.lesson,
    reasoning: analysis.reasoning,
    strategy: analysis.strategy,
    tone: analysis.tone,
    avoidancesText: listToText(analysis.avoidances),
    tagsText: listToText(analysis.tags),
    confidence: analysis.confidence,
  };
}

function editFormToAnalysis(form: AnalysisEditForm): ExpressionLearningAnalysis {
  return {
    lesson: form.lesson,
    reasoning: form.reasoning,
    strategy: form.strategy,
    tone: form.tone,
    avoidances: textToList(form.avoidancesText),
    tags: textToList(form.tagsText),
    confidence: form.confidence,
  };
}

function ManualTeachingPanel({
  working,
  drafting,
  onCreate,
  onAnalyze,
  onGenerateQuestion,
  onGenerateDraft,
  onSaveDraft,
  editSeed,
}: {
  working: boolean;
  drafting: boolean;
  onCreate: (input: Omit<ExpressionLearningCreateInput, "token">) => void;
  onAnalyze: (input: Omit<ExpressionLearningCreateInput, "token">) => Promise<ExpressionLearningAnalysis | null>;
  onGenerateQuestion: (input: {
    scene: string;
    focus?: string | null;
  }) => Promise<ExpressionLearningPracticeQuestionResponse | null>;
  onGenerateDraft: (input: {
    scene: string;
    contextText: string;
  }) => Promise<{ draftText: string; trainingRecordId: string | null } | null>;
  onSaveDraft: (
    input: Omit<ExpressionLearningTrainingDraftInput, "token">
  ) => Promise<ExpressionLearningTrainingRecord | null>;
  editSeed: TeachingSeed | null;
}) {
  const [form, setForm] = useState<Omit<TeachingForm, "scene" | "status">>({
    contextText: "",
    draftText: "",
    finalText: "",
    outcome: "sent",
    ownerNote: "",
  });
  const [focus, setFocus] = useState("");
  const [trainingRecordId, setTrainingRecordId] = useState<string | null>(null);
  const [generatedQuestion, setGeneratedQuestion] = useState<ExpressionLearningPracticeQuestion | null>(null);
  const [analysisForm, setAnalysisForm] = useState<AnalysisEditForm | null>(null);
  const [localMessage, setLocalMessage] = useState<string | null>(null);
  const [libForm] = Form.useForm<Pick<TeachingForm, "scene" | "status">>();

  useEffect(() => {
    if (!editSeed) return;
    const record = editSeed.record;
    const question = questionFromTrainingRecord(record);
    const analysis = analysisFromTrainingRecord(record);
    libForm.setFieldsValue({
      scene: record.scene || defaultTeachingForm.scene,
      status: record.example?.status === "disabled" ? "disabled" : defaultTeachingForm.status,
    });
    setTrainingRecordId(record.id);
    setGeneratedQuestion(question);
    setForm({
      contextText: record.contextText ?? question?.contextText ?? "",
      draftText: record.draftText ?? question?.draftText ?? "",
      finalText: record.finalText ?? "",
      outcome: record.status === "dismissed"
        ? "bad_question"
        : record.outcome === "skipped"
          ? "skipped"
          : "sent",
      ownerNote: record.ownerNote ?? record.reasonText ?? "",
    });
    setAnalysisForm(analysis ? analysisToEditForm(analysis) : null);
    setLocalMessage("已从习题库回填，可以继续编辑。");
  }, [editSeed, libForm]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setAnalysisForm(null);
    setLocalMessage(null);
  }

  function patchForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
    setAnalysisForm(null);
    setLocalMessage(null);
  }

  function currentGrid() {
    const grid = libForm.getFieldsValue();
    return {
      scene: grid.scene ?? defaultTeachingForm.scene,
      status: grid.status ?? defaultTeachingForm.status,
    };
  }

  function buildInput(analysis?: ExpressionLearningAnalysis): Omit<ExpressionLearningCreateInput, "token"> {
    const grid = currentGrid();
    const outcome = form.outcome === "skipped" ? "skipped" : "sent";
    return {
      trainingRecordId,
      sourceType: generatedQuestion ? "practice_answer" : "manual_teaching",
      scene: grid.scene,
      contextText: form.contextText,
      draftText: form.draftText || null,
      finalText: outcome === "skipped" ? null : form.finalText,
      outcome,
      ownerAction: outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: form.ownerNote || null,
      status: grid.status,
      analysis,
      metadata: generatedQuestion
        ? { tags: generatedQuestion.tags, teachingFocus: generatedQuestion.teachingFocus }
        : undefined,
    };
  }

  function buildTrainingDraftInput(
    analysis?: ExpressionLearningAnalysis | null
  ): Omit<ExpressionLearningTrainingDraftInput, "token"> {
    const grid = currentGrid();
    const isBadQuestion = form.outcome === "bad_question";
    const outcome: "sent" | "skipped" | null = form.outcome === "sent"
      ? "sent"
      : form.outcome === "skipped"
        ? "skipped"
        : null;
    return {
      recordId: trainingRecordId,
      sourceType: generatedQuestion ? "practice_question" : "manual_teaching",
      scene: grid.scene,
      status: "draft_saved",
      contextText: form.contextText,
      draftText: form.draftText || null,
      finalText: outcome === "sent" ? form.finalText : null,
      outcome,
      ownerAction: isBadQuestion ? null : outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: form.ownerNote || null,
      reasonText: form.ownerNote || null,
      generatedQuestion: generatedQuestion
        ? {
            ...generatedQuestion,
            contextText: form.contextText,
            draftText: form.draftText || null,
          }
        : undefined,
      generatedDraft: form.draftText
        ? { draftText: form.draftText }
        : undefined,
      analysisSnapshot: analysis ?? (analysisForm ? editFormToAnalysis(analysisForm) : undefined),
    };
  }

  async function saveDraft(
    analysis?: ExpressionLearningAnalysis | null,
    message = "草稿已保存到习题库。"
  ): Promise<ExpressionLearningTrainingRecord | null> {
    const record = await onSaveDraft(buildTrainingDraftInput(analysis));
    if (record) {
      setTrainingRecordId(record.id);
      setLocalMessage(message);
    }
    return record;
  }

  function submit() {
    if (!analysisForm) return;
    onCreate(buildInput(editFormToAnalysis(analysisForm)));
  }

  async function generateDraft() {
    const grid = currentGrid();
    const result = await onGenerateDraft({
      scene: grid.scene,
      contextText: form.contextText,
    });
    if (result?.draftText) {
      update("draftText", result.draftText);
      if (!trainingRecordId) {
        setTrainingRecordId(result.trainingRecordId);
      }
    }
  }

  async function generateQuestion() {
    const grid = currentGrid();
    const result = await onGenerateQuestion({
      scene: grid.scene,
      focus: focus || null,
    });
    if (!result) return;
    setGeneratedQuestion(result.question);
    setTrainingRecordId(result.trainingRecord.id);
    patchForm({
      contextText: result.question.contextText,
      draftText: result.question.draftText ?? "",
      finalText: "",
      ownerNote: "",
      outcome: "sent",
    });
    setLocalMessage("题目已生成，可以修改题目，也可以让思源重新试答。");
  }

  async function analyzeCurrent() {
    if (form.outcome === "bad_question") {
      await saveDraft(null, "已保存为草稿中，不会进入经验库。你可以在习题库继续编辑或删除。");
      setAnalysisForm(null);
      return;
    }
    const analysis = await onAnalyze(buildInput());
    if (analysis) {
      setAnalysisForm(analysisToEditForm(analysis));
      await saveDraft(analysis, "分析完成，习题已更新为草稿中。可以先修改下面的经验草稿，再保存。");
    }
  }

  const teachingSceneOptions = sceneOptions(editSeed?.record.scene ? [editSeed.record.scene] : []);

  return (
    <Card className="admin-select-host space-y-5 p-5" pattern="app-yellow">
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
          Teaching Practice
        </div>
        <h3 className="mt-2 text-2xl font-black text-[var(--ls-ink-strong)]">教学练习</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
          可以让系统出题，也可以自己写题；先决定该不该回复，再分析成经验，最后确认保存。
        </p>
      </div>

      <ScopeHelp />

      <Form
        form={libForm}
        layout="vertical"
        initialValues={{
          scene: defaultTeachingForm.scene,
          status: defaultTeachingForm.status,
        }}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Form.Item name="scene" label="场景">
            <AdminSelect
              ariaLabel="场景"
              options={teachingSceneOptions}
            />
          </Form.Item>
          <Form.Item name="status" label="保存状态">
            <AdminSelect
              ariaLabel="保存状态"
              options={[
                { key: "active", label: "保存后启用" },
                { key: "disabled", label: "保存后停用" },
                { key: "pending", label: "保存为待审核" },
              ]}
            />
          </Form.Item>
        </div>
      </Form>

      <div className="grid gap-3 rounded-[20px] border-2 border-dashed border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <TextField
          label="出题方向（可选）"
          value={focus}
          onChange={setFocus}
          placeholder="比如：拒绝、安抚、评论区回复、朋友开玩笑"
        />
        <Button
          type="primary"
          size="middle"
          onClick={generateQuestion}
          disabled={working}
          loading={working}
          icon={<Icon name="icon-camera" size={18} />}
        >
          系统出题
        </Button>
      </div>

      {generatedQuestion && (
        <DetailReadBlock
          label="这题想训练什么"
          value={`${generatedQuestion.teachingFocus}\n\n${generatedQuestion.expectedOwnerInput}`}
          icon="icon-map"
          tone="admin-chip-mint"
        />
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <EditField label="出题 / 情境" value={form.contextText} onChange={(value) => update("contextText", value)} rows={8} />
        <EditField
          label="陆思源试答（可选）"
          value={form.draftText}
          onChange={(value) => update("draftText", value)}
          rows={8}
          action={
            <Button
              type="default"
              size="small"
              onClick={generateDraft}
              disabled={drafting || !form.contextText.trim()}
              loading={drafting}
            >
              {drafting ? "试答中" : "让思源试答"}
            </Button>
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <SelectField
          label="最终决定"
          value={form.outcome}
          onChange={(value) => update("outcome", value as TeachingForm["outcome"])}
          options={[
            { key: "sent", label: "应该这样回复" },
            { key: "skipped", label: "不回复" },
            { key: "bad_question", label: "这题不好" },
          ]}
        />
        {form.outcome === "sent" ? (
          <EditField
            label="我希望的回复"
            value={form.finalText}
            onChange={(value) => update("finalText", value)}
            rows={5}
          />
        ) : (
          <div className="rounded-[18px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm font-semibold leading-7 text-[var(--ls-ink-muted)]">
            {form.outcome === "bad_question"
              ? "这题会被记录为坏题，不会生成经验。"
              : "不回复也可以成为经验，后面用补充说明解释原因。"}
          </div>
        )}
      </div>

      <EditField
        label={form.outcome === "bad_question" ? "补充说明：为什么这题不好" : "补充说明（可选）"}
        value={form.ownerNote}
        onChange={(value) => update("ownerNote", value)}
        rows={3}
      />

      {localMessage && (
        <div className="rounded-[18px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-ink-muted)]">
          {localMessage}
        </div>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="default"
          size="middle"
          onClick={() => void saveDraft(null)}
          disabled={working || !form.contextText.trim()}
          loading={working}
        >
          保存草稿
        </Button>
        <Button
          type="primary"
          size="middle"
          onClick={analyzeCurrent}
          disabled={working || !form.contextText.trim() || (form.outcome === "sent" && !form.finalText.trim())}
          loading={working}
          icon={<Icon name={form.outcome === "bad_question" ? "icon-variant" : "icon-diy"} size={18} />}
        >
          {form.outcome === "bad_question" ? "记录这题不好" : "分析"}
        </Button>
      </div>

      {analysisForm && (
        <AnalysisResultEditor
          value={analysisForm}
          onChange={setAnalysisForm}
          working={working}
          onSave={submit}
        />
      )}
    </Card>
  );
}

function AnalysisResultEditor({
  value,
  onChange,
  working,
  onSave,
}: {
  value: AnalysisEditForm;
  onChange: (value: AnalysisEditForm) => void;
  working: boolean;
  onSave: () => void;
}) {
  function update<K extends keyof AnalysisEditForm>(key: K, next: AnalysisEditForm[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="space-y-4 rounded-[22px] border-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-4">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle icon="icon-critterpedia">分析结果</SectionTitle>
        <span className="admin-chip admin-chip-mint">保存前可修改</span>
        <span className="ml-auto text-[11px] font-semibold text-[var(--ls-ink-muted)]">
          可信度 {Math.round(value.confidence * 100)}%
        </span>
      </div>
      <div className="grid gap-3">
        <EditField label="学到的经验" value={value.lesson} onChange={(next) => update("lesson", next)} rows={3} />
        <div className="grid gap-3 md:grid-cols-2">
          <EditField label="分析理由" value={value.reasoning} onChange={(next) => update("reasoning", next)} rows={4} />
          <EditField label="以后采用的策略" value={value.strategy} onChange={(next) => update("strategy", next)} rows={4} />
        </div>
        <EditField label="语气" value={value.tone} onChange={(next) => update("tone", next)} rows={2} />
        <div className="grid gap-3 md:grid-cols-2">
          <EditField label="应该避免" value={value.avoidancesText} onChange={(next) => update("avoidancesText", next)} rows={3} />
          <EditField label="检索标签" value={value.tagsText} onChange={(next) => update("tagsText", next)} rows={3} />
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          type="primary"
          size="middle"
          onClick={onSave}
          disabled={working || !value.lesson.trim()}
          loading={working}
          icon={<Icon name="icon-diy" size={18} />}
        >
          保存经验
        </Button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="field-input h-10"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ key: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <AdminSelect ariaLabel={label} value={value} onChange={onChange} options={options} />
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  tone,
  accent,
}: {
  label: string;
  value: number;
  icon: IconName;
  tone: CardColor;
  accent: string;
}) {
  return (
    <Card className="admin-learning-metric flex items-start gap-3 p-4 md:p-5" pattern={tone}>
      <span className="admin-learning-metric-icon">
        <Icon name={icon} size={22} bounce />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">{label}</span>
        <span className="mt-1 block text-3xl font-black leading-none text-[var(--ls-ink-strong)]">{value}</span>
        <span className="mt-2 block text-[11px] font-semibold leading-5 text-[var(--ls-ink-muted)]">{accent}</span>
      </span>
    </Card>
  );
}

function ExampleRow({
  example,
  active,
  onSelect,
}: {
  example: ExpressionLearningExample;
  active: boolean;
  onSelect: () => void;
}) {
  const confidence = Math.round(example.confidence * 100);
  const tone = example.outcome === "skipped" ? "admin-chip-pink" : "admin-chip-mint";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`admin-island-row admin-learning-row block w-full px-4 py-3.5 text-left transition ${
        active ? "is-active" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`admin-chip ${tone} shrink-0`}>
          {sceneLabel(example.scene)}
        </span>
        <StatusPill
          active={example.status === "active"}
          label={statusLabel(example.status)}
        />
        <span className="ml-auto shrink-0 text-[11px] font-semibold text-[var(--ls-ink-soft)] tabular-nums">
          {formatTime(example.updatedAt)}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-[var(--ls-ink-strong)]">
        {example.lesson}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[var(--ls-ink-muted)]">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Icon name="icon-chat" size={12} />
          {actionLabel(example.ownerAction)}
        </span>
        <span className="text-[var(--ls-3d-shadow)]">·</span>
        <span className="whitespace-nowrap">使用 {example.accessCount} 次</span>
        <span className="text-[var(--ls-3d-shadow)]">·</span>
        <span className="whitespace-nowrap">可信度 {confidence}%</span>
      </div>      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ls-panel)]">
        <div
          className="admin-learning-confidence h-full rounded-full"
          style={{ width: `${confidence}%` }}
        />
      </div>
    </button>
  );
}

function ExpressionDetail({
  example,
  working,
  onSave,
  onDelete,
  onReanalyze,
}: {
  example: ExpressionLearningExample;
  working: boolean;
  onSave: (patch: ExpressionLearningPatch) => void;
  onDelete: () => void;
  onReanalyze: () => void;
}) {
  const [lesson, setLesson] = useState(example.lesson);
  const [reasoning, setReasoning] = useState(example.reasoning ?? "");
  const [strategy, setStrategy] = useState(example.strategy ?? "");
  const [tone, setTone] = useState(example.tone ?? "");
  const avoidances = textList(example.avoidances);
  const tags = textList(example.tags);

  const isSkipped = example.outcome === "skipped";
  const confidence = Math.round(example.confidence * 100);

  return (
    <Card className="admin-learning-detail space-y-5 p-5" pattern="app-yellow">
      <DetailHeader
        example={example}
        working={working}
        confidence={confidence}
        onSave={onSave}
        onDelete={onDelete}
        onReanalyze={onReanalyze}
      />

      <DetailReadBlock
        label="当时情境"
        value={example.contextText}
        icon="icon-chat"
        tone="admin-chip-mint"
      />
      {example.draftText && (
        <DetailReadBlock
          label="思源原草稿"
          value={example.draftText}
          icon="icon-design"
          tone="admin-chip-yellow"
        />
      )}
      <DetailReadBlock
        label={isSkipped ? "你的最终决定" : "你最终发布的回复"}
        value={isSkipped ? "不回复" : example.finalText ?? ""}
        icon={isSkipped ? "icon-variant" : "icon-miles"}
        tone={isSkipped ? "admin-chip-pink" : "admin-chip-mint"}
      />
      <div>
        <div className="mb-3 flex items-center gap-3">
          <SectionTitle icon="icon-diy">编辑这条经验</SectionTitle>
          <span className="h-px flex-1 bg-[var(--ls-border)]" />
          <span className="text-[11px] font-semibold text-[var(--ls-ink-soft)]">修改后保存</span>
        </div>
        <div className="grid gap-3">
          <EditField label="学到的经验" value={lesson} onChange={setLesson} rows={3} />
          <div className="grid gap-3 md:grid-cols-2">
            <EditField label="分析理由" value={reasoning} onChange={setReasoning} rows={4} />
            <EditField label="以后采用的策略" value={strategy} onChange={setStrategy} rows={4} />
          </div>
          <EditField label="语气" value={tone} onChange={setTone} rows={2} />
        </div>
      </div>

      {(tags.length > 0 || avoidances.length > 0) && (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <SectionTitle icon="icon-map">检索与避雷</SectionTitle>
            <span className="h-px flex-1 bg-[var(--ls-border)]" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {tags.length > 0 && (
              <TagBlock label="检索标签" values={tags} tone="admin-chip-mint" />
            )}
            {avoidances.length > 0 && (
              <TagBlock label="应该避免" values={avoidances} tone="admin-chip-pink" />
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t-2 border-dashed border-[var(--ls-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <EmbeddingHint status={example.embeddingStatus} />
        <Button
          type="primary"
          size="middle"
          onClick={() => onSave({ lesson, reasoning, strategy, tone })}
          disabled={working || !lesson.trim()}
          loading={working}
          icon={<Icon name="icon-diy" size={18} />}
        >
          保存修正
        </Button>
      </div>
    </Card>
  );
}

function DetailHeader({
  example,
  working,
  confidence,
  onSave,
  onDelete,
  onReanalyze,
}: {
  example: ExpressionLearningExample;
  working: boolean;
  confidence: number;
  onSave: (patch: ExpressionLearningPatch) => void;
  onDelete: () => void;
  onReanalyze: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b-2 border-dashed border-[var(--ls-border)] pb-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--ls-ink-muted)]">
          <span className="admin-chip admin-chip-yellow">{sceneLabel(example.scene)}</span>
        </div>
        <h3 className="mt-2 text-2xl font-black leading-tight text-[var(--ls-ink-strong)]">
          {actionLabel(example.ownerAction)}
        </h3>
        <p className="mt-1 text-xs font-semibold text-[var(--ls-ink-muted)]">
          {outcomeLabel(example.outcome)} · 使用过 {example.accessCount} 次 · 可信度 {confidence}%
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {example.status === "disabled" && (
          <Button
            type="default"
            size="small"
            onClick={onDelete}
            disabled={working}
            className="!border-[var(--ls-pink)] !text-[var(--ls-pink-text)]"
          >
            删除经验
          </Button>
        )}
        <Button
          type="default"
          size="small"
          onClick={() => onSave({ status: example.status === "active" ? "disabled" : "active" })}
          disabled={working}
        >
          {example.status === "active" ? "停用经验" : "启用经验"}
        </Button>
        <Button
          type="primary"
          size="small"
          onClick={onReanalyze}
          disabled={working}
          icon={<Icon name="icon-variant" size={16} />}
        >
          {working ? "处理中" : "重新分析"}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--ls-ink-soft)]">
      <Icon name={icon} size={14} />
      {children}
    </div>
  );
}

function DetailReadBlock({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone: "admin-chip-mint" | "admin-chip-yellow" | "admin-chip-pink";
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={`admin-chip ${tone}`}>
          <Icon name={icon} size={12} />
          {label}
        </span>
      </div>
      <div className="mt-2 whitespace-pre-wrap rounded-[18px] border-2 border-[var(--ls-border)] border-l-[6px] border-l-[var(--ls-mint-light)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm font-semibold leading-7 text-[var(--ls-ink)]">
        {value}
      </div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  rows,
  action,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center justify-between gap-3 text-xs font-semibold text-[var(--ls-ink-soft)]">
        <span>{label}</span>
        {action}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="field-input resize-y text-sm leading-6"
      />
    </div>
  );
}

function TagBlock({
  label,
  values,
  tone,
}: {
  label: string;
  values: string[];
  tone: "admin-chip-mint" | "admin-chip-pink";
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <span key={value} className={`admin-chip ${tone}`}>{value}</span>
        ))}
      </div>
    </div>
  );
}

function EmbeddingHint({ status }: { status: string }) {
  const ready = status === "ready";
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ls-ink-muted)]">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          ready ? "bg-[var(--ls-mint)]" : "bg-[var(--ls-yellow)]"
        }`}
      />
      向量索引：{ready ? "可用" : status}
    </div>
  );
}
