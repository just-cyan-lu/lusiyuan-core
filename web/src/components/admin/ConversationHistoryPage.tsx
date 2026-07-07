import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Button, Card, Icon, Input } from "animal-island-ui";
import {
  fetchAdminConversationMessages,
  fetchConversationPeople,
  fetchConversationPersonDetail,
  updateAdminConversation,
  type AdminConversationMessage,
  type ConversationPeopleResponse,
  type ConversationPersonDetailResponse,
  type ConversationPersonSummary,
  type ConversationSummary,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";
import { ConversationNoteDialog } from "./ConversationNoteDialog";

interface ConversationHistoryPageProps {
  adminToken: string;
  personId?: string;
  onOpenPerson?: (personId: string) => void;
  onOpenRelationship?: (relationshipId: string) => void;
}

interface PageState {
  people: ConversationPersonSummary[];
  detail: ConversationPersonDetailResponse | null;
  messages: AdminConversationMessage[];
  selectedConversationId: string | null;
  loadingList: boolean;
  loadingDetail: boolean;
  loadingMessages: boolean;
  error: string | null;
}

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新对话记录。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "对话记录读取失败";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "暂无";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function personLabel(person: ConversationPersonSummary["person"]): string {
  return person.label ?? person.note ?? person.id;
}

function detailPersonLabel(detail: ConversationPersonDetailResponse): string {
  return detail.person.label ?? detail.person.note ?? detail.person.id;
}

function linkedUsersText(person: ConversationPersonSummary): string {
  if (person.identityLinks.length === 0) return "暂无渠道账号";
  return person.identityLinks
    .map((link) => link.user.displayName ?? link.user.externalId)
    .join(" / ");
}

function allConversations(detail: ConversationPersonDetailResponse | null): ConversationSummary[] {
  if (!detail) return [];
  return detail.users.flatMap((user) => user.conversations);
}

function conversationTitle(conversation: ConversationSummary): string {
  if (conversation.note?.trim()) return conversation.note.trim();
  const [prefix, id] = conversation.externalConversationId.split(":");
  if (!prefix || !id || id.length <= 12) return conversation.externalConversationId;
  return `${prefix}:${id.slice(0, 6)}…${id.slice(-4)}`;
}

function channelLabel(externalId: string): string {
  const channel = externalId.split(":")[0]?.trim().toLowerCase() ?? "";
  const labels: Record<string, string> = {
    web: "Web",
    xiaohongshu: "小红书",
    rednote: "小红书",
    telegram: "Telegram",
    tg: "Telegram",
    weixin: "微信",
    wx: "微信",
    bilibili: "B站",
    bili: "B站",
  };
  return labels[channel] ?? (channel || "未知");
}

function messageRoleLabel(role: string): string {
  if (role === "assistant") return "思源";
  if (role === "user") return "用户";
  if (role === "tool") return "工具";
  return role;
}

export function ConversationHistoryPage({
  adminToken,
  personId,
  onOpenPerson,
  onOpenRelationship,
}: ConversationHistoryPageProps) {
  const [query, setQuery] = useState("");
  const [localPersonId, setLocalPersonId] = useState<string | null>(null);
  const [noteDialog, setNoteDialog] = useState<{ conversationId: string; value: string } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [state, setState] = useState<PageState>({
    people: [],
    detail: null,
    messages: [],
    selectedConversationId: null,
    loadingList: false,
    loadingDetail: false,
    loadingMessages: false,
    error: null,
  });

  const selectedPersonId = personId ?? localPersonId;
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const selectedConversation = useMemo(
    () =>
      allConversations(state.detail).find(
        (conversation) => conversation.id === state.selectedConversationId
      ) ?? null,
    [state.detail, state.selectedConversationId]
  );

  async function loadPeople(nextQuery = query) {
    if (!adminToken) return;
    setState((current) => ({ ...current, loadingList: true, error: null }));
    try {
      const data: ConversationPeopleResponse = await fetchConversationPeople({
        token: adminToken,
        query: nextQuery,
        limit: 80,
      });
      setState((current) => ({ ...current, people: data.people, loadingList: false }));
      const currentSelected = personId ?? localPersonId;
      if (!currentSelected && data.people[0]) {
        setLocalPersonId(data.people[0].person.id);
      }
    } catch (error) {
      setState((current) => ({
        ...current,
        loadingList: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function loadDetail(nextPersonId: string) {
    if (!adminToken) return;
    setState((current) => ({
      ...current,
      detail: current.detail?.person.id === nextPersonId ? current.detail : null,
      messages: current.detail?.person.id === nextPersonId ? current.messages : [],
      loadingDetail: true,
      error: null,
    }));
    try {
      const detail = await fetchConversationPersonDetail({
        token: adminToken,
        personId: nextPersonId,
        conversationLimit: 80,
      });
      const conversations = allConversations(detail);
      setState((current) => {
        const selectedConversationId = conversations.some(
          (conversation) => conversation.id === current.selectedConversationId
        )
          ? current.selectedConversationId
          : conversations[0]?.id ?? null;
        return {
          ...current,
          detail,
          selectedConversationId,
          messages:
            selectedConversationId === current.selectedConversationId ? current.messages : [],
          loadingDetail: false,
        };
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loadingDetail: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  async function loadMessages(conversationId: string) {
    if (!adminToken) return;
    setState((current) => ({ ...current, loadingMessages: true, error: null }));
    try {
      const data = await fetchAdminConversationMessages({
        token: adminToken,
        conversationId,
        limit: 120,
      });
      setState((current) => ({
        ...current,
        messages: data.messages,
        loadingMessages: false,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loadingMessages: false,
        error: friendlyErrorMessage(error),
      }));
    }
  }

  function selectPerson(nextPersonId: string) {
    setLocalPersonId(nextPersonId);
    if (onOpenPerson) onOpenPerson(nextPersonId);
  }

  function selectConversation(conversationId: string) {
    setState((current) => ({
      ...current,
      selectedConversationId: conversationId,
      messages: conversationId === current.selectedConversationId ? current.messages : [],
    }));
  }

  function updateConversationInDetail(conversationId: string, patch: Partial<ConversationSummary>) {
    setState((current) => {
      if (!current.detail) return current;
      return {
        ...current,
        detail: {
          ...current.detail,
          users: current.detail.users.map((userDetail) => ({
            ...userDetail,
            conversations: userDetail.conversations.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, ...patch }
                : conversation
            ),
          })),
        },
      };
    });
  }

  function openNoteDialog(conversation: ConversationSummary) {
    setNoteDialog({
      conversationId: conversation.id,
      value: conversation.note ?? "",
    });
  }

  async function saveConversationNote() {
    if (!adminToken || !noteDialog) return;
    setIsSavingNote(true);
    setState((current) => ({ ...current, error: null }));
    try {
      const result = await updateAdminConversation({
        token: adminToken,
        conversationId: noteDialog.conversationId,
        note: noteDialog.value.trim() || null,
      });
      updateConversationInDetail(noteDialog.conversationId, {
        note: result.conversation.note,
        metadata: result.conversation.metadata,
        updatedAt: result.conversation.updatedAt,
      });
      setNoteDialog(null);
    } catch (error) {
      setState((current) => ({ ...current, error: friendlyErrorMessage(error) }));
    } finally {
      setIsSavingNote(false);
    }
  }

  useEffect(() => {
    if (!adminToken) return;
    void loadPeople("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    if (personId) setLocalPersonId(personId);
  }, [personId]);

  useEffect(() => {
    if (!selectedPersonId || !adminToken) return;
    void loadDetail(selectedPersonId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, selectedPersonId]);

  useEffect(() => {
    if (!state.selectedConversationId || !adminToken) return;
    void loadMessages(state.selectedConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken, state.selectedConversationId]);

  if (!adminToken) {
    return (
      <div className="mx-auto max-w-7xl space-y-5">
        <Card className="overflow-hidden p-6 md:p-8" pattern="app-pink">
          <div className="flex flex-wrap items-center gap-2">
            <span className="admin-chip admin-chip-pink">
              <Icon name="icon-chat" size={18} />
              Conversation Trace
            </span>
          </div>
          <h2 className="mt-6 text-3xl font-black leading-tight text-[var(--ls-ink-strong)]">对话追溯</h2>
          <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-[var(--ls-ink)] md:text-base">
            请先在顶部输入 Admin Token。这里会按现实身份查看渠道账号、会话和消息。
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[34rem] flex-col gap-5">
      <Card className="overflow-hidden p-5 md:p-6" pattern="app-pink">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="admin-chip admin-chip-pink">
                <Icon name="icon-chat" size={18} />
                Conversation Trace
              </span>
              <span className="admin-chip admin-chip-mint">先看身份，再看消息</span>
            </div>
            <h2 className="mt-4 text-2xl font-black leading-tight text-[var(--ls-ink-strong)] md:text-3xl">对话追溯</h2>
            <p className="mt-2 text-sm font-semibold leading-7 text-[var(--ls-ink)] md:text-base">
              左侧选现实身份，右侧直接看会话和消息。渠道账号和会话已经合并到同一区。
            </p>
          </div>

          <form
            className="flex w-full flex-col gap-2 sm:flex-row xl:w-[28rem]"
            onSubmit={(event) => {
              event.preventDefault();
              void loadPeople(query);
            }}
          >
            <Input
              value={query}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setQuery(event.target.value)
              }
              placeholder="搜索现实身份 / 渠道 user / 显示名"
              type="text"
              size="middle"
              shadow
              allowClear
              className="min-w-0 flex-1"
            />
            <Button
              type="primary"
              size="middle"
              icon={<Icon name="icon-critterpedia" size={18} />}
              onClick={() => void loadPeople(query)}
            >
              搜索
            </Button>
            <Button
              type="default"
              size="middle"
              icon={<Icon name="icon-variant" size={18} />}
              loading={state.loadingList}
              onClick={() => void loadPeople(query)}
            >
              刷新
            </Button>
          </form>
        </div>

        {state.error && (
          <div className="mt-4 rounded-[22px] border-2 border-[var(--ls-pink)] bg-[var(--ls-pink-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-pink-text)]">
            {state.error}
          </div>
        )}
      </Card>

      <section
        className={`grid min-h-0 flex-1 gap-5 transition-all duration-300 xl:items-stretch ${
          isSidebarOpen ? "xl:grid-cols-[16rem_1fr]" : "xl:grid-cols-[2.75rem_1fr]"
        }`}
      >
        <Card
          className={`flex h-full flex-col transition-all duration-300 ${
            isSidebarOpen ? "p-4" : "items-center px-2 py-3"
          }`}
          pattern="app-yellow"
        >
          {isSidebarOpen ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="admin-chip admin-chip-yellow">
                      <Icon name="icon-critterpedia" size={14} />
                      现实身份
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-black text-[var(--ls-ink-strong)]">按人查对话</h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--ls-ink-soft)]">
                    {state.loadingList ? "读取中" : `${state.people.length} 个结果`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="admin-icon-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border)] bg-white p-0 text-[var(--ls-ink-soft)] transition hover:bg-[var(--ls-panel-soft)]"
                  aria-label="收起列表"
                  title="收起列表"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
              </div>

              <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {state.people.length > 0 ? (
                  state.people.map((person) => {
                    const active = selectedPersonId === person.person.id;
                    return (
                      <button
                        key={person.person.id}
                        type="button"
                        onClick={() => selectPerson(person.person.id)}
                        className={`w-full rounded-lg border-2 px-3 py-2 text-left transition ${
                          active
                            ? "border-[var(--ls-mint)] bg-[var(--ls-mint-soft)]"
                            : "border-[var(--ls-border)] bg-white/40 hover:bg-[var(--ls-panel-soft)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="break-words text-sm font-black leading-tight text-[var(--ls-ink-strong)]">
                                {personLabel(person.person)}
                              </span>
                              {person.isOwner && <StatusPill active label="owner" />}
                            </div>
                            <div className="mt-1 break-words text-[11px] font-semibold leading-4 text-[var(--ls-ink-soft)]">
                              {person.relationship?.relationshipLabel ?? "暂无关系状态"}
                            </div>
                            <div className="break-words text-[11px] leading-4 text-[var(--ls-ink-soft)]">
                              {linkedUsersText(person)}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[10px] font-semibold text-[var(--ls-ink-soft)]">
                              {formatDate(person.lastMessageAt)}
                            </div>
                            <div className="text-[10px] font-bold text-[var(--ls-mint-text)]">
                              {person.messageCount} 条
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="admin-island-soft-panel rounded-xl px-3 py-5 text-sm font-semibold text-[var(--ls-ink-muted)]">
                    {state.loadingList ? "正在读取现实身份..." : "暂无结果。"}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="admin-icon-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border)] bg-white p-0 text-[var(--ls-ink-soft)] transition hover:bg-[var(--ls-panel-soft)]"
                aria-label="展开列表"
                title="展开现实身份列表"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <span className="text-[10px] font-black text-[var(--ls-ink-soft)] [writing-mode:vertical-rl]">身份</span>
              {selectedPersonId && (
                <span className="mt-1 h-2 w-2 rounded-full bg-[var(--ls-mint)]" />
              )}
            </div>
          )}
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          {state.detail ? (
            <>
              <Card className="p-4" pattern="app-teal">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="admin-chip admin-chip-mint">
                        <Icon name="icon-miles" size={16} />
                        现实身份
                      </span>
                      {state.detail.isOwner && <StatusPill active label="owner" />}
                      <span className="admin-chip admin-chip-yellow">
                        {state.detail.relationship?.relationshipLabel ?? "暂无关系状态"}
                      </span>
                    </div>
                    <h3 className="mt-2 text-xl font-black leading-tight text-[var(--ls-ink-strong)]">
                      {detailPersonLabel(state.detail)}
                    </h3>
                    <div className="mt-1 text-xs font-semibold text-[var(--ls-ink-soft)]">
                      最近消息 {formatDate(state.detail.lastMessageAt)}
                    </div>
                  </div>
                  {state.detail.relationship && (
                    <Button
                      type="primary"
                      size="middle"
                      icon={<Icon name="icon-chat" size={18} />}
                      onClick={() => {
                        if (state.detail?.relationship?.id) {
                          onOpenRelationship?.(state.detail.relationship.id);
                        }
                      }}
                    >
                      查看关系详情
                    </Button>
                  )}
                </div>
              </Card>

              <section className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(15rem,0.28fr)_1fr]">
                <Card className="flex h-full flex-col p-4" pattern="app-pink">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="admin-chip admin-chip-pink">
                      <Icon name="icon-shopping" size={16} />
                      渠道账号与会话
                    </span>
                    <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">
                      共 {state.detail.users.length} 个账号
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    {state.detail.users.map((userDetail) => (
                      <div key={userDetail.user.id} className="rounded-lg border-2 border-[var(--ls-border)] bg-white/40 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-[var(--ls-ink-strong)]">
                            {channelLabel(userDetail.user.externalId)}
                          </span>
                          <span className="break-words text-xs font-semibold leading-tight text-[var(--ls-ink-soft)]">
                            {userDetail.user.displayName ?? userDetail.user.externalId}
                          </span>
                          {userDetail.isOwner && <StatusPill active label="owner" />}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                          {userDetail.conversations.length > 0 ? (
                            userDetail.conversations.map((conversation) => {
                              const active = state.selectedConversationId === conversation.id;
                              return (
                                <div
                                  key={conversation.id}
                                  className={`flex w-full items-start gap-2 rounded-lg border-2 px-3 py-2 transition ${
                                    active
                                      ? "border-[var(--ls-mint)] bg-[var(--ls-mint-soft)]"
                                      : "border-[var(--ls-border)] bg-white/60 hover:bg-[var(--ls-panel-soft)]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => selectConversation(conversation.id)}
                                    className="min-w-0 flex-1 text-left"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="break-words text-xs font-black leading-tight text-[var(--ls-ink)]">
                                          {conversationTitle(conversation)}
                                        </div>
                                        <div className="break-words text-[10px] font-semibold leading-4 text-[var(--ls-ink-soft)]">
                                          {conversation.lastMessagePreview ?? "暂无消息"}
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-right text-[10px] font-semibold text-[var(--ls-ink-soft)]">
                                        <div>{conversation.messageCount} 条</div>
                                      </div>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    className="admin-layout-button inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--ls-border)] bg-white text-sm font-semibold text-[var(--ls-ink-soft)] transition hover:bg-[var(--ls-panel-soft)] hover:text-[var(--ls-ink-strong)]"
                                    onClick={() => openNoteDialog(conversation)}
                                    aria-label="编辑对话备注"
                                    title="编辑对话备注"
                                  >
                                    <span className="inline-block -scale-x-100">✎</span>
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs font-semibold text-[var(--ls-ink-muted)]">
                              这个渠道账号还没有会话。
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="flex h-full flex-col p-4" pattern="app-yellow">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="admin-chip admin-chip-yellow">
                          <Icon name="icon-chat" size={16} />
                          消息记录
                        </span>
                        {selectedConversation && (
                          <button
                            type="button"
                            className="admin-layout-button inline-flex items-center gap-1 rounded-full border border-[var(--ls-border)] bg-white px-2 py-1 text-xs font-semibold text-[var(--ls-ink-soft)] transition hover:bg-[var(--ls-panel-soft)] hover:text-[var(--ls-ink-strong)]"
                            onClick={() => openNoteDialog(selectedConversation)}
                          >
                            <span className="inline-block -scale-x-100">✎</span>
                            编辑备注
                          </button>
                        )}
                      </div>
                      <h3 className="mt-2 text-base font-black text-[var(--ls-ink-strong)]">
                        {selectedConversation
                          ? `${channelLabel(selectedConversation.externalConversationId)} · ${conversationTitle(selectedConversation)}`
                          : "请选择一个会话"}
                      </h3>
                    </div>
                    <span className="admin-chip admin-chip-mint shrink-0">
                      {state.loadingMessages ? "读取中" : `${state.messages.length} 条`}
                    </span>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
                    {state.messages.length > 0 ? (
                      state.messages.map((message) => {
                        const isAssistant = message.role === "assistant";
                        const isTool = message.role === "tool";
                        return (
                          <article
                            key={message.id}
                            className="rounded-xl border-2 border-[var(--ls-border)] bg-white/40 p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span
                                className={`admin-chip ${
                                  isAssistant
                                    ? "admin-chip-yellow"
                                    : isTool
                                      ? "admin-chip-mint"
                                      : "admin-chip-pink"
                                }`}
                              >
                                {messageRoleLabel(message.role)}
                              </span>
                              <span className="text-xs font-semibold text-[var(--ls-ink-soft)]">
                                {formatDate(message.createdAt)}
                              </span>
                            </div>
                            <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-[var(--ls-ink-strong)]">
                              {message.content}
                            </p>
                          </article>
                        );
                      })
                    ) : (
                      <div className="admin-island-soft-panel rounded-xl px-4 py-6 text-sm font-semibold text-[var(--ls-ink-muted)]">
                        {state.loadingDetail || state.loadingMessages
                          ? "正在读取消息..."
                          : "暂无消息。"}
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            </>
          ) : (
            <div className="admin-island-soft-panel px-5 py-8 text-sm font-semibold text-[var(--ls-ink-muted)]">
              {state.loadingDetail ? "正在读取现实身份详情..." : "选择一个现实身份后查看对话。"}
            </div>
          )}
        </div>
      </section>

      {noteDialog && (
        <ConversationNoteDialog
          value={noteDialog.value}
          saving={isSavingNote}
          onChange={(value) =>
            setNoteDialog((current) => current ? { ...current, value } : current)
          }
          onClose={() => setNoteDialog(null)}
          onSave={() => void saveConversationNote()}
        />
      )}
    </div>
  );
}
