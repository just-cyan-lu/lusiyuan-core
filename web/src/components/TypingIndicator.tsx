import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface TypingIndicatorProps {
  label?: string | null;
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <div className="mb-3 flex justify-start">
      <LusiyuanAvatar className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#d9e2ec] bg-[#fff4c7] text-xs font-semibold text-[#794f27]" />
      <div className="flex items-center gap-2 rounded-lg rounded-tl-sm border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm text-[#5f7289] shadow-sm">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa4c2] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa4c2] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#8aa4c2]" />
        </span>
        {label && <span className="whitespace-nowrap text-xs font-medium">（{label}）</span>}
      </div>
    </div>
  );
}
