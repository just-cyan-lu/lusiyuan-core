import { useEffect, useMemo, useState } from "react";
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
      <section className="mx-auto max-w-5xl rounded-lg border border-[#d9e2ec] bg-white p-7 shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
        <div className="text-xs font-semibold text-[#8a6f5a]">Conversation Trace</div>
        <h2 className="mt-3 text-3xl font-semibold text-[#172033]">对话追溯</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617188]">
          请先在顶部输入 Admin Token。这里会按现实身份查看渠道账号、会话和消息。
        </p>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Conversation Trace</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">对话追溯</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
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
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索现实身份 / 渠道 user / 显示名"
              className="field-input h-10 min-w-0"
            />
            <button
              type="submit"
              className="h-10 rounded-lg border border-[#c9d6e5] bg-[#f8fbff] px-4 text-sm font-medium text-[#334155] transition hover:bg-white"
            >
              搜索
            </button>
            <button
              type="button"
              onClick={() => void loadPeople(query)}
              className="h-10 rounded-lg border border-[#c9d6e5] bg-white px-4 text-sm font-medium text-[#334155] transition hover:bg-[#f8fbff]"
            >
              刷新
            </button>
          </form>
        </div>

        {state.error && (
          <div className="mt-5 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-4 py-3 text-sm text-[#8d6048]">
            {state.error}
          </div>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#172033]">现实身份</h3>
              <p className="mt-1 text-xs text-[#7b8ca2]">
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
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#a9bfd7] bg-[#eaf2fb] shadow-sm"
                        : "border-[#d9e2ec] bg-[#f8fbff] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-[#172033]">
                            {personLabel(person.person)}
                          </span>
                          {person.isOwner && (
                            <span className="rounded-full border border-[#b9d8c7] bg-[#eef8f2] px-2 py-0.5 text-[11px] font-medium text-[#3f7b5d]">
                              owner
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[#7b8ca2]">
                          {person.relationship?.relationshipLabel ?? "暂无关系状态"}
                        </div>
                        <div className="mt-1 truncate text-xs text-[#7b8ca2]">
                          {linkedUsersText(person)}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-[#7b8ca2]">
                        <div>{formatDate(person.lastMessageAt)}</div>
                        <div className="mt-1">{person.messageCount} 条</div>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                {state.loadingList ? "正在读取现实身份..." : "暂无结果。"}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          {state.detail ? (
            <>
              <section className="rounded-lg border border-[#d9e2ec] bg-white p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs font-semibold text-[#8a6f5a]">现实身份详情</div>
                    <h3 className="mt-2 text-2xl font-semibold text-[#172033]">
                      {detailPersonLabel(state.detail)}
                    </h3>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#66758a]">
                      <span>{state.detail.relationship?.relationshipLabel ?? "暂无关系状态"}</span>
                      <span>·</span>
                      <span>最近消息 {formatDate(state.detail.lastMessageAt)}</span>
                      {state.detail.isOwner && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-[#3f7b5d]">owner</span>
                        </>
                      )}
                    </div>
                  </div>
                  {state.detail.relationship && (
                    <button
                      type="button"
                      onClick={() => {
                        if (state.detail?.relationship?.id) {
                          onOpenRelationship?.(state.detail.relationship.id);
                        }
                      }}
                      className="h-10 rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7]"
                    >
                      查看关系详情
                    </button>
                  )}
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
                  <h3 className="text-base font-semibold text-[#172033]">渠道账号与会话</h3>
                  <div className="mt-4 grid gap-4">
                    {state.detail.users.map((userDetail) => (
                      <div
                        key={userDetail.user.id}
                        className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[#172033]">
                              {userDetail.user.displayName ?? userDetail.user.externalId}
                            </div>
                            <div className="mt-1 truncate text-xs text-[#7b8ca2]">
                              {userDetail.user.externalId}
                            </div>
                          </div>
                          {userDetail.isOwner && (
                            <span className="rounded-full border border-[#b9d8c7] bg-[#eef8f2] px-2 py-0.5 text-[11px] font-medium text-[#3f7b5d]">
                              owner
                            </span>
                          )}
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
                                  className={`rounded-lg border px-3 py-3 text-left transition ${
                                    active
                                      ? "border-[#a9bfd7] bg-[#eaf2fb]"
                                      : "border-[#d9e2ec] bg-white hover:bg-[#fdfefe]"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-medium text-[#172033]">
                                        {conversationTitle(conversation)}
                                      </div>
                                      <div className="mt-1 truncate text-xs text-[#7b8ca2]">
                                        {conversation.lastMessagePreview ?? "暂无消息"}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-right text-xs text-[#7b8ca2]">
                                      <div>{formatDate(conversation.lastMessageAt)}</div>
                                      <div className="mt-1">{conversation.messageCount} 条</div>
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-lg border border-dashed border-[#cdd9e6] bg-white px-3 py-4 text-sm text-[#7b8ca2]">
                              这个渠道账号还没有会话。
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-[#d9e2ec] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#172033]">消息记录</h3>
                      <p className="mt-1 text-xs text-[#7b8ca2]">
                        {selectedConversation
                          ? conversationTitle(selectedConversation)
                          : "请选择一个会话"}
                      </p>
                    </div>
                    <div className="rounded-full border border-[#d9e2ec] bg-[#f8fbff] px-3 py-1 text-xs text-[#66758a]">
                      {state.loadingMessages ? "读取中" : `${state.messages.length} 条`}
                    </div>
                  </div>

                  <div className="mt-4 grid max-h-[54rem] gap-3 overflow-y-auto pr-1">
                    {state.messages.length > 0 ? (
                      state.messages.map((message) => (
                        <article
                          key={message.id}
                          className={`rounded-lg border px-4 py-3 ${
                            message.role === "assistant"
                              ? "border-[#c9d7e6] bg-[#f8fbff]"
                              : "border-[#d9e2ec] bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 text-xs text-[#7b8ca2]">
                            <span className="font-semibold text-[#334155]">
                              {messageRoleLabel(message.role)}
                            </span>
                            <span>{formatDate(message.createdAt)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#172033]">
                            {message.content}
                          </p>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-6 text-sm text-[#7b8ca2]">
                        {state.loadingDetail || state.loadingMessages
                          ? "正在读取消息..."
                          : "暂无消息。"}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-lg border border-[#d9e2ec] bg-white px-5 py-8 text-sm text-[#7b8ca2]">
              {state.loadingDetail ? "正在读取现实身份详情..." : "选择一个现实身份后查看对话。"}
            </section>
          )}
        </div>
      </section>
    </div>
  );
}
