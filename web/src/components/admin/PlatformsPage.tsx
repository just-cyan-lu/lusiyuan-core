import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "animal-island-ui";
import { AdminSelect } from "./AdminFormPrimitives";
import { SectionPanel } from "./AdminDetailPrimitives";
import {
  fetchSkills,
  fetchXiaohongshuImportStatus,
  fetchXiaohongshuPosts,
  generateXiaohongshuCommentReply,
  importXiaohongshuUrl,
  recordXiaohongshuFinalDecision,
  updateXiaohongshuComment,
  updateXiaohongshuPost,
  updateXiaohongshuReplyDraft,
  type RegisteredSkill,
  type XiaohongshuComment,
  type XiaohongshuImportStatus,
  type XiaohongshuPost,
  type XiaohongshuReplyDraft,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

type PlatformStatus = "ready" | "planning" | "placeholder";

interface PlatformSummary {
  id: string;
  name: string;
  subtitle: string;
  status: PlatformStatus;
  accent: string;
  description: string;
  capabilities: string[];
  metrics: Array<{ label: string; value: string }>;
}

interface PlatformsPageProps {
  onOpenPlatform: (platformId: string) => void;
}

interface XiaohongshuPlatformPageProps {
  adminToken: string;
  onBack: () => void;
  onOpenSkill: (skillId: string) => void;
}

type XiaohongshuPostPatch = Omit<
  Parameters<typeof updateXiaohongshuPost>[0],
  "token" | "postId"
>;

type XiaohongshuCommentPatch = Omit<
  Parameters<typeof updateXiaohongshuComment>[0],
  "token" | "commentId"
>;

const MAX_IMAGE_ALT_SLOTS = 30;

const platforms: PlatformSummary[] = [
  {
    id: "xiaohongshu",
    name: "小红书",
    subtitle: "评论、笔记、互动信号",
    status: "ready",
    accent: "#d86a50",
    description:
      "小红书账号镜像：保存帖子、评论线程和作者回复，并从 owner 的表达选择中持续学习。",
    capabilities: ["账号镜像", "评论管理", "回复草稿", "表达学习"],
    metrics: [
      { label: "连接", value: "同步就绪" },
      { label: "任务", value: "草稿 + 学习" },
      { label: "档案", value: "持续积累" },
    ],
  },
  {
    id: "bilibili",
    name: "B站",
    subtitle: "视频、评论、弹幕反馈",
    status: "planning",
    accent: "#6f8fb8",
    description:
      "后续可接视频评论、弹幕摘要、创作反馈整理。当前只保留平台入口位置。",
    capabilities: ["评论同步", "弹幕摘要", "创作反馈", "素材线索"],
    metrics: [
      { label: "连接", value: "规划中" },
      { label: "任务", value: "-" },
      { label: "日志", value: "-" },
    ],
  },
];

function statusText(status: PlatformStatus): string {
  if (status === "ready") return "已接入";
  if (status === "planning") return "规划中";
  return "占位中";
}

function statusClass(status: PlatformStatus): string {
  if (status === "ready") return "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]";
  if (status === "planning") return "border-[#d9e2ec] bg-[#f8fbff] text-[#66758a]";
  return "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34]";
}

function riskLabel(risk: string): string {
  if (risk === "ready") return "可人工采用";
  if (risk === "review") return "需审核";
  if (risk === "skip") return "跳过";
  return risk;
}

export function PlatformsPage({ onOpenPlatform }: PlatformsPageProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Platform Directory</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">平台工作台</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              平台自己的连接设置、读取能力、任务和日志放到各自详情页里，避免和通用工具混在一起。
            </p>
          </div>
          <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm text-[#66758a]">
            小红书通过 Chrome DevTools MCP 读取已登录浏览器，页面读取后会保留。
          </div>
        </div>
      </section>

      <section className="columns-1 gap-5 md:columns-2 xl:columns-3">
        {platforms.map((platform, index) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            tall={index % 2 === 0}
            onOpen={() => onOpenPlatform(platform.id)}
          />
        ))}
      </section>
    </div>
  );
}

