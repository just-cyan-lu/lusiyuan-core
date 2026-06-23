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
