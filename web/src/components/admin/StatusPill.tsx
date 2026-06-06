interface StatusPillProps {
  active: boolean;
  label?: string;
}

export function StatusPill({ active, label }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
        active
          ? "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]"
          : "border-[#ead4c8] bg-[#fff6f1] text-[#9a6a4f]"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#6aa47e]" : "bg-[#c48a6a]"}`} />
      {label ?? (active ? "已启用" : "未启用")}
    </span>
  );
}