function PlatformCard({
  platform,
  tall,
  onOpen,
}: {
  platform: PlatformSummary;
  tall: boolean;
  onOpen: () => void;
}) {
  const available = platform.id === "xiaohongshu";

  return (
    <article className="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: platform.accent }} />
      <div className={tall ? "p-5 md:p-6" : "p-5"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-[#7b8ca2]">{platform.subtitle}</div>
            <h3 className="mt-1 text-2xl font-semibold text-[#172033]">{platform.name}</h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusClass(platform.status)}`}>
            {statusText(platform.status)}
          </span>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#617188]">{platform.description}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {platform.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-3 py-2">
              <div className="text-[11px] text-[#7b8ca2]">{metric.label}</div>
              <div className="mt-1 truncate text-sm font-semibold text-[#172033]">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {platform.capabilities.map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-xs text-[#66758a]"
            >
              {capability}
            </span>
          ))}
        </div>

        {available ? (
          <Button type="primary" block className="mt-5" onClick={onOpen}>
            进入{platform.name}
          </Button>
        ) : (
          <div className="mt-5 flex h-10 w-full items-center justify-center rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 text-sm font-medium text-[#9aa8b8]">
            详情待规划
          </div>
        )}
      </div>
    </article>
  );
}

export function XiaohongshuPlatformPage({
  adminToken,
  onBack,
  onOpenSkill,
}: XiaohongshuPlatformPageProps) {
  const [skills, setSkills] = useState<RegisteredSkill[]>([]);
  const [posts, setPosts] = useState<XiaohongshuPost[]>([]);
  const [importStatus, setImportStatus] = useState<XiaohongshuImportStatus | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [importWarning, setImportWarning] = useState<string | null>(null);
  const [postTypes, setPostTypes] = useState<Record<string, string>>({
    daily: "日常分享",
    making: "创作过程",
    technical: "技术制作",
    thought: "想法与感受",
    showcase: "作品展示",
    announcement: "账号动态",
    interactive: "互动讨论",
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [savingDraftId, setSavingDraftId] = useState<string | null>(null);
  const [learningCommentId, setLearningCommentId] = useState<string | null>(null);
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [savingCommentId, setSavingCommentId] = useState<string | null>(null);

  const xiaohongshuReply = useMemo(
    () => skills.find((skill) => skill.id === "xiaohongshu_reply") ?? null,
    [skills]
  );
  const replyDraftAvailable = Boolean(xiaohongshuReply?.enabled);
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? posts[0] ?? null;
  const comments = selectedPost?.comments ?? [];
  const commentNodes = comments.flatMap((comment) => [comment, ...comment.replies]);
  const selectedComment =
    commentNodes.find((comment) => comment.id === selectedCommentId) ?? commentNodes[0] ?? null;

  async function load() {
    if (!adminToken) return;
    setLoading(true);
    setError(null);
    try {
      const [skillsResult, postsResult, statusResult] = await Promise.all([
        fetchSkills(adminToken),
        fetchXiaohongshuPosts(adminToken),
        fetchXiaohongshuImportStatus(adminToken),
      ]);
      setSkills(skillsResult.skills);
      setPosts(postsResult.posts);
      setPostTypes(postsResult.postTypes);
      setImportStatus(statusResult);
      if (!selectedPostId && postsResult.posts[0]) {
        setSelectedPostId(postsResult.posts[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function importUrl(url = sourceUrl) {
    if (!adminToken || !url.trim()) return;
    setImporting(true);
    setError(null);
    setImportWarning(null);
    try {
      const result = await importXiaohongshuUrl({
        token: adminToken,
        url: url.trim(),
      });
      setPosts(result.posts);
      setImportWarning(
        result.warning
        ?? (result.browser.expandedReplyGroups > 0
          ? `读取前已展开 ${result.browser.expandedReplyGroups} 组子回复。`
          : null)
      );
      const importedPost = result.posts.find((post) => post.externalId === result.importedPostId);
      if (importedPost) setSelectedPostId(importedPost.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  async function savePost(postId: string, patch: XiaohongshuPostPatch) {
    if (!adminToken) return;
    setSavingPostId(postId);
    setError(null);
    try {
      const result = await updateXiaohongshuPost({ ...patch, token: adminToken, postId });
      setPosts(result.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingPostId(null);
    }
  }

  async function saveComment(commentId: string, patch: XiaohongshuCommentPatch) {
    if (!adminToken) return;
    setSavingCommentId(commentId);
    setError(null);
    try {
      const result = await updateXiaohongshuComment({ ...patch, token: adminToken, commentId });
      setPosts(result.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingCommentId(null);
    }
  }

  async function generateReply(comment: XiaohongshuComment) {
    if (!adminToken) return;
    setGeneratingId(comment.id);
    setError(null);
    try {
      await generateXiaohongshuCommentReply({ token: adminToken, commentId: comment.id });
      setSelectedCommentId(comment.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingId(null);
    }
  }

  async function saveDraft(draft: XiaohongshuReplyDraft, content: string) {
    if (!adminToken) return;
    setSavingDraftId(draft.id);
    setError(null);
    try {
      await updateXiaohongshuReplyDraft({
        token: adminToken,
        draftId: draft.id,
        content,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingDraftId(null);
    }
  }

  async function recordFinalDecision(input: {
    comment: XiaohongshuComment;
    draft?: XiaohongshuReplyDraft | null;
    content?: string;
    outcome: "sent" | "skipped";
    ownerNote?: string;
  }) {
    if (!adminToken) return;
    setLearningCommentId(input.comment.id);
    setError(null);
    try {
      const result = await recordXiaohongshuFinalDecision({
        token: adminToken,
        commentId: input.comment.id,
        draftId: input.draft?.id ?? null,
        content: input.content ?? null,
        outcome: input.outcome,
        ownerNote: input.ownerNote ?? null,
      });
      setPosts(result.posts);
      setSelectedCommentId(input.comment.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLearningCommentId(null);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <Button type="default" onClick={onBack}>
          返回平台目录
        </Button>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Platform / Xiaohongshu</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">思源的小红书</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              这里保存真实账号的帖子、评论线程、草稿和作者回复。你每次修改、采用或放弃回复，都会成为可查看的表达经验。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill active={replyDraftAvailable} label={replyDraftAvailable ? "Skill 可用" : "Skill 关闭"} />
            <Button type="primary" onClick={() => onOpenSkill("xiaohongshu_reply")}>
              查看 Skill 详情
            </Button>
            <Button type="default" onClick={() => void load()} loading={loading}>
              {loading ? "刷新中" : "刷新"}
            </Button>
          </div>
        </div>
        {error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {error}
          </div>
        )}
        {importWarning && (
          <div className="mt-5 rounded-lg border border-[#e4d8b6] bg-[#fff9e8] px-4 py-3 text-sm leading-6 text-[#7d6a34]">
            {importWarning}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-5">
          <SectionPanel title="从小红书读取" subtitle="粘贴帖子 URL，读取当前页面已经加载的内容">
            <div className="grid gap-3">
              <FieldInput
                label="小红书帖子 URL"
                value={sourceUrl}
                onChange={setSourceUrl}
              />
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#66758a]">
                <StatusPill
                  active={Boolean(importStatus?.browserAvailable)}
                  label={importStatus?.browserAvailable ? "已连接登录浏览器" : "浏览器未连接"}
                />
                <span>
                  {importStatus?.connectionMode === "browser_url" ? "调试地址连接" : "自动连接当前 Chrome"}
                  ，读取后页面会保留。
                </span>
              </div>
              <Button
                type="primary"
                disabled={importing || !sourceUrl.trim() || !importStatus?.browserAvailable}
                onClick={() => void importUrl()}
              >
                {importing ? "正在读取页面" : "读取并记录帖子"}
              </Button>
              <p className="text-xs leading-6 text-[#7b8ca2]">
                系统不会刷新或滚动页面，只会有限展开当前已加载评论里的“展开 N 条回复”，读取后页面会保留。
              </p>
            </div>
          </SectionPanel>

          <SectionPanel title="帖子列表" subtitle={`${posts.length} 条帖子`}>
            <div className="grid gap-2">
              {posts.length > 0 ? posts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    setSelectedPostId(post.id);
                    setSelectedCommentId(null);
                  }}
                  className={`admin-layout-button block w-full px-4 py-3 text-left transition ${
                    selectedPost?.id === post.id
                      ? "is-active"
                      : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-[#172033]">{post.title}</div>
                  <div className="mt-1 text-xs text-[#66758a]">
                    {postTypes[post.postType] ?? post.postType} · {post.comments.length} 个评论线程
                    {post.source === "xiaohongshu_sync" ? " · 已同步" : " · 手动记录"}
                  </div>
                </button>
              )) : (
                <EmptyBlock>还没有帖子。粘贴真实小红书 URL 后会自动出现在这里。</EmptyBlock>
              )}
            </div>
          </SectionPanel>
        </div>

        <div className="space-y-5">
          <SectionPanel
            title={selectedPost ? selectedPost.title : "评论"}
            subtitle={selectedPost
              ? `${selectedPost.comments.length} 条顶层评论 · ${selectedPost.comments.reduce((total, comment) => total + comment.replies.length, 0)} 条子回复`
              : "先从 URL 读取一个帖子"}
          >
            {selectedPost ? (
              <div className="grid gap-4">
                <PostRecordEditor
                  key={`${selectedPost.id}:${selectedPost.updatedAt}`}
                  post={selectedPost}
                  postTypes={postTypes}
                  saving={savingPostId === selectedPost.id}
                  importing={importing}
                  onSave={(patch) => void savePost(selectedPost.id, patch)}
                  onReread={() => {
                    if (selectedPost.url) {
                      setSourceUrl(selectedPost.url);
                      void importUrl(selectedPost.url);
                    }
                  }}
                />

                <div className="grid gap-3">
                  {comments.length > 0 ? comments.map((thread) => (
                    <CommentThreadBlock
                      key={thread.id}
                      thread={thread}
                      selectedComment={selectedComment}
                      generatingId={generatingId}
                      savingDraftId={savingDraftId}
                      learningCommentId={learningCommentId}
                      skillEnabled={replyDraftAvailable}
                      onSelect={(comment) => setSelectedCommentId(comment.id)}
                      onGenerate={(comment) => void generateReply(comment)}
                      onSaveDraft={(draft, content) => void saveDraft(draft, content)}
                      onFinalDecision={(comment, input) => void recordFinalDecision({ comment, ...input })}
                      savingCommentId={savingCommentId}
                      onSaveComment={(comment, patch) => void saveComment(comment.id, patch)}
                    />
                  )) : (
                    <EmptyBlock>这个帖子下还没有记录评论。</EmptyBlock>
                  )}
                </div>
              </div>
            ) : (
              <EmptyBlock>先粘贴 URL 读取帖子，或从左侧选择已有帖子。</EmptyBlock>
            )}
          </SectionPanel>
        </div>
      </section>
    </div>
  );
}

