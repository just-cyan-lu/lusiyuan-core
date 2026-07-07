import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Icon, Select } from "animal-island-ui";
import {
  fetchWebChatConversations,
  updateAdminConversation,
  type WebChatConversationSummary,
} from "../api/lusiyuan-api";
import { useChat } from "../hooks/useChat";
import { useVoicePlayback } from "../hooks/useVoicePlayback";
import { useVoiceCall } from "../hooks/useVoiceCall";
import {
  createWebConversationIdentity,
  displayNameForWebUser,
  getWebIdentityForActor,
  isWebConversationId,
  setWebIdentity,
  type WebIdentity,
} from "../utils/storage";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { VoiceCallPanel } from "./VoiceCallPanel";
import { ConversationNoteDialog } from "./admin/ConversationNoteDialog";

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

function identityFromConversation(conversation: WebChatConversationSummary): WebIdentity {
  return {
    userId: conversation.user.externalId,
    conversationId: conversation.externalConversationId,
    displayName: conversation.user.displayName ?? displayNameForWebUser(conversation.user.externalId),
  };
}

function conversationLabel(conversation: WebChatConversationSummary): string {
  const note = conversation.note?.trim();
  const time = formatDate(conversation.lastMessageAt);
  return note
    ? `${note} · ${time} · ${conversation.messageCount} 条`
    : `${time} · ${conversation.messageCount} 条`;
}

export function ChatPage({ adminToken = "" }: ChatPageProps) {
  const [identity, setIdentity] = useState<WebIdentity>(() => getWebIdentityForActor("owner"));
  const [conversations, setConversations] = useState<WebChatConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [selectorError, setSelectorError] = useState<string | null>(null);
  const [noteDialog, setNoteDialog] = useState<{ conversationId: string; value: string } | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
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
      setSelectorError("这里只能选择有效的 Web Chat 会话。");
      return;
    }
    setSelectorError(null);
    applyIdentity(identityFromConversation(conversation));
  }

  function handleNewConversation() {
    const nextIdentity = createWebConversationIdentity("web:owner");
    applyIdentity(nextIdentity);
  }

  function openNoteDialog() {
    if (!selectedConversation) return;
    setNoteDialog({
      conversationId: selectedConversation.id,
      value: selectedConversation.note ?? "",
    });
  }

  async function saveConversationNote() {
    if (!adminToken || !noteDialog) return;
    setIsSavingNote(true);
    setSelectorError(null);
    try {
      const result = await updateAdminConversation({
        token: adminToken,
        conversationId: noteDialog.conversationId,
        note: noteDialog.value.trim() || null,
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === noteDialog.conversationId
            ? {
                ...conversation,
                note: result.conversation.note,
                metadata: result.conversation.metadata,
                updatedAt: result.conversation.updatedAt,
              }
            : conversation
        )
      );
      setNoteDialog(null);
    } catch (error) {
      setSelectorError(friendlyErrorMessage(error));
    } finally {
      setIsSavingNote(false);
    }
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

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] min-h-[34rem] w-full max-w-5xl flex-col">
      <Card className="flex h-full flex-col overflow-hidden" pattern="app-pink">
        <ChatHeader
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
            <div className="min-w-0 flex-1 lg:basis-[60%]">
              <span className="mb-1.5 block text-xs font-black text-[var(--ls-ink-soft)]">
                继续哪个 Web 对话
              </span>
              <div className="admin-select-host admin-select-below admin-chat-conversation-select w-full">
                <Select
                  value={identity.conversationId}
                  onChange={handleSelectConversation}
                  options={[
                    ...(!hasKnownCurrentConversation
                      ? [{ key: identity.conversationId, label: "当前新对话" }]
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
                icon={<span className="inline-block -scale-x-100 text-sm leading-none">✎</span>}
                disabled={!selectedConversation || !adminToken || isSending}
                onClick={openNoteDialog}
              >
                备注
              </Button>
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

          {(selectorError || !canUseCurrentConversation) && (
            <div className="mt-3 rounded-[18px] border-2 border-[var(--ls-warning-border)] bg-[var(--ls-warning-bg)] px-4 py-3 text-sm font-semibold text-[var(--ls-warning-text)]">
              {selectorError ?? "当前会话不可用于 Web Chat，请新建一个 Web 对话。"}
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
