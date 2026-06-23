import { LusiyuanAvatar } from "./LusiyuanAvatar";

export function ChatHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-[#d9e2ec] bg-[#f8fbff] px-4 py-3">
      <LusiyuanAvatar
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#d9e2ec] bg-[#fff4c7] text-lg font-semibold text-[#794f27]"
      />
      <div className="min-w-0">
        <div className="text-sm font-semibold text-[#172033]">陆思源</div>
        <div className="truncate text-xs text-[#66758a]">原创 AI 数字人 · Web Chat</div>
      </div>
    </div>
  );
}
