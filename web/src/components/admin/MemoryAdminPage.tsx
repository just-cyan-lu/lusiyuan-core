import { useEffect, useState } from "react";
import { MemoryLibraryPage } from "./MemoryLibraryPage";

interface MemoryAdminPageProps {
  adminToken: string;
  focusPersonId?: string | null;
}

function readMemoryFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("memory");
}

function readPersonFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("person");
}

export function MemoryAdminPage({ adminToken, focusPersonId }: MemoryAdminPageProps) {
  const [focusMemoryId, setFocusMemoryId] = useState<string | null>(readMemoryFromUrl);
  const [personId, setPersonId] = useState<string | null>(focusPersonId ?? readPersonFromUrl);

  useEffect(() => {
    const onPopState = () => {
      setFocusMemoryId(readMemoryFromUrl());
      setPersonId(readPersonFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (focusPersonId) setPersonId(focusPersonId);
  }, [focusPersonId]);

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-4 shadow-[var(--ls-shadow)] md:p-5">
        <div>
          <div>
            <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Memory Center</div>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">记忆管理</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ls-ink-soft)]">
              管理已经写入的长期记忆。全局记忆会影响所有身份，身份记忆只影响对应 PersonIdentity。
            </p>
          </div>
        </div>
      </section>

      <MemoryLibraryPage
        key={focusMemoryId ?? "library"}
        adminToken={adminToken}
        focusMemoryId={focusMemoryId}
        focusPersonId={personId}
      />
    </div>
  );
}
