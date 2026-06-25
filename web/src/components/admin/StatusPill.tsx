interface StatusPillProps {
  active: boolean;
  label?: string;
}

export function StatusPill({ active, label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-1 text-xs font-black shadow-[inset_0_-1px_rgba(61,52,40,0.08)] ${
        active
          ? "border-[var(--ls-mint-light)] bg-[var(--ls-mint-soft)] text-[var(--ls-mint-text)]"
          : "border-[var(--ls-pink)] bg-[var(--ls-pink-soft)] text-[var(--ls-pink-text)]"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-[var(--ls-mint)]" : "bg-[var(--ls-red)]"}`} />
      {label ?? (active ? "已启用" : "未启用")}
    </span>
  );
}