function existingImageAlts(post: XiaohongshuPost): string[] {
  return Array.isArray(post.imageAlts)
    ? post.imageAlts.map((item) => typeof item === "string" ? item : "")
    : [];
}

function normalizeImageAltSlots(post: XiaohongshuPost): string[] {
  const existingAlts = existingImageAlts(post).slice(0, MAX_IMAGE_ALT_SLOTS);
  const storedCount = Math.min(Math.max(Math.trunc(post.imageCount || 0), 0), MAX_IMAGE_ALT_SLOTS);
  let lastFilledIndex = -1;
  existingAlts.forEach((alt, index) => {
    if (alt.trim()) lastFilledIndex = index;
  });

  const slotCount = Math.max(storedCount, lastFilledIndex + 1);
  return Array.from({ length: slotCount }, (_, index) => existingAlts[index] ?? "");
}

function PostRecordEditor({
  post,
  postTypes,
  saving,
  importing,
  onSave,
  onReread,
}: {
  post: XiaohongshuPost;
  postTypes: Record<string, string>;
  saving: boolean;
  importing: boolean;
  onSave: (patch: XiaohongshuPostPatch) => void;
  onReread: () => void;
}) {
  const [title, setTitle] = useState(post.title);
  const [caption, setCaption] = useState(post.caption ?? "");
  const [authorName, setAuthorName] = useState(post.authorName ?? "");
  const [postType, setPostType] = useState(post.postType);
  const [alts, setAlts] = useState(() => normalizeImageAltSlots(post));
  const [altsOpen, setAltsOpen] = useState(false);
  const filledAltCount = alts.filter((alt) => alt.trim()).length;

  function updateAlt(index: number, value: string) {
    setAlts((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  function addAltSlot() {
    setAlts((current) => current.length >= MAX_IMAGE_ALT_SLOTS ? current : [...current, ""]);
    setAltsOpen(true);
  }

  function removeAltSlot(index: number) {
    setAlts((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <section className="admin-select-host border-b border-[#d9e2ec] pb-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-semibold text-[#8a6f5a]">已读取的帖子内容</div>
          {post.url && (
            <a href={post.url} target="_blank" rel="noreferrer" className="mt-1 block max-w-xl truncate text-xs text-[#52769d] underline">
              {post.url}
            </a>
          )}
        </div>
        <Button
          size="small"
          type="default"
          disabled={importing || !post.url}
          onClick={onReread}
        >
          {importing ? "读取中" : "重新读取当前页面"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <FieldInput label="标题" value={title} onChange={setTitle} />
        <FieldInput label="作者" value={authorName} onChange={setAuthorName} />
        <div>
          <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">帖子类型</span>
          <AdminSelect
            ariaLabel="帖子类型"
            value={postType}
            onChange={setPostType}
            options={Object.entries(postTypes).map(([key, label]) => ({ key, label }))}
          />
        </div>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">帖子文案</span>
        <textarea value={caption} onChange={(event) => setCaption(event.target.value)} className="field-input min-h-36 resize-y text-sm leading-7" />
      </label>

      <div className="mt-4 overflow-hidden rounded-lg border border-[#d9e2ec] bg-[#f8fbff]">
        <button
          type="button"
          onClick={() => setAltsOpen((open) => !open)}
          className="admin-layout-button flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition"
        >
          <span>
            <span className="block text-xs font-semibold text-[#7b8ca2]">配图 Alt</span>
            <span className="mt-1 block text-xs text-[#66758a]">{alts.length} 个位置 · {filledAltCount} 个已填写</span>
          </span>
          <span className="shrink-0 rounded-md border border-[#c9d7e6] bg-white px-2.5 py-1 text-xs font-medium text-[#52769d]">
            {altsOpen ? "收起" : "展开"}
          </span>
        </button>
        {altsOpen && (
          <div className="border-t border-[#e5edf5] bg-white px-3 py-3">
            <div className="grid gap-2">
              {alts.length > 0 ? alts.map((alt, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[4rem_1fr_auto] sm:items-center">
                  <label htmlFor={`post-alt-${post.id}-${index}`} className="text-xs text-[#7b8ca2]">
                    第 {index + 1} 张
                  </label>
                  <input
                    id={`post-alt-${post.id}-${index}`}
                    value={alt}
                    onChange={(event) => updateAlt(index, event.target.value)}
                    placeholder="留空，之后由你补充"
                    className="field-input h-10"
                  />
                  <Button size="small" type="default" danger onClick={() => removeAltSlot(index)}>
                    删除
                  </Button>
                </div>
              )) : (
                <div className="rounded-lg border border-dashed border-[#d9e2ec] bg-[#f8fbff] px-3 py-4 text-xs text-[#7b8ca2]">
                  暂无配图 Alt 位置
                </div>
              )}
            </div>
            <Button
              size="small"
              type="default"
              disabled={alts.length >= MAX_IMAGE_ALT_SLOTS}
              onClick={addAltSlot}
              className="mt-3"
            >
              新增位置
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="primary"
          disabled={saving || !title.trim()}
          onClick={() => onSave({ title, caption, authorName, postType, imageCount: alts.length, imageAlts: alts })}
        >
          {saving ? "保存中" : "保存帖子修改"}
        </Button>
      </div>
    </section>
  );
}

function CommentRecordEditor({
  comment,
  saving,
  onSave,
}: {
  comment: XiaohongshuComment;
  saving: boolean;
  onSave: (patch: XiaohongshuCommentPatch) => void;
}) {
  const [authorName, setAuthorName] = useState(comment.authorName ?? "");
  const [content, setContent] = useState(comment.content);
  return (
    <div className="mt-3 grid gap-2">
      <FieldInput label="评论者" value={authorName} onChange={setAuthorName} />
      <label>
        <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">评论原文</span>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} className="field-input min-h-20 resize-y text-sm leading-6" />
      </label>
      <Button
        size="small"
        type="default"
        disabled={saving || !content.trim()}
        onClick={() => onSave({ authorName, content })}
      >
        {saving ? "保存中" : "保存评论修改"}
      </Button>
    </div>
  );
}

function CommentThreadBlock({
  thread,
  selectedComment,
  generatingId,
  savingDraftId,
  learningCommentId,
  skillEnabled,
  onSelect,
  onGenerate,
  onSaveDraft,
  onFinalDecision,
  savingCommentId,
  onSaveComment,
}: {
  thread: XiaohongshuComment;
  selectedComment: XiaohongshuComment | null;
  generatingId: string | null;
  savingDraftId: string | null;
  learningCommentId: string | null;
  skillEnabled: boolean;
  onSelect: (comment: XiaohongshuComment) => void;
  onGenerate: (comment: XiaohongshuComment) => void;
  onSaveDraft: (draft: XiaohongshuReplyDraft, content: string) => void;
  onFinalDecision: (comment: XiaohongshuComment, input: {
    draft?: XiaohongshuReplyDraft | null;
    content?: string;
    outcome: "sent" | "skipped";
    ownerNote?: string;
  }) => void;
  savingCommentId: string | null;
  onSaveComment: (comment: XiaohongshuComment, patch: XiaohongshuCommentPatch) => void;
}) {
  const threadNodes = [thread, ...thread.replies];
  const activeComment = threadNodes.find((comment) => comment.id === selectedComment?.id) ?? null;
  return (
    <article className={`rounded-lg border bg-white ${activeComment ? "border-[#a9bfd7]" : "border-[#d9e2ec]"}`}>
      <div className="p-4">
        <CommentSummary
          comment={thread}
          active={selectedComment?.id === thread.id}
          onSelect={() => onSelect(thread)}
        />
        {thread.replies.length > 0 && (
          <div className="ml-3 mt-3 border-l-2 border-[#dce6ef] pl-4">
            {thread.replies.map((reply) => (
              <div key={reply.id} className="border-t border-[#edf2f7] py-3 first:border-t-0 first:pt-0 last:pb-0">
                <CommentSummary
                  comment={reply}
                  active={selectedComment?.id === reply.id}
                  onSelect={() => onSelect(reply)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {activeComment && (
        <CommentActionPanel
          comment={activeComment}
          authorReplies={thread.replies.filter((reply) => reply.isAuthor && reply.replyToId === activeComment.id)}
          generating={generatingId === activeComment.id}
          savingDraftId={savingDraftId}
          learning={learningCommentId === activeComment.id}
          skillEnabled={skillEnabled}
          savingComment={savingCommentId === activeComment.id}
          onGenerate={() => onGenerate(activeComment)}
          onSaveDraft={onSaveDraft}
          onFinalDecision={(input) => onFinalDecision(activeComment, input)}
          onSaveComment={(patch) => onSaveComment(activeComment, patch)}
        />
      )}
    </article>
  );
}

function CommentSummary({
  comment,
  active,
  onSelect,
}: {
  comment: XiaohongshuComment;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className={`admin-layout-button block w-full text-left ${active ? "is-active" : ""}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#7b8ca2]">
        <span className={comment.isAuthor ? "font-semibold text-[#4f7d60]" : ""}>
          {comment.authorName || "未命名评论者"}
        </span>
        {comment.isAuthor && (
          <span className="border border-[#b9d4c1] bg-[#f1f8f3] px-1.5 py-0.5 text-[#4f7d60]">作者</span>
        )}
        {comment.replyToAuthorName && <span>回复 {comment.replyToAuthorName}</span>}
      </div>
      <div className="mt-1 text-sm leading-7">{comment.content}</div>
    </button>
  );
}

function CommentActionPanel({
  comment,
  authorReplies,
  generating,
  savingDraftId,
  learning,
  skillEnabled,
  savingComment,
  onGenerate,
  onSaveDraft,
  onFinalDecision,
  onSaveComment,
}: {
  comment: XiaohongshuComment;
  authorReplies: XiaohongshuComment[];
  generating: boolean;
  savingDraftId: string | null;
  learning: boolean;
  skillEnabled: boolean;
  savingComment: boolean;
  onGenerate: () => void;
  onSaveDraft: (draft: XiaohongshuReplyDraft, content: string) => void;
  onFinalDecision: (input: {
    draft?: XiaohongshuReplyDraft | null;
    content?: string;
    outcome: "sent" | "skipped";
    ownerNote?: string;
  }) => void;
  onSaveComment: (patch: XiaohongshuCommentPatch) => void;
}) {
  const latestDraft = comment.drafts[0];
  const hasAuthorReply = authorReplies.length > 0;
  return (
    <div className="border-t border-[#d9e2ec] bg-[#f8fbff] px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-[#66758a]">当前选中内容</span>
        <span className="text-xs text-[#7b8ca2]">
          {comment.isAuthor ? "作者回复" : hasAuthorReply ? `已有 ${authorReplies.length} 条作者回复` : comment.replyNeed}
        </span>
      </div>

      <details className="mt-3 border-t border-[#e5edf5] pt-3">
        <summary className="cursor-pointer text-xs font-medium text-[#66758a]">修改这条记录</summary>
        <CommentRecordEditor
          key={`${comment.id}:${comment.updatedAt}`}
          comment={comment}
          saving={savingComment}
          onSave={onSaveComment}
        />
      </details>

      {comment.isAuthor ? (
        <div className="mt-3 border-l-2 border-[#75a184] bg-[#f5faf7] px-4 py-3 text-sm leading-6 text-[#476451]">
          这是账号作者在真实评论线程中的回复，系统会保留它的回复目标，并用于表达学习。
        </div>
      ) : null}

      {comment.learningExample && (
        <div className="mt-3 border-l-2 border-[#91aeca] bg-[#f5f9fd] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#476986]">思源从这次互动中学到</span>
            <span className="text-xs text-[#718296]">
              {comment.learningExample.status === "active" ? "会参与以后生成" : "已停用"}
            </span>
          </div>
          <div className="mt-2 text-sm leading-6 text-[#334155]">{comment.learningExample.lesson}</div>
        </div>
      )}

      {latestDraft && (
        <div className="mt-3 rounded-lg border border-[#d9e2ec] bg-white p-3">
          <div className="mb-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#66758a]">
              {riskLabel(latestDraft.risk)}
            </span>
            <span className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-2.5 py-1 text-xs text-[#66758a]">
              {latestDraft.commentType}
            </span>
          </div>
          {latestDraft.risk === "skip" ? (
            <div className="text-sm leading-7 text-[#66758a]">建议不回复。</div>
          ) : (
            <DraftEditor
              key={latestDraft.id}
              draft={latestDraft}
              saving={savingDraftId === latestDraft.id || learning}
              onSave={onSaveDraft}
              onFinalDecision={onFinalDecision}
            />
          )}
          {latestDraft.reason && (
            <div className="mt-2 text-xs leading-5 text-[#7b8ca2]">{latestDraft.reason}</div>
          )}
        </div>
      )}


      {!comment.isAuthor && !latestDraft && !hasAuthorReply && (
        <OwnerReplyRecorder learning={learning} onFinalDecision={onFinalDecision} />
      )}

      {!comment.isAuthor && latestDraft?.risk === "skip" && !hasAuthorReply && (
        <OwnerReplyRecorder
          learning={learning}
          draft={latestDraft}
          onFinalDecision={onFinalDecision}
        />
      )}

      {!comment.isAuthor && (
        <Button
          type="primary"
          size="small"
          className="mt-3"
          disabled={!skillEnabled || generating}
          onClick={onGenerate}
        >
          {generating ? "生成中" : "让思源生成草稿"}
        </Button>
      )}
    </div>
  );
}

function DraftEditor({
  draft,
  saving,
  onSave,
  onFinalDecision,
}: {
  draft: XiaohongshuReplyDraft;
  saving: boolean;
  onSave: (draft: XiaohongshuReplyDraft, content: string) => void;
  onFinalDecision: (input: {
    draft?: XiaohongshuReplyDraft | null;
    content?: string;
    outcome: "sent" | "skipped";
    ownerNote?: string;
  }) => void;
}) {
  const [content, setContent] = useState(draft.content);
  const [ownerNote, setOwnerNote] = useState("");
  const changed = content.trim() !== draft.content.trim();

  return (
    <div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        className="field-input min-h-24 resize-y text-sm leading-7"
      />
      {draft.originalContent && draft.originalContent !== content && (
        <details className="mt-2 text-xs text-[#7b8ca2]">
          <summary className="cursor-pointer">查看思源最初生成的版本</summary>
          <div className="mt-2 border-l-2 border-[#d9e2ec] pl-3 leading-6">{draft.originalContent}</div>
        </details>
      )}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-semibold text-[#7b8ca2]">你为什么这样改（可不填）</span>
        <textarea
          value={ownerNote}
          onChange={(event) => setOwnerNote(event.target.value)}
          className="field-input min-h-16 resize-y text-xs leading-5"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="small"
          type="default"
          disabled={saving || !content.trim() || !changed}
          onClick={() => onSave(draft, content)}
        >
          {saving ? "保存中" : "只保存草稿"}
        </Button>
        <Button
          size="small"
          type="primary"
          disabled={saving || !content.trim()}
          onClick={() => onFinalDecision({ draft, content, outcome: "sent", ownerNote })}
        >
          记录已发布并学习
        </Button>
        <Button
          size="small"
          type="default"
          disabled={saving}
          onClick={() => onFinalDecision({ draft, outcome: "skipped", ownerNote })}
        >
          不回复并学习
        </Button>
      </div>
    </div>
  );
}

function OwnerReplyRecorder({
  draft,
  learning,
  onFinalDecision,
}: {
  draft?: XiaohongshuReplyDraft | null;
  learning: boolean;
  onFinalDecision: (input: {
    draft?: XiaohongshuReplyDraft | null;
    content?: string;
    outcome: "sent" | "skipped";
    ownerNote?: string;
  }) => void;
}) {
  const [content, setContent] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  return (
    <div className="mt-3 border-t border-[#e5edf5] pt-3">
      <div className="text-xs font-semibold text-[#7b8ca2]">记录你在真实小红书上的最终处理</div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="你已经以思源口吻发布的回复"
        className="field-input mt-2 min-h-20 resize-y text-sm leading-6"
      />
      <textarea
        value={ownerNote}
        onChange={(event) => setOwnerNote(event.target.value)}
        placeholder="为什么这样回复（可不填）"
        className="field-input mt-2 min-h-16 resize-y text-xs leading-5"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="small"
          type="primary"
          disabled={learning || !content.trim()}
          onClick={() => onFinalDecision({ draft, content, outcome: "sent", ownerNote })}
        >
          {learning ? "正在分析" : "记录已发布并学习"}
        </Button>
        <Button
          size="small"
          type="default"
          disabled={learning}
          onClick={() => onFinalDecision({ draft, outcome: "skipped", ownerNote })}
        >
          不回复并学习
        </Button>
      </div>
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

function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-[#f8fbff] px-4 py-6 text-sm leading-6 text-[#7b8ca2]">
      {children}
    </div>
  );
}
