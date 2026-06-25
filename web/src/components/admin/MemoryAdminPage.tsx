import { useEffect, useState } from "react";
import { Icon, type IconName } from "animal-island-ui";
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
  icon: IconName;
}> = [
  {
    value: "library",
    label: "记忆库",
    description: "查看、编辑、归档已写入记忆",
    icon: "icon-critterpedia",
  },
  {
    value: "proposals",
    label: "提案审核",
    description: "批准 Reflection / Dream 生成的记忆变更",
    icon: "icon-diy",
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
      <section className="rounded-lg border border-[var(--ls-border)] bg-white p-4 shadow-[var(--ls-shadow)] md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[var(--ls-eyebrow-text)]">Memory Center</div>
            <h2 className="mt-2 text-3xl font-semibold text-[var(--ls-ink-strong)]">记忆管理</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ls-ink-soft)]">
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
                  className={`admin-stacked-tab-button ${
                    active ? "admin-stacked-tab-button-active" : ""
                  }`}
                  aria-pressed={active}
                >
                  <span className="admin-stacked-tab-icon" aria-hidden="true">
                    <Icon name={tab.icon} size={20} />
                  </span>
                  <span className="admin-stacked-tab-copy">
                    <span className="admin-stacked-tab-title">{tab.label}</span>
                    <span className="admin-stacked-tab-description">{tab.description}</span>
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
