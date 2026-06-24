import { useEffect, useMemo, useState } from "react";
import {
  fetchWebChatConversations,
  type WebChatConversationSummary,
} from "../api/lusiyuan-api";
import { useChat } from "../hooks/useChat";
import {
  createWebConversationIdentity,
  getWebIdentity,
  isWebConversationId,
  setWebIdentity,
  type WebIdentity,
} from "../utils/storage";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";

interface ChatPageProps {
  adminToken?: string;
}

function friendlyErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("fetch failed") || message.includes("Failed to fetch")) {
    return "Core API 暂未连接。启动后端服务后再刷新会话列表。";
  }
  if (message.includes("Unauthorized") || message.includes("401")) {
    return "Admin Token 不正确或未配置。";
  }
  return message || "Web Chat 会话读取失败";
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "暂无消息";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function shortConversationId(value: string): string {
  const [prefix, id] = value.split(":");
  if (!prefix || !id || id.length <= 12) return value;
  return `${prefix}:${id.slice(0, 8)}...${id.slice(-4)}`;
}

function identityFromConversation(conversation: WebChatConversationSummary): WebIdentity {
  return {
    userId: conversation.user.externalId,
    conversationId: conversation.externalConversationId,
  };
}

function userLabel(conversation: WebChatConversationSummary): string {
  return conversation.user.displayName ?? conversation.user.externalId;
}

function conversationLabel(conversation: WebChatConversationSummary): string {
  const preview = conversation.lastMessagePreview
    ? ` · ${conversation.lastMessagePreview}`
    : "";
  return `${formatDate(conversation.lastMessageAt)} · ${userLabel(conversation)} · ${conversation.externalConversationId} · ${conversation.messageCount} 条${preview}`;
}

export function ChatPage({ adminToken = "" }: ChatPageProps) {
  const [identity, setIdentity] = useState<WebIdentity>(() => getWebIdentity());
  const [conversations, setConversations] = useState<WebChatConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const { messages, isSending, isLoadingHistory, error, sendMessage } = useChat(identity);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.externalConversationId === identity.conversationId
      ) ?? null,
    [conversations, identity.conversationId]
  );

  function applyIdentity(nextIdentity: WebIdentity) {
    setWebIdentity(nextIdentity);
    setIdentity(nextIdentity);
  }

  async function loadWebConversations(token = adminToken) {
    if (!token) {
      setConversations([]);
      setSelectorError(null);
      return;
    }

    setIsLoadingConversations(true);
    setSelectorError(null);
    try {
      const data = await fetchWebChatConversations({ token, limit: 80 });
      setConversations(data.conversations);
      setIdentity((current) => {
        const currentConversation = data.conversations.find(
          (conversation) =>
            conversation.externalConversationId === current.conversationId
        );
        if (currentConversation) {
          const nextIdentity = identityFromConversation(currentConversation);
          setWebIdentity(nextIdentity);
          return nextIdentity;
        }
        const latestConversation = data.conversations[0];
        if (latestConversation) {
          const nextIdentity = identityFromConversation(latestConversation);
          setWebIdentity(nextIdentity);
          return nextIdentity;
        }
        return current;
      });
    } catch (loadError) {
      setSelectorError(friendlyErrorMessage(loadError));
    } finally {
      setIsLoadingConversations(false);
    }
  }

  function handleSelectConversation(conversationId: string) {
    const conversation = conversations.find(
      (item) => item.externalConversationId === conversationId
    );
    if (!conversation || !isWebConversationId(conversation.externalConversationId)) {
      setSelectorError("这里只能选择 web:<uuid> 形式的 Web Chat 会话。");
      return;
    }
    setSelectorError(null);
    applyIdentity(identityFromConversation(conversation));
  }

  function handleNewConversation() {
    const nextIdentity = createWebConversationIdentity(identity.userId);
    applyIdentity(nextIdentity);
  }

  useEffect(() => {
    void loadWebConversations(adminToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  const hasKnownCurrentConversation = Boolean(selectedConversation);
  const canUseCurrentConversation = isWebConversationId(identity.conversationId);

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[34rem] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-[0_18px_48px_rgba(91,117,150,0.13)]">
      <ChatHeader userId={identity.userId} conversationId={identity.conversationId} />
      <div className="border-b border-[#d9e2ec] bg-[#fff9e8] px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-xs font-semibold text-[#8a6f5a]">
              继续哪个 Web 对话
            </span>
            <select
              value={identity.conversationId}
              onChange={(event) => handleSelectConversation(event.target.value)}
              disabled={!adminToken || isLoadingConversations || isSending}
              className="field-input h-10 min-w-0 bg-white"
            >
              {!hasKnownCurrentConversation && (
                <option value={identity.conversationId}>
                  当前新对话 · {identity.conversationId}
                </option>
              )}
              {conversations.map((conversation) => (
                <option
                  key={conversation.id}
                  value={conversation.externalConversationId}
                >
                  {conversationLabel(conversation)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadWebConversations()}
              disabled={!adminToken || isLoadingConversations || isSending}
              className="h-10 rounded-lg border border-[#c9d6e5] bg-white px-4 text-sm font-medium text-[#334155] transition hover:bg-[#f8fbff]"
            >
              {isLoadingConversations ? "读取中" : "刷新"}
            </button>
            <button
              type="button"
              onClick={handleNewConversation}
              disabled={isSending}
              className="h-10 rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7]"
            >
              新对话
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7b8ca2]">
          <span className="admin-chip admin-chip-yellow">只列出 web:&lt;uuid&gt;</span>
          <span title={identity.conversationId}>
            当前 {shortConversationId(identity.conversationId)}
          </span>
          <span>·</span>
          <span className="truncate">用户 {identity.userId}</span>
          {!adminToken && <span>· 输入 Admin Token 后可选择已有对话</span>}
        </div>

        {(selectorError || !canUseCurrentConversation) && (
          <div className="mt-3 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-3 py-2 text-sm text-[#8d6048]">
            {selectorError ?? "当前会话不是 web:<uuid>，请新建一个 Web 对话。"}
          </div>
        )}
      </div>
      <MessageList
        messages={messages}
        isSending={isSending}
        isLoadingHistory={isLoadingHistory}
      />
      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-[#ead4c8] bg-[#fff6f1] px-3 py-2 text-sm text-[#8d6048]">
          {error}
        </div>
      )}
      <ChatInput
        onSend={sendMessage}
        disabled={isSending || !canUseCurrentConversation}
      />
    </div>
  );
}
