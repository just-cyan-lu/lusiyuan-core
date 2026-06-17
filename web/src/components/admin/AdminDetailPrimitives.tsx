import type { ReactNode } from "react";
import { jsonText } from "./admin-detail-utils";

export function DetailInfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d9e2ec] bg-white px-3 py-2">
      <div className="text-[11px] font-semibold text-[#7b8ca2]">{label}</div>
      <div className="mt-1 break-words text-sm leading-6 text-[#334155]">{value}</div>
    </div>
  );
}

export function RawJsonDetails({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="rounded-lg border border-[#d9e2ec] bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#334155]">
        {title}
      </summary>
      <pre className="max-h-80 overflow-auto border-t border-[#edf2f7] px-4 py-3 text-xs leading-5 text-[#334155]">
        {jsonText(value)}
      </pre>
    </details>
  );
}
