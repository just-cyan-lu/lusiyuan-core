import type { ReactNode } from "react";
import { jsonText } from "./admin-detail-utils";

export function DetailInfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="admin-island-row min-w-0 px-3 py-2">
      <div className="text-[11px] font-black uppercase text-[var(--ls-ink-soft)]">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold leading-6 text-[var(--ls-ink)]">{value}</div>
    </div>
  );
}

export function RawJsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="admin-island-row overflow-hidden">
      <summary className="cursor-pointer px-4 py-3 text-sm font-black text-[var(--ls-ink-strong)]">
        {title}
      </summary>
      <pre className="max-h-80 overflow-auto border-t-2 border-[var(--ls-border)] bg-[var(--ls-panel-soft)] px-4 py-3 text-xs font-semibold leading-5 text-[var(--ls-code-text)]">
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
    ? "rounded-lg border border-[var(--ls-border)] bg-[var(--ls-panel-soft)] p-5"
    : "rounded-lg border border-[var(--ls-border)] bg-white p-5 shadow-sm";
  return (
    <section className={sectionClass}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--ls-ink-strong)]">{title}</h3>
          {subtitle && <div className="mt-1 text-xs leading-5 text-[var(--ls-ink-soft)]">{subtitle}</div>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
