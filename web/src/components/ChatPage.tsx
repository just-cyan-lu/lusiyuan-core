import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Icon, Radio, Select, Tooltip } from "animal-island-ui";
import {
  fetchWebChatConversations,
  type WebChatConversationSummary,
} from "../api/lusiyuan-api";
import { useChat } from "../hooks/useChat";
import { useVoicePlayback } from "../hooks/useVoicePlayback";
import { useVoiceCall } from "../hooks/useVoiceCall";
import {
  createWebConversationIdentity,
  displayNameForWebUser,
  getWebIdentityForActor,
  getWebIdentity,
  isWebConversationId,
  setWebIdentity,
  webActorForUserId,
  WEB_CHAT_ACTORS,
  type WebChatActorId,
  type WebIdentity,
} from "../utils/storage";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { VoiceCallPanel } from "./VoiceCallPanel";

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
    year: "2-digit",
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
    displayName: conversation.user.displayName ?? displayNameForWebUser(conversation.user.externalId),
  };
}

function userLabel(conversation: WebChatConversationSummary): string {
  return conversation.user.displayName ?? conversation.user.externalId;
}

function conversationLabel(conversation: WebChatConversationSummary): string {
  return `${formatDate(conversation.lastMessageAt)} · ${userLabel(conversation)} · ${conversation.messageCount} 条`;
}

