import type { ChatMessage } from "../types/chat";
import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface Props {
  message: ChatMessage;
  voiceLoading?: boolean;
  voicePlaying?: boolean;
  voiceError?: string;
  onPlayVoice?: (messageId: string) => void;
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
    <div className={`group flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <LusiyuanAvatar className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d9e2ec] bg-[#fff4c7] text-xs font-semibold text-[#794f27]" />
      )}
      <div className="relative max-w-[72%]">
        <div
          className={`
            rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
            ${isUser
              ? "rounded-tr-sm bg-[#6f8fb8] text-white"
              : "rounded-tl-sm border border-[#d9e2ec] bg-[#f8fbff] text-[#334155] shadow-sm"
            }
          `}
        >
          {message.content}
        </div>
        {canPlayVoice ? (
          <button
            type="button"
            onClick={() => message.messageId && onPlayVoice?.(message.messageId)}
            className={`admin-icon-button absolute -right-8 top-1 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[#c9d6e5] bg-white p-0 text-[#5f7fa7] shadow-sm transition hover:bg-[#f8fbff] ${
              voicePlaying || voiceLoading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            title={voicePlaying ? "停止语音" : voiceLoading ? "正在生成语音" : "播放语音"}
            aria-label={voicePlaying ? "停止语音" : "播放语音"}
            disabled={voiceLoading}
          >
            {voiceLoading ? (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#9aa8b8] border-t-[#5f7fa7]" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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
        {voiceError ? (
          <div className="mt-1 text-xs font-medium text-[#b85f6b]">
            {voiceError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
