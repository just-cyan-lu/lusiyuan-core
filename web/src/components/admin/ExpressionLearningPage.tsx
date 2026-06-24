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
  return {
    owner_written: "你直接写的",
    edited_draft: "修改草稿后发布",
    accepted_draft: "直接采用草稿",
    skipped: "决定不回复",
  }[value] ?? value;
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
    [selectedId, state.examples]
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

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Card className="overflow-hidden p-6 md:p-7" pattern="app-pink">
        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ls-ink-soft)]">
          <Icon name="icon-design" size={14} />
          <span>Expression Learning</span>
          <span className="admin-chip admin-chip-pink">表达选择 · 不是人格</span>
        </div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-[var(--ls-ink-strong)]">表达学习</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--ls-ink-soft)]">
              这里记录你如何修改、采用或放弃思源的回复。它学习的是表达选择，不会改写人格和长期记忆。
            </p>
          </div>
          <Button type="primary" size="middle" onClick={() => void load()} disabled={loading}>
            {loading ? "刷新中" : "刷新"}
          </Button>
        </div>
      </Card>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="全部经验" value={state.summary.total} pattern="app-blue" icon="icon-critterpedia" />
        <Metric label="正在参与生成" value={state.summary.active} pattern="app-yellow" icon="icon-miles" />
        <Metric label="学会不回复" value={state.summary.skipped} pattern="app-green" icon="icon-variant" />
      </section>

      <Card className="p-4 md:p-5" pattern="none">
        <div className="grid gap-3 md:grid-cols-4">
          <FilterSelect label="平台" value={platform} onChange={setPlatform}>
            <option value="all">全部平台</option>
            {state.platforms.map((item) => <option key={item} value={item}>{platformLabel(item)}</option>)}
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
            />
          </label>
        </div>
      </Card>

      {error && (
        <div className="admin-island-soft-panel border border-[var(--ls-orange)]/40 bg-[var(--ls-orange)]/10 px-4 py-3 text-sm text-[var(--ls-ink)]">
          {error}
        </div>
      )}

      <section className="grid min-h-[36rem] gap-5 2xl:grid-cols-[minmax(32rem,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0 space-y-2">
          {state.examples.map((example) => (
            <button
              type="button"
              key={example.id}
              onClick={() => setSelectedId(example.id)}
              className={`admin-island-row block w-full px-4 py-3 text-left transition ${
                selected?.id === example.id
                  ? "is-active"
                  : ""
              }`}
            >
              <div className="grid gap-2 md:grid-cols-[3.75rem_5rem_minmax(0,1fr)_5.75rem_7.5rem] md:items-center">
                <span className="admin-chip admin-chip-yellow self-start md:self-center">
                  {platformLabel(example.platform)}
                </span>
                <span className="min-w-0">
                  <StatusPill
                    active={example.status === "active"}
                    label={example.status === "active" ? "参与生成" : "已停用"}
                  />
                </span>
                <span className="line-clamp-2 min-w-0 text-sm font-medium leading-6 text-[var(--ls-ink-strong)]">
                  {example.lesson}
                </span>
                <span className="text-xs text-[var(--ls-ink-soft)]">{actionLabel(example.ownerAction)}</span>
                <span className="text-xs text-[var(--ls-ink-soft)] md:text-right">{formatTime(example.updatedAt)}</span>
              </div>
            </button>
          ))}
          {!loading && state.examples.length === 0 && (
            <div className="admin-island-soft-panel px-5 py-10 text-sm leading-7 text-[var(--ls-ink-soft)]">
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

  return (
    <Card className="space-y-5 p-5" pattern="app-yellow">
      <div className="flex flex-col gap-3 border-b border-[var(--ls-border)] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[var(--ls-ink-soft)]">
            <span className="admin-chip admin-chip-yellow">{platformLabel(example.platform)}</span>
            <span>·</span>
            <span>{example.scene}</span>
          </div>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--ls-ink-strong)]">{actionLabel(example.ownerAction)}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--ls-ink-soft)]">
            <span>可信度 {Math.round(example.confidence * 100)}%</span>
            <span>·</span>
            <span>使用过 {example.accessCount} 次</span>
          </div>
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
          >
            {working ? "处理中" : "重新分析"}
          </Button>
        </div>
      </div>

      <ReadBlock label="当时情境" value={example.contextText} />
      {example.draftText && <ReadBlock label="思源原草稿" value={example.draftText} />}
      <ReadBlock
        label={example.outcome === "skipped" ? "你的最终决定" : "你最终发布的回复"}
        value={example.outcome === "skipped" ? "不回复" : example.finalText ?? ""}
      />

      <div className="grid gap-4">
        <EditField label="学到的经验" value={lesson} onChange={setLesson} rows={3} />
        <EditField label="分析理由" value={reasoning} onChange={setReasoning} rows={4} />
        <EditField label="以后采用的策略" value={strategy} onChange={setStrategy} rows={3} />
        <EditField label="语气" value={tone} onChange={setTone} rows={2} />
      </div>

      {(tags.length > 0 || avoidances.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <TagBlock label="检索标签" values={tags} tone="admin-chip-mint" />
          <TagBlock label="应该避免" values={avoidances} tone="admin-chip-pink" />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--ls-border)] pt-4">
        <span className="text-xs text-[var(--ls-ink-soft)]">
          向量索引：{example.embeddingStatus === "ready" ? "可用" : example.embeddingStatus}
        </span>
        <Button
          type="primary"
          size="middle"
          onClick={() => onSave({ lesson, reasoning, strategy, tone })}
          disabled={working || !lesson.trim()}
        >
          {working ? "保存中" : "保存修正"}
        </Button>
      </div>
    </Card>
  );
}

function Metric({
  label,
  value,
  pattern,
  icon,
}: {
  label: string;
  value: number;
  pattern: CardColor;
  icon: IconName;
}) {
  return (
    <Card className="admin-island-row flex items-center gap-3 px-4 py-3" pattern={pattern}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/70 text-[var(--ls-ink-strong)]">
        <Icon name={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--ls-ink-soft)]">{label}</span>
        <span className="mt-1 block text-2xl font-semibold text-[var(--ls-ink-strong)]">{value}</span>
      </span>
    </Card>
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

function ReadBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-2 whitespace-pre-wrap rounded-md border-l-2 border-[var(--ls-mint)] bg-[var(--ls-panel-soft)] px-4 py-3 text-sm leading-7 text-[var(--ls-ink)]">
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
