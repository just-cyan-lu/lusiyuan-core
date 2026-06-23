interface StatusPillProps {
  active: boolean;
  label?: string;
}

export function StatusPill({ active, label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 py-1 text-xs font-black shadow-[inset_0_-1px_rgba(61,52,40,0.08)] ${
        active
          ? "border-[#82d5bb] bg-[#e6f9f6] text-[#17766e]"
          : "border-[#f8a6b2] bg-[#fde4e8] text-[#a85565]"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-[#19c8b9]" : "bg-[#e05a5a]"}`} />
      {label ?? (active ? "已启用" : "未启用")}
    </span>
  );
}
