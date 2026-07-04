import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface ChatHeaderProps {
  conversationId: string;
  userId: string;
  voiceAutoplayEnabled: boolean;
  onToggleVoiceAutoplay: () => void;
  onOpenVoiceCall: () => void;
}

function shortId(value: string): string {
  const [prefix, id] = value.split(":");
  if (!prefix || !id || id.length <= 12) return value;
  return `${prefix}:${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function ChatHeader({
  conversationId,
  userId,
  voiceAutoplayEnabled,
  onToggleVoiceAutoplay,
  onOpenVoiceCall,
}: ChatHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <LusiyuanAvatar
          className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#d9e2ec] bg-[#fff4c7] text-lg font-semibold text-[#794f27]"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[#172033]">陆思源</div>
          <div className="truncate text-xs text-[#66758a]">原创 AI 数字人 · Web Chat</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleVoiceAutoplay}
          className={`admin-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border p-0 text-sm transition ${
            voiceAutoplayEnabled
              ? "border-[#6f8fb8] bg-[#e8f1fb] text-[#4f6f98]"
              : "border-[#d9e2ec] bg-white text-[#66758a] hover:bg-[#f8fbff]"
          }`}
          title={voiceAutoplayEnabled ? "关闭自动语音" : "开启自动语音"}
          aria-label={voiceAutoplayEnabled ? "关闭自动语音" : "开启自动语音"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
            <path
              d="M16 8.5c1 .9 1.5 2.1 1.5 3.5S17 14.6 16 15.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onOpenVoiceCall}
          className="admin-icon-button flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d9e2ec] bg-white p-0 text-[#66758a] transition hover:bg-[#f8fbff]"
          title="语音电话"
          aria-label="语音电话"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path
              d="M7 4h3l1.5 4-2 1.2c1 2.1 2.2 3.3 4.3 4.3l1.2-2 4 1.5v3c0 1.1-.9 2-2 2C9.8 19 5 14.2 5 7c0-1.1.9-2 2-2Z"
              fill="currentColor"
            />
          </svg>
        </button>
        <div className="min-w-0 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2 text-xs text-[#66758a]">
          <div className="truncate" title={conversationId}>
            会话 {shortId(conversationId)}
          </div>
          <div className="mt-0.5 truncate" title={userId}>
            用户 {userId}
          </div>
        </div>
      </div>
    </div>
  );
}
