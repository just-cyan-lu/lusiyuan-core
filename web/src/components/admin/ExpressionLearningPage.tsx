import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Button, Card, Icon, Input, type CardColor, type IconName } from "animal-island-ui";
import { AdminSelect } from "./AdminFormPrimitives";
import {
  createExpressionLearningExample,
  downloadExpressionLearningTrainingExport,
  fetchExpressionLearningExamples,
  generateExpressionLearningDraft,
  generateExpressionLearningPracticeQuestion,
  reanalyzeExpressionLearningExample,
  updateExpressionLearningExample,
  type ExpressionLearningCreateInput,
  type ExpressionLearningExample,
  type ExpressionLearningPracticeQuestion,
  type ExpressionLearningResponse,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface Props {
  adminToken: string;
}

const emptyState: ExpressionLearningResponse = {
  examples: [],
  summary: { total: 0, active: 0, pending: 0, skipped: 0 },
  platforms: [],
};

type LearningTab = "library" | "manual" | "practice";

type ExpressionLearningPatch = Omit<
  Parameters<typeof updateExpressionLearningExample>[0],
  "token" | "exampleId"
>;

function platformLabel(value: string) {
  return value === "xiaohongshu" ? "小红书" : value === "chat" ? "聊天" : value;
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

export function ExpressionLearningPage({ adminToken }: Props) {
  const [activeTab, setActiveTab] = useState<LearningTab>("library");
  const [state, setState] = useState(emptyState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [exporting, setExporting] = useState<"json" | "jsonl" | null>(null);
  const [practiceQuestion, setPracticeQuestion] =
    useState<ExpressionLearningPracticeQuestion | null>(null);
  const [practiceTrainingRecordId, setPracticeTrainingRecordId] = useState<string | null>(null);
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
        platform,
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

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, platform, status, outcome, query]);

  async function save(exampleId: string, patch: ExpressionLearningPatch) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      await updateExpressionLearningExample({ ...patch, token: adminToken, exampleId });
      await load();
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
      await load();
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
      await load();
      setSelectedId(example.id);
      setActiveTab("library");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function generatePractice(input: { platform: string; scene: string; focus?: string | null }) {
    if (!adminToken) return;
    setWorking(true);
    setError(null);
    try {
      const result = await generateExpressionLearningPracticeQuestion({
        ...input,
        token: adminToken,
      });
      setPracticeQuestion(result.question);
      setPracticeTrainingRecordId(result.trainingRecord.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  }

  async function generateDraft(input: {
    platform: string;
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

  const skippedRatio = state.summary.total > 0
    ? Math.round((state.summary.skipped / state.summary.total) * 100)
    : 0;
  const activeRatio = state.summary.total > 0
    ? Math.round((state.summary.active / state.summary.total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
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
            <h2 className="text-3xl font-black leading-tight text-[#794f27] md:text-[2.1rem]">
              表达学习
            </h2>
            <p className="mt-3 text-sm font-semibold leading-7 text-[#725d42] md:text-[0.95rem]">
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
              type="primary"
              size="middle"
              icon={<Icon name="icon-variant" size={18} />}
              onClick={() => void load()}
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
        <div className="rounded-[20px] border-2 border-[#f8a6b2] bg-[#fde4e8] px-4 py-3 text-sm font-semibold leading-6 text-[#a85565]">
          {error}
        </div>
      )}

      {activeTab === "manual" && (
        <ManualTeachingPanel
          working={working}
          drafting={drafting}
          onCreate={(input) => void createTeachingExample(input)}
          onGenerateDraft={generateDraft}
        />
      )}

      {activeTab === "practice" && (
        <PracticePanel
          working={working}
          question={practiceQuestion}
          trainingRecordId={practiceTrainingRecordId}
          onGenerate={(input) => void generatePractice(input)}
          onCreate={(input) => void createTeachingExample(input)}
        />
      )}

      {activeTab === "library" && (
        <>
          <Card className="admin-select-host p-4 md:p-5" pattern="none">
            <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#9f927d]">
              <Icon name="icon-map" size={14} />
              筛选条件
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="admin-select-below flex flex-col gap-1">
                <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">平台</span>
                <AdminSelect
                  ariaLabel="平台"
                  value={platform}
                  onChange={setPlatform}
                  options={[
                    { key: "all", label: "全部平台" },
                    ...state.platforms.map((item) => ({ key: item, label: platformLabel(item) })),
                  ]}
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
          <div className="flex items-center gap-2 px-1 text-xs font-black uppercase tracking-wide text-[#9f927d]">
            <Icon name="icon-critterpedia" size={14} />
            <span>经验列表</span>
            <span className="admin-chip admin-chip-mint !py-0.5">{state.examples.length}</span>
            <span className="ml-auto text-[10px] font-semibold tracking-normal text-[#b9aa92]">点击切换查看</span>
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
            <div className="admin-island-soft-panel px-5 py-10 text-center text-sm font-semibold leading-7 text-[#8a7b66]">
              还没有表达经验。可以先用手动教学或练习出题创建第一条。
            </div>
          )}
        </div>

        {selected ? (
          <ExpressionDetail
            key={selected.id}
            example={selected}
            working={working}
            onSave={(patch) => void save(selected.id, patch)}
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
    { key: "manual", label: "手动教学", description: "直接教他某个情境怎么答", icon: "icon-diy" },
    { key: "practice", label: "练习出题", description: "让系统出题，你来回答", icon: "icon-camera" },
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

function ScopeHelp() {
  return (
    <div className="grid gap-3 rounded-[20px] border-2 border-dashed border-[#e8dcc8] bg-[#fff9e8] p-4 text-xs font-semibold leading-6 text-[#8a7b66] md:grid-cols-3">
      <div>
        <span className="font-black text-[#794f27]">平台</span>
        <p className="mt-1">这条经验属于哪个渠道，例如 `xiaohongshu`、`chat`、`general`。</p>
      </div>
      <div>
        <span className="font-black text-[#794f27]">场景</span>
        <p className="mt-1">平台里的具体任务，例如 `comment_reply`、`web_chat`、`boundary_reply`。</p>
      </div>
      <div>
        <span className="font-black text-[#794f27]">范围</span>
        <p className="mt-1">生效半径：全局、同平台、同场景，或仅存档不参与生成。</p>
      </div>
    </div>
  );
}

type TeachingForm = {
  platform: string;
  scene: string;
  scope: string;
  contextText: string;
  draftText: string;
  finalText: string;
  outcome: "sent" | "skipped";
  ownerNote: string;
  status: "pending" | "active" | "disabled";
};

const defaultTeachingForm: TeachingForm = {
  platform: "general",
  scene: "general",
  scope: "scene",
  contextText: "",
  draftText: "",
  finalText: "",
  outcome: "sent",
  ownerNote: "",
  status: "active",
};

function ManualTeachingPanel({
  working,
  drafting,
  onCreate,
  onGenerateDraft,
}: {
  working: boolean;
  drafting: boolean;
  onCreate: (input: Omit<ExpressionLearningCreateInput, "token">) => void;
  onGenerateDraft: (input: {
    platform: string;
    scene: string;
    contextText: string;
  }) => Promise<{ draftText: string; trainingRecordId: string | null } | null>;
}) {
  const [form, setForm] = useState<TeachingForm>(defaultTeachingForm);
  const [trainingRecordId, setTrainingRecordId] = useState<string | null>(null);

  function update<K extends keyof TeachingForm>(key: K, value: TeachingForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    onCreate({
      trainingRecordId,
      sourceType: "manual_teaching",
      platform: form.platform,
      scene: form.scene,
      scope: form.scope,
      contextText: form.contextText,
      draftText: form.draftText || null,
      finalText: form.outcome === "skipped" ? null : form.finalText,
      outcome: form.outcome,
      ownerAction: form.outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: form.ownerNote || null,
      status: form.status,
    });
  }

  async function generateDraft() {
    const result = await onGenerateDraft({
      platform: form.platform,
      scene: form.scene,
      contextText: form.contextText,
    });
    if (result?.draftText) {
      update("draftText", result.draftText);
      setTrainingRecordId(result.trainingRecordId);
    }
  }

  return (
    <Card className="admin-select-host space-y-5 p-5" pattern="app-yellow">
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-[#9f927d]">
          Manual Teaching
        </div>
        <h3 className="mt-2 text-2xl font-black text-[#794f27]">手动教学</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#8a7b66]">
          写一个具体情境，可以先让陆思源现场试答，再用你的最终回复或不回复理由教他。
        </p>
      </div>

      <ScopeHelp />

      <div className="grid gap-3 lg:grid-cols-4">
        <TextField label="平台" value={form.platform} onChange={(value) => update("platform", value)} />
        <TextField label="场景" value={form.scene} onChange={(value) => update("scene", value)} />
        <SelectField
          label="范围"
          value={form.scope}
          onChange={(value) => update("scope", value)}
          options={[
            { key: "global", label: "全局" },
            { key: "platform", label: "同平台" },
            { key: "scene", label: "同场景" },
            { key: "private", label: "仅存档" },
          ]}
        />
        <SelectField
          label="状态"
          value={form.status}
          onChange={(value) => update("status", value as TeachingForm["status"])}
          options={[
            { key: "active", label: "参与生成" },
            { key: "pending", label: "待审核" },
            { key: "disabled", label: "已停用" },
          ]}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <EditField label="情境 / 问题" value={form.contextText} onChange={(value) => update("contextText", value)} rows={8} />
        <EditField
          label="陆思源原草稿（可选）"
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
            { key: "skipped", label: "这个场景不回复" },
          ]}
        />
        <EditField
          label={form.outcome === "skipped" ? "为什么不回复" : "你希望采用的回复"}
          value={form.outcome === "skipped" ? form.ownerNote : form.finalText}
          onChange={(value) =>
            form.outcome === "skipped"
              ? update("ownerNote", value)
              : update("finalText", value)
          }
          rows={5}
        />
      </div>

      {form.outcome === "sent" && (
        <EditField
          label="补充说明（可选）"
          value={form.ownerNote}
          onChange={(value) => update("ownerNote", value)}
          rows={3}
        />
      )}

      <div className="flex justify-end">
        <Button
          type="primary"
          size="middle"
          onClick={submit}
          disabled={working || !form.contextText.trim() || (form.outcome === "sent" && !form.finalText.trim())}
          loading={working}
          icon={<Icon name="icon-diy" size={18} />}
        >
          分析并保存经验
        </Button>
      </div>
    </Card>
  );
}

function PracticePanel({
  working,
  question,
  trainingRecordId,
  onGenerate,
  onCreate,
}: {
  working: boolean;
  question: ExpressionLearningPracticeQuestion | null;
  trainingRecordId: string | null;
  onGenerate: (input: { platform: string; scene: string; focus?: string | null }) => void;
  onCreate: (input: Omit<ExpressionLearningCreateInput, "token">) => void;
}) {
  const [platform, setPlatform] = useState("general");
  const [scene, setScene] = useState("general");
  const [focus, setFocus] = useState("");
  const [outcome, setOutcome] = useState<"sent" | "skipped">("sent");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    setOutcome("sent");
    setAnswer("");
    setNote("");
  }, [trainingRecordId]);

  function submitAnswer() {
    if (!question) return;
    const ownerNote = [
      question.teachingFocus ? `练习重点：${question.teachingFocus}` : "",
      outcome === "skipped" && answer.trim() ? `不回复原因：${answer.trim()}` : "",
      note,
    ].filter(Boolean).join("\n\n");
    onCreate({
      trainingRecordId,
      sourceType: "practice_answer",
      platform: question.platform,
      scene: question.scene,
      scope: "scene",
      contextText: question.contextText,
      draftText: question.draftText,
      finalText: outcome === "skipped" ? null : answer,
      outcome,
      ownerAction: outcome === "skipped" ? "skipped" : "owner_taught",
      ownerNote: ownerNote || null,
      status: "active",
      metadata: { tags: question.tags, teachingFocus: question.teachingFocus },
    });
  }

  return (
    <Card className="admin-select-host space-y-5 p-5" pattern="app-blue">
      <div>
        <div className="text-xs font-black uppercase tracking-wide text-[#9f927d]">
          Practice Prompt
        </div>
        <h3 className="mt-2 text-2xl font-black text-[#794f27]">练习出题</h3>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-[#8a7b66]">
          让系统生成一个表达情境，你写下希望陆思源采用的回复。题目只是引子，真正的经验来自你的答案。
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-end">
        <TextField label="平台" value={platform} onChange={setPlatform} />
        <TextField label="场景" value={scene} onChange={setScene} />
        <TextField label="想练什么" value={focus} onChange={setFocus} placeholder="比如：边界感、幽默、安抚、技术解释" />
        <Button
          type="primary"
          size="middle"
          onClick={() => onGenerate({ platform, scene, focus: focus || null })}
          disabled={working}
          loading={working}
          icon={<Icon name="icon-camera" size={18} />}
        >
          生成题目
        </Button>
      </div>

      {question && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="space-y-3">
            <DetailReadBlock label="练习情境" value={question.contextText} icon="icon-chat" tone="admin-chip-mint" />
            {question.draftText && (
              <DetailReadBlock label="陆思源试答" value={question.draftText} icon="icon-design" tone="admin-chip-yellow" />
            )}
            <DetailReadBlock label="练习重点" value={question.teachingFocus} icon="icon-map" tone="admin-chip-pink" />
          </div>
          <div className="space-y-3 rounded-[20px] border-2 border-[#e8dcc8] bg-[#fff9e8] p-4">
            <SelectField
              label="你的决定"
              value={outcome}
              onChange={(value) => setOutcome(value as "sent" | "skipped")}
              options={[
                { key: "sent", label: "给出标准回复" },
                { key: "skipped", label: "这个场景不回复" },
              ]}
            />
            <EditField
              label={outcome === "skipped" ? "为什么不回复" : "你的标准回复"}
              value={answer}
              onChange={setAnswer}
              rows={7}
            />
            <EditField label="补充说明（可选）" value={note} onChange={setNote} rows={3} />
            <div className="flex justify-end">
              <Button
                type="primary"
                size="middle"
                onClick={submitAnswer}
                disabled={working || !answer.trim()}
                loading={working}
                icon={<Icon name="icon-diy" size={18} />}
              >
                保存这次练习
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
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
        <span className="block text-xs font-black uppercase tracking-wide text-[#9f927d]">{label}</span>
        <span className="mt-1 block text-3xl font-black leading-none text-[#794f27]">{value}</span>
        <span className="mt-2 block text-[11px] font-semibold leading-5 text-[#8a7b66]">{accent}</span>
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
          {platformLabel(example.platform)}
        </span>
        <StatusPill
          active={example.status === "active"}
          label={statusLabel(example.status)}
        />
        <span className="ml-auto shrink-0 text-[11px] font-semibold text-[#9f927d] tabular-nums">
          {formatTime(example.updatedAt)}
        </span>
      </div>

      <p className="mt-2 line-clamp-2 text-sm font-bold leading-6 text-[#794f27]">
        {example.lesson}
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[#8a7b66]">
        <span className="inline-flex items-center gap-1 whitespace-nowrap">
          <Icon name="icon-chat" size={12} />
          {actionLabel(example.ownerAction)}
        </span>
        <span className="text-[#d4c9b4]">·</span>
        <span className="whitespace-nowrap">使用 {example.accessCount} 次</span>
        <span className="text-[#d4c9b4]">·</span>
        <span className="whitespace-nowrap">可信度 {confidence}%</span>
      </div>      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#f7f3df]">
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
  onReanalyze,
}: {
  example: ExpressionLearningExample;
  working: boolean;
  onSave: (patch: ExpressionLearningPatch) => void;
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
          <span className="h-px flex-1 bg-[#e8dcc8]" />
          <span className="text-[11px] font-semibold text-[#9f927d]">修改后保存</span>
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
            <span className="h-px flex-1 bg-[#e8dcc8]" />
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

      <div className="flex flex-col gap-3 border-t-2 border-dashed border-[#e8dcc8] pt-4 sm:flex-row sm:items-center sm:justify-between">
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
  onReanalyze,
}: {
  example: ExpressionLearningExample;
  working: boolean;
  confidence: number;
  onSave: (patch: ExpressionLearningPatch) => void;
  onReanalyze: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-b-2 border-dashed border-[#e8dcc8] pb-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#8a7b66]">
          <span className="admin-chip admin-chip-yellow">{platformLabel(example.platform)}</span>
          <span>·</span>
          <span>{example.scene}</span>
        </div>
        <h3 className="mt-2 text-2xl font-black leading-tight text-[#794f27]">
          {actionLabel(example.ownerAction)}
        </h3>
        <p className="mt-1 text-xs font-semibold text-[#8a7b66]">
          {outcomeLabel(example.outcome)} · 使用过 {example.accessCount} 次 · 可信度 {confidence}%
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
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
    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#9f927d]">
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
      <div className="mt-2 whitespace-pre-wrap rounded-[18px] border-2 border-[#e8dcc8] border-l-[6px] border-l-[#82d5bb] bg-[#fff9e8] px-4 py-3 text-sm font-semibold leading-7 text-[#725d42]">
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
    <div className="flex items-center gap-2 text-xs font-semibold text-[#8a7b66]">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          ready ? "bg-[#19c8b9]" : "bg-[#f7cd67]"
        }`}
      />
      向量索引：{ready ? "可用" : status}
    </div>
  );
}
