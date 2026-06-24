import { useEffect, useMemo, useState } from "react";
import { Button } from "animal-island-ui";
import { AdminSelect } from "./AdminFormPrimitives";
import {
  fetchSkills,
  fetchXiaohongshuReplyConfig,
  generateXiaohongshuReplyDraft,
  resetXiaohongshuReplyConfig,
  saveXiaohongshuReplyConfig,
  type RegisteredSkill,
  type XiaohongshuReplyConfig,
  type XiaohongshuReplyResult,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type AccessMode = "off" | "owner_only" | "on";

interface SkillsAdminPageProps {
  adminToken: string;
  selectedSkillId?: string;
  onOpenSkill: (skillId: string) => void;
  onBackToList: () => void;
}

interface SkillsState {
  skills: RegisteredSkill[];
  xiaohongshuConfig: XiaohongshuReplyConfig | null;
  loading: boolean;
  saving: boolean;
  configSaving: boolean;
  error: string | null;
  message: string | null;
}

interface ReplyTesterForm {
  postTitle: string;
  postCaption: string;
  postType: string;
  comment: string;
  threadContext: string;
}

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新 Skills。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "Skill 操作失败";
}

function nextAccessMode(value: AccessMode): AccessMode {
  if (value === "on") return "owner_only";
  if (value === "owner_only") return "off";
  return "on";
}

function accessLabel(value: string | undefined): string {
  if (value === "off") return "off";
  if (value === "owner_only") return "owner only";
  if (value === "on") return "on";
  return "未配置";
}

function riskLabel(risk: string): string {
  if (risk === "ready") return "可人工采用";
  if (risk === "review") return "需要审核";
  if (risk === "skip") return "建议跳过";
  return risk;
}

