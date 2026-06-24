import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Card, Icon, Input, type CardColor, type IconName } from "animal-island-ui";
import {
  fetchExpressionLearningExamples,
  reanalyzeExpressionLearningExample,
  updateExpressionLearningExample,
  type ExpressionLearningExample,
  type ExpressionLearningResponse,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

interface Props {
  adminToken: string;
}

const emptyState: ExpressionLearningResponse = {
  examples: [],
  summary: { total: 0, active: 0, skipped: 0 },
  platforms: [],
};

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
  } as Record<string, string>)[value] ?? value;
}

function outcomeLabel(value: string) {
  return ({
    sent: "发布了回复",
    skipped: "决定不回复",
  } as Record<string, string>)[value] ?? value;
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function ExpressionLearningPage({ adminToken }: Props) {
  const [state, setState] = useState(emptyState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [platform, setPlatform] = useState("all");
  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
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
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
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
          label="学会不回复"
          value={state.summary.skipped}
          icon="icon-variant"
          tone="app-green"
          accent={`占总经验 ${skippedRatio}% · 决定不答也是经验`}
        />
      </section>

      <Card className="p-4 md:p-5" pattern="none">
        <div className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#9f927d]">
          <Icon name="icon-map" size={14} />
          筛选条件
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <FilterSelect label="平台" value={platform} onChange={setPlatform}>
            <option value="all">全部平台</option>
            {state.platforms.map((item) => (
              <option key={item} value={item}>{platformLabel(item)}</option>
            ))}
          </FilterSelect>
          <FilterSelect label="状态" value={status} onChange={setStatus}>
            <option value="all">全部状态</option>
            <option value="active">参与生成</option>
            <option value="disabled">已停用</option>
          </FilterSelect>
          <FilterSelect label="最终决定" value={outcome} onChange={setOutcome}>
            <option value="all">全部决定</option>
            <option value="sent">发布回复</option>
            <option value="skipped">不回复</option>
          </FilterSelect>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">搜索</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="情境、回复或经验"
              className="h-10"
              allowClear
            />
          </label>
        </div>
      </Card>

      {error && (
        <div className="rounded-[20px] border-2 border-[#f8a6b2] bg-[#fde4e8] px-4 py-3 text-sm font-semibold leading-6 text-[#a85565]">
          {error}
        </div>
      )}

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
              还没有表达经验。小红书里记录一次最终回复或"不回复"决定后，这里就会出现第一条。
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
          label={example.status === "active" ? "参与生成" : "已停用"}
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
          {example.status === "active" ? "停用经验" : "重新启用"}
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

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field-input h-10">
        {children}
      </select>
    </label>
  );
}

function EditField({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="field-input resize-y text-sm leading-6"
      />
    </label>
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
