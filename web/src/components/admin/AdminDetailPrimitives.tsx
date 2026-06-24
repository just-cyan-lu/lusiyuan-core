import type { ReactNode } from "react";
import { jsonText } from "./admin-detail-utils";

export function DetailInfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="admin-island-row min-w-0 px-3 py-2">
      <div className="text-[11px] font-black uppercase text-[#9f927d]">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold leading-6 text-[#725d42]">{value}</div>
    </div>
  );
}

export function RawJsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="admin-island-row overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-[#794f27]">
        {title}
      </summary>
      <pre className="max-h-80 overflow-auto border-t-2 border-[#e8dcc8] bg-[#fff9e8] px-4 py-3 text-xs font-semibold leading-5 text-[#5c4630]">
        {jsonText(value)}
      </pre>
    </details>
  );
}

type SectionPanelBg = "white" | "muted";

export function SectionPanel({
  title,
  subtitle,
  bg = "white",
  actions,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  bg?: SectionPanelBg;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const sectionClass = bg === "muted"
    ? "rounded-lg border border-[#d9e2ec] bg-[#f8fbff] p-5"
    : "rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm";
  return (
    <section className={sectionClass}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#172033]">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-5 text-[#7b8ca2]">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
