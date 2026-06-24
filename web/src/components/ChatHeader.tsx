import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface ChatHeaderProps {
  conversationId: string;
  userId: string;
}

function shortId(value: string): string {
  const [prefix, id] = value.split(":");
  if (!prefix || !id || id.length <= 12) return value;
  return `${prefix}:${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function ChatHeader({ conversationId, userId }: ChatHeaderProps) {
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
      <div className="min-w-0 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2 text-xs text-[#66758a]">
        <div className="truncate" title={conversationId}>
          会话 {shortId(conversationId)}
        </div>
        <div className="mt-0.5 truncate" title={userId}>
          用户 {userId}
        </div>
      </div>
    </div>
  );
}
