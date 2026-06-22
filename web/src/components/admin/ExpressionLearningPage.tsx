import { useEffect, useMemo, useState, type ReactNode } from "react";
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
      <section className="border-b border-[#d9e2ec] pb-5">
        <div className="text-xs font-semibold text-[#8a6f5a]">Expression Learning</div>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-[#172033]">表达学习</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              这里记录你如何修改、采用或放弃思源的回复。它学习的是表达选择，不会改写人格和长期记忆。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="h-10 rounded-lg border border-[#c9d7e6] bg-white px-4 text-sm font-medium text-[#334155] transition hover:bg-[#f8fbff] disabled:opacity-60"
          >
            {loading ? "刷新中" : "刷新"}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="全部经验" value={state.summary.total} />
        <Metric label="正在参与生成" value={state.summary.active} />
        <Metric label="学会不回复" value={state.summary.skipped} />
      </section>

      <section className="grid gap-3 rounded-lg border border-[#d9e2ec] bg-white p-4 md:grid-cols-4">
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
        <label>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">搜索</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="情境、回复或经验"
            className="field-input h-10"
          />
        </label>
      </section>

      {error && <div className="rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">{error}</div>}

      <section className="grid min-h-[36rem] gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-2">
          {state.examples.map((example) => (
            <button
              type="button"
              key={example.id}
              onClick={() => setSelectedId(example.id)}
              className={`block w-full rounded-lg border p-4 text-left transition ${
                selected?.id === example.id
                  ? "border-[#9eb6d1] bg-[#eef5fb]"
                  : "border-[#d9e2ec] bg-white hover:border-[#b9c9da]"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#8a6f5a]">{platformLabel(example.platform)}</span>
                <StatusPill active={example.status === "active"} label={example.status === "active" ? "参与生成" : "已停用"} />
              </div>
              <div className="mt-3 line-clamp-2 text-sm font-medium leading-6 text-[#172033]">{example.lesson}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#7b8ca2]">
                <span>{actionLabel(example.ownerAction)}</span>
                <span>{formatTime(example.updatedAt)}</span>
              </div>
            </button>
          ))}
          {!loading && state.examples.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-[#f8fbff] px-5 py-10 text-sm leading-7 text-[#7b8ca2]">
              还没有表达经验。小红书里记录一次最终回复或“不回复”决定后，这里就会出现第一条。
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
          <div className="border-l border-[#e5edf5] px-5 py-10 text-sm text-[#7b8ca2]">选择一条经验查看详情。</div>
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
    <div className="space-y-5 border-l border-[#d9e2ec] pl-0 xl:pl-6">
      <div className="flex flex-col gap-3 border-b border-[#e5edf5] pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">{platformLabel(example.platform)} / {example.scene}</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">{actionLabel(example.ownerAction)}</h3>
          <div className="mt-2 text-xs text-[#7b8ca2]">可信度 {Math.round(example.confidence * 100)}% · 使用过 {example.accessCount} 次</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onSave({ status: example.status === "active" ? "disabled" : "active" })}
            disabled={working}
            className="h-9 rounded-lg border border-[#c9d7e6] bg-white px-3 text-xs font-medium text-[#334155] disabled:opacity-50"
          >
            {example.status === "active" ? "停用经验" : "重新启用"}
          </button>
          <button
            type="button"
            onClick={onReanalyze}
            disabled={working}
            className="h-9 rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-3 text-xs font-medium text-[#27496d] disabled:opacity-50"
          >
            {working ? "处理中" : "重新分析"}
          </button>
        </div>
      </div>

      <ReadBlock label="当时情境" value={example.contextText} />
      {example.draftText && <ReadBlock label="思源原草稿" value={example.draftText} />}
      <ReadBlock label={example.outcome === "skipped" ? "你的最终决定" : "你最终发布的回复"} value={example.outcome === "skipped" ? "不回复" : example.finalText ?? ""} />

      <div className="grid gap-4">
        <EditField label="学到的经验" value={lesson} onChange={setLesson} rows={3} />
        <EditField label="分析理由" value={reasoning} onChange={setReasoning} rows={4} />
        <EditField label="以后采用的策略" value={strategy} onChange={setStrategy} rows={3} />
        <EditField label="语气" value={tone} onChange={setTone} rows={2} />
      </div>

      {(tags.length > 0 || avoidances.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          <TagBlock label="检索标签" values={tags} />
          <TagBlock label="应该避免" values={avoidances} />
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[#e5edf5] pt-4">
        <span className="text-xs text-[#7b8ca2]">向量索引：{example.embeddingStatus === "ready" ? "可用" : example.embeddingStatus}</span>
        <button
          type="button"
          onClick={() => onSave({ lesson, reasoning, strategy, tone })}
          disabled={working || !lesson.trim()}
          className="h-10 rounded-lg border border-[#8da9c7] bg-[#6f8fb8] px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {working ? "保存中" : "保存修正"}
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-l-2 border-[#91aeca] bg-white px-4 py-3">
      <div className="text-xs text-[#7b8ca2]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#172033]">{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field-input h-10">
        {children}
      </select>
    </label>
  );
}

function ReadBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
      <div className="mt-2 whitespace-pre-wrap border-l-2 border-[#d5e0eb] pl-4 text-sm leading-7 text-[#334155]">{value}</div>
    </div>
  );
}

function EditField({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className="field-input resize-y text-sm leading-6" />
    </label>
  );
}

function TagBlock({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[#7b8ca2]">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => <span key={value} className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#66758a]">{value}</span>)}
      </div>
    </div>
  );
}