export function ChatPage({ adminToken = "" }: ChatPageProps) {
  const [identity, setIdentity] = useState<WebIdentity>(() => getWebIdentity());
  const [conversations, setConversations] = useState<WebChatConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const voicePlayback = useVoicePlayback(identity);
  const {
    messages,
    typingLabel,
    isSending,
    isStopping,
    canStop,
    isLoadingHistory,
    error,
    sendMessage,
    stopMessage,
  } = useChat(identity, {
    voiceAutoplayEnabled: voicePlayback.autoplayEnabled,
    onVoiceStreamEvent: voicePlayback.handleStreamEvent,
  });
  const voiceCall = useVoiceCall(async (text) => {
    voicePlayback.clearQueue();
    await sendMessage(text);
    await voicePlayback.waitUntilIdle();
  });
  const clearVoiceQueueRef = useRef(voicePlayback.clearQueue);

  const selectedConversation = useMemo(
    () =>
      conversations.find(
        (conversation) =>
          conversation.externalConversationId === identity.conversationId
      ) ?? null,
    [conversations, identity.conversationId]
  );
  const activeActor = webActorForUserId(identity.userId);

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

  function handleActorChange(actorId: WebChatActorId) {
    if (actorId === "custom") return;
    setSelectorError(null);
    applyIdentity(getWebIdentityForActor(actorId));
  }

  function handleNewConversation() {
    const nextIdentity = createWebConversationIdentity(identity.userId);
    applyIdentity(nextIdentity);
  }

  useEffect(() => {
    void loadWebConversations(adminToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminToken]);

  useEffect(() => {
    clearVoiceQueueRef.current = voicePlayback.clearQueue;
  }, [voicePlayback.clearQueue]);

  useEffect(() => {
    const clearVoiceQueue = () => clearVoiceQueueRef.current();
    window.addEventListener("pointerdown", clearVoiceQueue, { capture: true, passive: true });
    window.addEventListener("wheel", clearVoiceQueue, { capture: true, passive: true });
    window.addEventListener("keydown", clearVoiceQueue, true);
    return () => {
      window.removeEventListener("pointerdown", clearVoiceQueue, true);
      window.removeEventListener("wheel", clearVoiceQueue, true);
      window.removeEventListener("keydown", clearVoiceQueue, true);
    };
  }, []);

  const hasKnownCurrentConversation = Boolean(selectedConversation);
  const canUseCurrentConversation = isWebConversationId(identity.conversationId);

  const conversationOptions = useMemo(
    () =>
      conversations.map((conversation) => ({
        key: conversation.externalConversationId,
        label: conversationLabel(conversation),
      })),
    [conversations]
  );

  const actorOptions = useMemo(
    () => [
      ...WEB_CHAT_ACTORS.map((actor) => ({ label: actor.label, value: actor.id })),
      { label: "历史身份", value: "custom", disabled: true },
    ],
    []
  );

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[34rem] w-full max-w-5xl flex-col">
      <Card className="flex h-full flex-col overflow-hidden" pattern="app-pink">
        <ChatHeader
          userId={identity.userId}
          conversationId={identity.conversationId}
          displayName={identity.displayName}
          voiceAutoplayEnabled={voicePlayback.autoplayEnabled}
          onToggleVoiceAutoplay={() => voicePlayback.setAutoplayEnabled(!voicePlayback.autoplayEnabled)}
          onOpenVoiceCall={() => {
            voicePlayback.setAutoplayEnabled(true);
            voiceCall.setIsOpen(true);
          }}
        />
        <VoiceCallPanel
          isOpen={voiceCall.isOpen}
          isSupported={voiceCall.isSupported}
          isRecording={voiceCall.isRecording}
          isTranscribing={voiceCall.isTranscribing}
          isAutoCallActive={voiceCall.isAutoCallActive}
          liveTranscript={voiceCall.liveTranscript}
          lastTranscript={voiceCall.lastTranscript}
          error={voiceCall.error}
          onStart={() => void voiceCall.startRecording()}
          onStopAndSend={() => void voiceCall.stopAndSend()}
          onStartAutoCall={() => void voiceCall.startAutoCall()}
          onStopAutoCall={voiceCall.stopAutoCall}
          onClose={voiceCall.close}
        />

        <div className="border-b border-[var(--ls-border)] bg-[var(--ls-panel)] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="w-full lg:w-40">
              <span className="mb-1.5 block text-xs font-black text-[var(--ls-ink-soft)]">
                这次是谁在聊
              </span>
              <Radio
                value={activeActor}
                onChange={(value) => handleActorChange(value as WebChatActorId)}
                options={actorOptions}
                direction="horizontal"
                disabled={isSending}
              />
            </div>

            <div className="min-w-0 flex-1">
              <span className="mb-1.5 block text-xs font-black text-[var(--ls-ink-soft)]">
                继续哪个 Web 对话
              </span>
              <div className="admin-select-host admin-select-below">
                <Select
                  value={identity.conversationId}
                  onChange={handleSelectConversation}
                  options={[
                    ...(!hasKnownCurrentConversation
                      ? [{ key: identity.conversationId, label: `当前新对话 · ${shortConversationId(identity.conversationId)}` }]
                      : []),
                    ...conversationOptions,
                  ]}
                  disabled={!adminToken || isLoadingConversations || isSending}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="default"
                size="middle"
                icon={<Icon name="icon-variant" size={18} />}
                loading={isLoadingConversations}
                disabled={!adminToken || isSending}
                onClick={() => void loadWebConversations()}
              >
                刷新
              </Button>
              <Button
                type="primary"
                size="middle"
                icon={<Icon name="icon-chat" size={18} />}
                disabled={isSending}
                onClick={handleNewConversation}
              >
                新对话
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[var(--ls-ink-soft)]">
            <span className="admin-chip admin-chip-yellow">只列出 web:&lt;uuid&gt;</span>
            <span className={activeActor === "owner" ? "admin-chip admin-chip-mint" : "admin-chip"}>
              {activeActor === "owner"
                ? "当前按你本人记录"
                : activeActor === "codex"
                  ? "当前按 Codex 记录"
                  : "当前是历史身份"}
            </span>
            <Tooltip title={identity.conversationId} variant="island" placement="top">
              <span className="admin-chip cursor-pointer">
                会话 {shortConversationId(identity.conversationId)}
              </span>
            </Tooltip>
            <Tooltip title={identity.userId} variant="island" placement="top">
              <span className="admin-chip cursor-pointer truncate">用户 {identity.userId}</span>
            </Tooltip>
            {!adminToken && <span className="admin-chip">输入 Admin Token 后可选择已有对话</span>}
          </div>

          {(selectorError || !canUseCurrentConversation) && (
            <div className="mt-3 rounded-[18px] border-2 border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm font-semibold text-[var(--ls-warning-text)]">
              {selectorError ?? "当前会话不是 web:<uuid>，请新建一个 Web 对话。"}
            </div>
          )}
        </div>

        <MessageList
          messages={messages}
          isSending={isSending}
          isLoadingHistory={isLoadingHistory}
          typingLabel={typingLabel}
          voiceLoadingMessageIds={voicePlayback.loadingMessageIds}
          voicePlayingMessageId={voicePlayback.playingMessageId}
          voiceErrorByMessageId={voicePlayback.errorByMessageId}
          onPlayVoice={(messageId) => void voicePlayback.playMessage(messageId)}
        />

        {error && (
          <div className="mx-4 mb-2 rounded-[18px] border-2 border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm font-semibold text-[var(--ls-warning-text)]">
            {error}
          </div>
        )}

        <ChatInput
          onSend={sendMessage}
          onStop={stopMessage}
          disabled={!canUseCurrentConversation}
          isSending={isSending}
          isStopping={isStopping}
          canStop={canStop}
        />
      </Card>
    </div>
  );
}
