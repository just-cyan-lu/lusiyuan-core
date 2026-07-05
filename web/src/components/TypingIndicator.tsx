import { LusiyuanAvatar } from "./LusiyuanAvatar";

interface TypingIndicatorProps {
  label?: string | null;
}

export function TypingIndicator({ label }: TypingIndicatorProps) {
  return (
    <div className="mb-4 flex justify-start">
      <LusiyuanAvatar className="mr-2 mt-1 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-[var(--ls-yellow)] bg-[var(--ls-panel-soft)] text-xs font-black text-[var(--ls-ink-strong)]" />
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border-2 border-[var(--ls-border)] bg-[var(--ls-panel)] px-4 py-3 text-sm font-semibold text-[var(--ls-ink-soft)] shadow-sm">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ls-mint)] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ls-mint-light)] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--ls-mint)]" />
        </span>
        {label && <span className="whitespace-nowrap text-xs font-bold">（{label}）</span>}
      </div>
    </div>
  );
}
