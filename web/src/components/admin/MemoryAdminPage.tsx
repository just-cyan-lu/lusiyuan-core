import { useEffect, useState } from "react";
import { MemoryLibraryPage } from "./MemoryLibraryPage";
import { MemoryProposalsPage } from "./MemoryProposalsPage";

type MemoryAdminTab = "library" | "proposals";

interface MemoryAdminPageProps {
  adminToken: string;
}

const tabs: Array<{
  value: MemoryAdminTab;
  label: string;
  description: string;
}> = [
  {
    value: "library",
    label: "记忆库",
    description: "查看、编辑、归档已写入记忆",
  },
  {
    value: "proposals",
    label: "提案审核",
    description: "批准 Reflection / Dream 生成的记忆变更",
  },
];

function readTabFromUrl(): MemoryAdminTab {
  const value = new URLSearchParams(window.location.search).get("tab");
  return value === "proposals" ? "proposals" : "library";
}

function readMemoryFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("memory");
}

export function MemoryAdminPage({ adminToken }: MemoryAdminPageProps) {
  const [activeTab, setActiveTab] = useState<MemoryAdminTab>(readTabFromUrl);
  const [focusMemoryId, setFocusMemoryId] = useState<string | null>(readMemoryFromUrl);

  useEffect(() => {
    const onPopState = () => {
      setActiveTab(readTabFromUrl());
      setFocusMemoryId(readMemoryFromUrl());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function changeTab(next: MemoryAdminTab) {
    setActiveTab(next);
    setFocusMemoryId(null);
    window.history.pushState(null, "", `/admin/memory?tab=${next}`);
  }

  function openMemory(memoryId: string) {
    setActiveTab("library");
    setFocusMemoryId(memoryId);
    window.history.pushState(
      null,
      "",
      `/admin/memory?tab=library&memory=${encodeURIComponent(memoryId)}`
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-4 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Memory Center</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">记忆管理</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#617188]">
              一边管理已经生效的长期记忆，一边审核尚未写入的提案。全局记忆会成为陆思源的基础记忆，用户记忆只影响对应用户。
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {tabs.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => changeTab(tab.value)}
                  className={`rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#a9bfd7] bg-[#eaf2fb] shadow-sm"
                      : "border-[#d9e2ec] bg-[#f8fbff] text-[#66758a] hover:bg-white"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[#172033]">
                    {tab.label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-[#7b8ca2]">
                    {tab.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeTab === "library" ? (
        <MemoryLibraryPage
          key={focusMemoryId ?? "library"}
          adminToken={adminToken}
          focusMemoryId={focusMemoryId}
        />
      ) : (
        <MemoryProposalsPage adminToken={adminToken} onOpenMemory={openMemory} />
      )}
    </div>
  );
}
