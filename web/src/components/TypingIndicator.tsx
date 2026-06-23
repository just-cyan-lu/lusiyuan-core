import { LusiyuanAvatar } from "./LusiyuanAvatar";

export function TypingIndicator() {
  return (
    <div className="mb-3 flex justify-start">
      <LusiyuanAvatar className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d9e2ec] bg-[#fff4c7] text-xs font-semibold text-[#794f27]" />
      <div className="flex items-center gap-1 rounded-lg rounded-tl-sm border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 shadow-sm">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa4c2] [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa4c2] [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa4c2]" />
      </div>
    </div>
  );
}
