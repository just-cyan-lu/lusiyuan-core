import type { ChatMessage } from "../types/chat";
import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface Props {
  message: ChatMessage;
  voiceLoading?: boolean;
  voicePlaying?: boolean;
  voiceError?: string;
  onPlayVoice?: (messageId: string) => void;
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function MessageBubble({
  message,
  voiceLoading = false,
  voicePlaying = false,
  voiceError,
  onPlayVoice,
}: Props) {
  const isUser = message.role === "user";
  const canPlayVoice = !isUser && Boolean(message.messageId && onPlayVoice);

  return (
    <div className={`group mb-4 flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <LusiyuanAvatar className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--ls-yellow)] bg-[var(--ls-panel-soft)] text-xs font-black text-[var(--ls-ink-strong)]" />
      )}
      <div className="relative max-w-[78%]">
        <div
          className={`
            whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm font-semibold leading-relaxed shadow-sm
            ${isUser
              ? "rounded-tr-sm bg-[var(--ls-mint)] text-white"
              : "rounded-tl-sm border-2 border-[var(--ls-border)] bg-[var(--ls-panel)] text-[var(--ls-ink-strong)]"
            }
          `}
        >
          {message.content}
        </div>

        <div
          className={`mt-1 flex items-center gap-1.5 text-[10px] font-bold text-[var(--ls-ink-soft)] ${isUser ? "justify-end" : "justify-start"}`}
        >
          <span>{formatTime(message.createdAt)}</span>
          {canPlayVoice ? (
            <button
              type="button"
              onClick={() => message.messageId && onPlayVoice?.(message.messageId)}
              className={`admin-icon-button flex h-6 w-6 items-center justify-center rounded-full border border-[var(--ls-border-strong)] p-0 shadow-sm transition ${
                voicePlaying || voiceLoading
                  ? "bg-[var(--ls-mint-soft)] text-[var(--ls-mint)] opacity-100"
                  : "bg-white text-[var(--ls-mint)] opacity-0 group-hover:opacity-100"
              }`}
              title={voicePlaying ? "停止语音" : voiceLoading ? "正在生成语音" : "播放语音"}
              aria-label={voicePlaying ? "停止语音" : "播放语音"}
              disabled={voiceLoading && !voicePlaying}
            >
              {voicePlaying ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
                </svg>
              ) : voiceLoading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--ls-border-strong)] border-t-[var(--ls-mint)]" />
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
                  <path
                    d="M16 8.5c1 .9 1.5 2.1 1.5 3.5S17 14.6 16 15.5M18.5 6c1.7 1.5 2.5 3.5 2.5 6s-.8 4.5-2.5 6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          ) : null}
        </div>

        {voiceError ? (
          <div className="mt-1 text-xs font-bold text-[var(--ls-pink-text)]">
            {voiceError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
