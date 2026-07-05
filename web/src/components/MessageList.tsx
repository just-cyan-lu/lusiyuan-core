import { useEffect, useMemo, useRef } from "react";
import type { ChatMessage } from "../types/chat";
import { LusiyuanAvatar } from "./LusiyuanAvatar";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";

interface Props {
  messages: ChatMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
  typingLabel?: string | null;
  voiceLoadingMessageIds?: Set<string>;
  voicePlayingMessageId?: string | null;
  voiceErrorByMessageId?: Record<string, string>;
  onPlayVoice?: (messageId: string) => void;
}

function dateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "今天";
  if (diffDays === -1) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(date);
}

interface MessageGroup {
  date: string;
  label: string;
  messages: ChatMessage[];
}

function groupMessagesByDate(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const key = dateKey(message.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.date === key) {
      last.messages.push(message);
    } else {
      groups.push({ date: key, label: dateLabel(message.createdAt), messages: [message] });
    }
  }
  return groups;
}

export function MessageList({
  messages,
  isSending,
  isLoadingHistory,
  typingLabel,
  voiceLoadingMessageIds,
  voicePlayingMessageId,
  voiceErrorByMessageId = {},
  onPlayVoice,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const grouped = useMemo(() => groupMessagesByDate(messages), [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  if (isLoadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[var(--ls-panel-soft)] text-sm font-bold text-[var(--ls-ink-soft)]">
        <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--ls-border-strong)] border-t-[var(--ls-mint)]" />
        加载中…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--ls-panel-soft)] px-4 py-4">
      {messages.length === 0 && (
        <div className="mb-3 flex justify-start">
          <LusiyuanAvatar className="mr-2 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--ls-yellow)] bg-[var(--ls-panel-soft)] text-xs font-black text-[var(--ls-ink-strong)]" />
          <div className="max-w-[72%] rounded-2xl rounded-tl-sm border-2 border-[var(--ls-border)] bg-[var(--ls-panel)] px-4 py-3 text-sm font-semibold leading-relaxed text-[var(--ls-ink-strong)] shadow-sm">
            你好。嗯……你可以直接和我聊天。
          </div>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.date}>
          <div className="my-4 flex items-center justify-center">
            <span className="admin-chip admin-chip-yellow text-[11px]">{group.label}</span>
          </div>
          {group.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              voiceLoading={Boolean(msg.messageId && voiceLoadingMessageIds?.has(msg.messageId))}
              voicePlaying={Boolean(msg.messageId && voicePlayingMessageId === msg.messageId)}
              voiceError={msg.messageId ? voiceErrorByMessageId[msg.messageId] : undefined}
              onPlayVoice={onPlayVoice}
            />
          ))}
        </div>
      ))}

      {isSending && <TypingIndicator label={typingLabel} />}
      <div ref={bottomRef} />
    </div>
  );
}
