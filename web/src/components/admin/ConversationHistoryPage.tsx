import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Button, Card, Icon, Input } from "animal-island-ui";
import {
  fetchAdminConversationMessages,
  fetchConversationPeople,
  fetchConversationPersonDetail,
  type AdminConversationMessage,
  type ConversationPeopleResponse,
  type ConversationPersonDetailResponse,
  type ConversationPersonSummary,
  type ConversationSummary,
} from "../../api/lusiyuan-api";
import { StatusPill } from "./StatusPill";

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
  return `${conversation.channel} · ${conversation.externalConversationId}`;
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
    <div className="mx-auto max-w-7xl space-y-5">
      <Card className="overflow-hidden p-6 md:p-8" pattern="app-pink">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="admin-chip admin-chip-pink">
                <Icon name="icon-chat" size={18} />
                Conversation Trace
              </span>
              <span className="admin-chip admin-chip-mint">先看身份，再看消息</span>
            </div>
            <h2 className="mt-6 text-3xl font-black leading-tight text-[var(--ls-ink-strong)]">对话追溯</h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-[var(--ls-ink)] md:text-base">
              先按现实身份找人，再查看这个身份绑定的渠道账号、会话和消息。关系修改仍回关系页处理。
            </p>
          </div>

          <form
            className="flex w-full flex-col gap-2 sm:flex-row xl:w-[32rem]"
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
          <div className="mt-6 rounded-[22px] border-2 border-[var(--ls-pink)] bg-[var(--ls-pink-soft)] px-4 py-3 text-sm font-semibold leading-6 text-[var(--ls-pink-text)]">
            {state.error}
          </div>
        )}
      </Card>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <Card className="h-full p-5" pattern="app-yellow">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="admin-chip admin-chip-yellow">
                  <Icon name="icon-critterpedia" size={16} />
                  现实身份
                </span>
              </div>
              <h3 className="mt-3 text-base font-black text-[var(--ls-ink-strong)]">按人查对话</h3>
              <p className="mt-1 text-xs font-semibold text-[var(--ls-ink-soft)]">
                {state.loadingList ? "读取中" : `${state.people.length} 个结果`}
              </p>
            </div>
          </div>

          <div className="mt-4 grid max-h-[70rem] gap-3 overflow-y-auto pr-1">
            {state.people.length > 0 ? (
              state.people.map((person) => {
                const active = selectedPersonId === person.person.id;
                return (
                  <button
                    key={person.person.id}
                    type="button"
                    onClick={() => selectPerson(person.person.id)}
                    className={`admin-island-row w-full px-4 py-3 text-left transition ${
                      active ? "border-[var(--ls-mint)] bg-[var(--ls-mint-soft)]" : "hover:bg-[var(--ls-panel-soft)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-black text-[var(--ls-ink-strong)]">
                            {personLabel(person.person)}
                          </span>
                          {person.isOwner && <StatusPill active label="owner" />}
                        </div>
                        <div className="mt-1 text-xs font-semibold text-[var(--ls-ink-soft)]">
                          {person.relationship?.relationshipLabel ?? "暂无关系状态"}
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-[var(--ls-ink-soft)]">
                          {linkedUsersText(person)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs font-semibold text-[var(--ls-ink-soft)]">
                        <div>{formatDate(person.lastMessageAt)}</div>
                        <div className="mt-1">{person.messageCount} 条</div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="admin-island-soft-panel px-4 py-6 text-sm font-semibold text-[var(--ls-ink-muted)]">
                {state.loadingList ? "正在读取现实身份..." : "暂无结果。"}
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-5">
          {state.detail ? (
            <>
              <Card className="p-5" pattern="app-teal">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="admin-chip admin-chip-mint">
                        <Icon name="icon-miles" size={16} />
                        现实身份详情
                      </span>
                      {state.detail.isOwner && <StatusPill active label="owner" />}
                    </div>
                    <h3 className="mt-3 text-2xl font-black leading-tight text-[var(--ls-ink-strong)]">
                      {detailPersonLabel(state.detail)}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ls-ink-soft)]">
                      <span className="admin-chip admin-chip-yellow">
                        {state.detail.relationship?.relationshipLabel ?? "暂无关系状态"}
                      </span>
                      <span>·</span>
                      <span>最近消息 {formatDate(state.detail.lastMessageAt)}</span>
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

              <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <Card className="h-full p-5" pattern="app-pink">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="admin-chip admin-chip-pink">
                          <Icon name="icon-shopping" size={16} />
                          渠道账号
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-black text-[var(--ls-ink-strong)]">渠道账号与会话</h3>
                    </div>
                  </div>
                  <div className="grid gap-3">
                    {state.detail.users.map((userDetail) => (
                      <div key={userDetail.user.id} className="admin-island-row p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-[var(--ls-ink-strong)]">
                              {userDetail.user.displayName ?? userDetail.user.externalId}
                            </div>
                            <div className="mt-1 truncate text-xs font-semibold text-[var(--ls-ink-soft)]">
                              {userDetail.user.externalId}
                            </div>
                          </div>
                          {userDetail.isOwner && <StatusPill active label="owner" />}
                        </div>
                        <div className="mt-3 grid gap-2">
                          {userDetail.conversations.length > 0 ? (
                            userDetail.conversations.map((conversation) => {
                              const active = state.selectedConversationId === conversation.id;
                              return (
                                <button
                                  key={conversation.id}
                                  type="button"
                                  onClick={() => selectConversation(conversation.id)}
                                  className={`admin-island-row w-full px-3 py-3 text-left transition ${
                                    active
                                      ? "border-[var(--ls-mint)] bg-[var(--ls-mint-soft)]"
                                      : "hover:bg-[var(--ls-panel-soft)]"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-bold text-[var(--ls-ink)]">
                                        {conversationTitle(conversation)}
                                      </div>
                                      <div className="mt-1 truncate text-xs font-semibold text-[var(--ls-ink-soft)]">
                                        {conversation.lastMessagePreview ?? "暂无消息"}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs font-semibold text-[var(--ls-ink-soft)]">
                                      <div>{formatDate(conversation.lastMessageAt)}</div>
                                      <div className="mt-1">{conversation.messageCount} 条</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="admin-island-soft-panel px-3 py-4 text-sm font-semibold text-[var(--ls-ink-muted)]">
                              这个渠道账号还没有会话。
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card className="h-full p-5" pattern="app-yellow">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="admin-chip admin-chip-yellow">
                          <Icon name="icon-chat" size={16} />
                          消息记录
                        </span>
                      </div>
                      <h3 className="mt-3 text-base font-black text-[var(--ls-ink-strong)]">
                        {selectedConversation
                          ? conversationTitle(selectedConversation)
                          : "请选择一个会话"}
                      </h3>
                    </div>
                    <span className="admin-chip admin-chip-mint shrink-0">
                      {state.loadingMessages ? "读取中" : `${state.messages.length} 条`}
                    </span>
                  </div>

                  <div className="grid max-h-[54rem] gap-3 overflow-y-auto pr-1">
                    {state.messages.length > 0 ? (
                      state.messages.map((message) => {
                        const isAssistant = message.role === "assistant";
                        return (
                          <article
                            key={message.id}
                            className={`admin-island-row p-4 ${
                              isAssistant ? "bg-[var(--ls-yellow-soft)]/60" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className={`admin-chip ${
                                  isAssistant
                                    ? "admin-chip-yellow"
                                    : message.role === "tool"
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
                      <div className="admin-island-soft-panel px-4 py-6 text-sm font-semibold text-[var(--ls-ink-muted)]">
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
    </div>
  );
}