export function SkillsAdminPage({
  adminToken,
  selectedSkillId,
  onOpenSkill,
  onBackToList,
}: SkillsAdminPageProps) {
  const [state, setState] = useState<SkillsState>({
    skills: [],
    xiaohongshuConfig: null,
    loading: false,
    saving: false,
    configSaving: false,
    error: null,
    message: null,
  });
  const [tester, setTester] = useState<ReplyTesterForm>({
    postTitle: "男大学生的发呆时间",
    postCaption: "他说自己不是在发呆，只是在想晚上吃什么。",
    postType: "daily",
    comment: "他怎么总是在发呆哈哈哈哈",
    threadContext: "",
  });
  const [replyResult, setReplyResult] = useState<XiaohongshuReplyResult | null>(null);
  const [testing, setTesting] = useState(false);

  const selectedSkill = useMemo(
    () => state.skills.find((skill) => skill.id === selectedSkillId) ?? null,
    [selectedSkillId, state.skills]
  );

  async function load() {
    if (!adminToken) return;
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const [skills, xiaohongshuConfig] = await Promise.all([
        fetchSkills(adminToken),
        fetchXiaohongshuReplyConfig(adminToken),
      ]);
      setState({
        skills: skills.skills,
        xiaohongshuConfig: xiaohongshuConfig.config,
        loading: false,
        saving: false,
        configSaving: false,
        error: null,
        message: null,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function saveReplyConfig(config: XiaohongshuReplyConfig) {
    if (!adminToken) return;
    setState((current) => ({ ...current, configSaving: true, error: null, message: null }));
    try {
      const result = await saveXiaohongshuReplyConfig({ token: adminToken, config });
      const skills = await fetchSkills(adminToken);
      setState((current) => ({
        ...current,
        skills: skills.skills,
        xiaohongshuConfig: result.config,
        configSaving: false,
        message: result.message ?? "小红书回复 Skill 配置已保存。",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        configSaving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function resetReplyConfig() {
    if (!adminToken) return;
    setState((current) => ({ ...current, configSaving: true, error: null, message: null }));
    try {
      const result = await resetXiaohongshuReplyConfig(adminToken);
      setState((current) => ({
        ...current,
        xiaohongshuConfig: result.config,
        configSaving: false,
        message: result.message ?? "小红书回复 Skill 配置已恢复默认。",
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        configSaving: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function runReplyTester() {
    if (!adminToken) return;
    setTesting(true);
    setReplyResult(null);
    try {
      const result = await generateXiaohongshuReplyDraft({
        token: adminToken,
        ...tester,
      });
      setReplyResult(result);
    } catch (error) {
      setState((current) => ({
        ...current,
        error: friendlyErrorMessage(error),
      }));
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  if (!adminToken) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Skills</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">Skill 管理</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。这里会显示系统能力、平台工作流和开关状态。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">
              {selectedSkill ? "Skill Detail" : "Skill Directory"}
            </div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">
              {selectedSkill ? selectedSkill.label : "Skill 管理"}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              {selectedSkill
                ? "这里管理这个 skill 的运行模式、prompt 和测试入口。"
                : "Skill 是正式工作流。现在的小红书回复 skill 会用 LLM 判断评论是否需要回复，并生成待审核草稿。"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSkill && (
              <Button type="default" onClick={onBackToList}>
                返回列表
              </Button>
            )}
            <Button type="default" loading={state.loading} onClick={() => void load()}>
              刷新
            </Button>
          </div>
        </div>

        {state.error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {state.error}
          </div>
        )}
        {state.message && (
          <div className="mt-5 rounded-lg border border-[#b9d8c7] bg-[#eef8f2] px-4 py-3 text-sm text-[#3f7b5d]">
            {state.message}
          </div>
        )}
      </section>

      {selectedSkill ? (
        <SkillDetail
          skill={selectedSkill}
          saving={state.saving}
          config={state.xiaohongshuConfig}
          configSaving={state.configSaving}
          tester={tester}
          testing={testing}
          replyResult={replyResult}
          onAccessModeChange={(mode) => {
            if (state.xiaohongshuConfig) {
              void saveReplyConfig({ ...state.xiaohongshuConfig, accessMode: mode });
            }
          }}
          onSaveReplyConfig={(config) => void saveReplyConfig(config)}
          onResetReplyConfig={() => void resetReplyConfig()}
          onTesterChange={setTester}
          onRunReplyTester={() => void runReplyTester()}
        />
      ) : (
        <SkillDirectory
          skills={state.skills}
          onOpenSkill={onOpenSkill}
        />
      )}
    </div>
  );
}

function SkillDirectory({
  skills,
  onOpenSkill,
}: {
  skills: RegisteredSkill[];
  onOpenSkill: (skillId: string) => void;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
      {skills.map((skill) => {
        const savedMode = skill.accessMode;
        return (
          <button
            key={skill.id}
            type="button"
            onClick={() => onOpenSkill(skill.id)}
            className="admin-layout-button group flex min-h-[17rem] w-full flex-col rounded-lg border border-[#d9e2ec] bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#a9bfd7] hover:shadow-[0_18px_44px_rgba(91,117,150,0.14)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-[#8a6f5a]">{skill.category}</div>
                <h3 className="mt-2 text-2xl font-semibold text-[#172033]">{skill.label}</h3>
              </div>
              <StatusPill active={skill.enabled} label={skill.enabled ? "运行中" : "已关闭"} />
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-7 text-[#617188]">{skill.description}</p>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <CompactMetric label="模式" value={accessLabel(savedMode)} />
              <CompactMetric label="入口" value={String(skill.entryPoints.length)} />
              <CompactMetric label="输出" value="草稿" />
            </div>
            <div className="mt-5 flex max-h-16 flex-wrap gap-2 overflow-hidden">
              {skill.profiles.map((profile) => (
                <span
                  key={profile.id}
                  className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#66758a]"
                >
                  {profile.label}
                </span>
              ))}
            </div>
            <div className="mt-auto flex items-center justify-between gap-3 border-t border-[#edf2f7] pt-4">
              <span className="text-xs text-[#7b8ca2]">点击查看详情</span>
              <span className="text-sm font-medium text-[#5f7fa7] transition group-hover:translate-x-0.5">
                进入详情
              </span>
            </div>
          </button>
        );
      })}
    </section>
  );
}

function SkillDetail({
  skill,
  saving,
  config,
  configSaving,
  tester,
  testing,
  replyResult,
  onAccessModeChange,
  onSaveReplyConfig,
  onResetReplyConfig,
  onTesterChange,
  onRunReplyTester,
}: {
  skill: RegisteredSkill;
  saving: boolean;
  config: XiaohongshuReplyConfig | null;
  configSaving: boolean;
  tester: ReplyTesterForm;
  testing: boolean;
  replyResult: XiaohongshuReplyResult | null;
  onAccessModeChange: (mode: AccessMode) => void;
  onSaveReplyConfig: (config: XiaohongshuReplyConfig) => void;
  onResetReplyConfig: () => void;
  onTesterChange: (tester: ReplyTesterForm) => void;
  onRunReplyTester: () => void;
}) {
  const savedMode = skill.accessMode;

  return (
    <section className="grid gap-5 xl:grid-cols-[1fr_0.86fr]">
      <div className="space-y-5">
        <section className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs font-semibold text-[#8a6f5a]">{skill.id}</div>
              <h3 className="mt-2 text-2xl font-semibold text-[#172033]">运行和边界</h3>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">{skill.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill active={skill.enabled} label={skill.enabled ? "运行中" : "已关闭"} />
              <Button
                type="primary"
                disabled={saving || configSaving || !config}
                onClick={() => onAccessModeChange(nextAccessMode(savedMode))}
              >
                切换为：{accessLabel(nextAccessMode(savedMode))}
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <InfoBlock title="当前运行" value={accessLabel(skill.accessMode)} />
            <InfoBlock title="配置来源" value="SkillConfig" />
            <InfoBlock title="保存方式" value="立即生效" />
          </div>
          <div className="mt-5 rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-4 py-3 text-sm leading-6 text-[#66758a]">
            {skill.disabledBehavior}
          </div>
        </section>

        <XiaohongshuPromptEditor
          key={config ? JSON.stringify(config) : "loading"}
          config={config}
          saving={configSaving}
          onSave={onSaveReplyConfig}
          onReset={onResetReplyConfig}
        />
      </div>

      <XiaohongshuReplyTester
        tester={tester}
        result={replyResult}
        testing={testing}
        onTesterChange={onTesterChange}
        onRun={onRunReplyTester}
      />
    </section>
  );
}

function XiaohongshuPromptEditor({
  config,
  saving,
  onSave,
  onReset,
}: {
  config: XiaohongshuReplyConfig | null;
  saving: boolean;
  onSave: (config: XiaohongshuReplyConfig) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<XiaohongshuReplyConfig | null>(config);

  if (!draft) {
    return (
      <section className="rounded-lg border border-dashed border-[#cdd9e6] bg-white p-5 text-sm text-[#66758a]">
        配置加载中。
      </section>
    );
  }

  return (
    <section className="admin-select-host rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">Prompt</div>
          <h3 className="mt-2 text-2xl font-semibold text-[#172033]">回复规范</h3>
          <p className="mt-2 text-sm leading-6 text-[#617188]">
            这里写的是小红书评论回复规范。LLM 会按它判断是否回复、风险和草稿正文。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="default" danger disabled={saving} onClick={onReset}>
            恢复默认
          </Button>
          <Button type="primary" loading={saving} onClick={() => onSave(draft)}>
            保存规范
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_9rem]">
        <div>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">账号模式</span>
          <AdminSelect
            ariaLabel="账号模式"
            value={draft.accountMode}
            onChange={(value) =>
              setDraft({ ...draft, accountMode: value as XiaohongshuReplyConfig["accountMode"] })
            }
            options={[
              { key: "mixed", label: "混合" },
              { key: "siyuan_first", label: "思源优先" },
              { key: "creator_first", label: "创作者优先" },
            ]}
          />
        </div>
        <label>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">最长字数</span>
          <input
            type="number"
            value={draft.maxReplyChars}
            onChange={(event) => setDraft({ ...draft, maxReplyChars: Number(event.target.value) })}
            className="field-input h-10"
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">Skill Prompt</span>
        <textarea
          value={draft.prompt}
          onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
          className="field-input min-h-[34rem] resize-y font-mono text-xs leading-6"
        />
      </label>
    </section>
  );
}

function XiaohongshuReplyTester({
  tester,
  result,
  testing,
  onTesterChange,
  onRun,
}: {
  tester: ReplyTesterForm;
  result: XiaohongshuReplyResult | null;
  testing: boolean;
  onTesterChange: (tester: ReplyTesterForm) => void;
  onRun: () => void;
}) {
  return (
    <section className="admin-select-host rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="text-xs font-semibold text-[#8a6f5a]">Test</div>
      <h3 className="mt-2 text-2xl font-semibold text-[#172033]">手动测试</h3>
      <p className="mt-3 text-sm leading-7 text-[#617188]">
        这里直接调用小红书回复 skill。结果是人可看的判断和草稿，不展示 JSON。
      </p>
      <div className="mt-5 grid gap-3">
        <FieldInput
          label="帖子标题"
          value={tester.postTitle}
          onChange={(value) => onTesterChange({ ...tester, postTitle: value })}
        />
        <label>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">帖子正文</span>
          <textarea
            value={tester.postCaption}
            onChange={(event) => onTesterChange({ ...tester, postCaption: event.target.value })}
            className="field-input min-h-24 resize-y leading-6"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">帖子类型</span>
          <AdminSelect
            ariaLabel="帖子类型"
            value={tester.postType}
            onChange={(value) => onTesterChange({ ...tester, postType: value })}
            options={[
              { key: "daily", label: "日常分享" },
              { key: "making", label: "创作过程" },
              { key: "technical", label: "技术制作" },
              { key: "thought", label: "想法与感受" },
              { key: "showcase", label: "作品展示" },
              { key: "announcement", label: "账号动态" },
              { key: "interactive", label: "互动讨论" },
            ]}
          />
        </div>
        <label>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">评论</span>
          <textarea
            value={tester.comment}
            onChange={(event) => onTesterChange({ ...tester, comment: event.target.value })}
            className="field-input min-h-24 resize-y leading-6"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">评论线程上下文</span>
          <textarea
            value={tester.threadContext}
            onChange={(event) => onTesterChange({ ...tester, threadContext: event.target.value })}
            className="field-input min-h-20 resize-y leading-6"
          />
        </label>
        <Button
          type="primary"
          loading={testing}
          disabled={!tester.postTitle.trim() || !tester.comment.trim()}
          onClick={onRun}
        >
          生成回复草稿
        </Button>
      </div>

      {result && (
        <div className="mt-5 rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill active={result.risk !== "skip"} label={riskLabel(result.risk)} />
            <span className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-xs text-[#66758a]">
              {result.comment_type}
            </span>
            <span className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-xs text-[#66758a]">
              {result.voice}
            </span>
          </div>
          <div className="mt-3 text-sm leading-6 text-[#66758a]">{result.reason}</div>
          <div className="mt-4 rounded-lg border border-[#d9e2ec] bg-white px-4 py-3 text-sm leading-7 text-[#172033]">
            {result.reply || "建议不回复。"}
          </div>
        </div>
      )}
    </section>
  );
}

function InfoBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-4 py-3">
      <div className="text-[11px] font-medium text-[#7b8ca2]">{title}</div>
      <div className="mt-1 text-sm font-semibold text-[#172033]">{value}</div>
    </div>
  );
}

function CompactMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-3 py-2">
      <div className="text-[11px] text-[#7b8ca2]">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-[#172033]">{value}</div>
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-input h-10"
      />
    </label>
  );
}
