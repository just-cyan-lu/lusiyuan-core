import type { ReactNode } from "react";

export type AdminSection =
  | "overview"
  | "memory"
  | "reflection"
  | "dream"
  | "platforms"
  | "tools"
  | "chat"
  | "settings";

interface AdminShellProps {
  activeSection: AdminSection;
  adminToken: string;
  apiBaseUrl: string;
  onAdminTokenChange: (token: string) => void;
  onNavigate: (section: AdminSection) => void;
  children: ReactNode;
}

const navItems: Array<{
  section: AdminSection;
  index: string;
  label: string;
  description: string;
}> = [
  {
    section: "overview",
    index: "01",
    label: "总览",
    description: "状态与配置",
  },
  {
    section: "memory",
    index: "02",
    label: "记忆",
    description: "记忆库 / 提案",
  },
  {
    section: "reflection",
    index: "03",
    label: "复盘",
    description: "Reflection",
  },
  {
    section: "dream",
    index: "04",
    label: "梦境",
    description: "Dream Cycle",
  },
  {
    section: "platforms",
    index: "05",
    label: "平台",
    description: "外部平台工作台",
  },
  {
    section: "tools",
    index: "06",
    label: "工具",
    description: "调用与日志",
  },
  {
    section: "chat",
    index: "07",
    label: "聊天",
    description: "Web Chat",
  },
  {
    section: "settings",
    index: "08",
    label: "配置",
    description: ".env 编辑",
  },
];

export function AdminShell({
  activeSection,
  adminToken,
  apiBaseUrl,
  onAdminTokenChange,
  onNavigate,
  children,
}: AdminShellProps) {
  const activeItem = navItems.find((item) => item.section === activeSection) ?? navItems[0];

  return (
    <div className="min-h-dvh bg-[#f6f8fb] text-[#172033]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-18rem] top-[-16rem] h-[40rem] w-[40rem] rounded-full bg-[#eaf2fb]/55 blur-[120px]" />
        <div className="absolute right-[-18rem] top-[7rem] h-[36rem] w-[36rem] rounded-full bg-[#f7eee8]/50 blur-[130px]" />
      </div>

      <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[18rem_1fr]">
        <aside className="border-b border-[#d9e2ec] bg-white/85 px-4 py-4 backdrop-blur lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <button
              type="button"
              onClick={() => onNavigate("overview")}
              className="group flex items-center gap-3 text-left"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#6f8fb8] font-semibold text-white shadow-[0_14px_34px_rgba(91,117,150,0.24)]">
                L
              </span>
              <span>
                <span className="block text-base font-semibold text-[#172033]">Lusiyuan Core</span>
                <span className="block text-xs text-[#66758a]">Admin Platform</span>
              </span>
            </button>

            <div className="hidden rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-3 py-2 text-xs text-[#66758a] lg:mt-7 lg:block">
              <div className="text-[#8a6f5a]">v0 Admin Shell</div>
              <div className="mt-1">先立控制台，再接业务动作。</div>
            </div>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:mt-7 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const active = item.section === activeSection;
              return (
                <button
                  key={item.section}
                  type="button"
                  onClick={() => onNavigate(item.section)}
                  className={`group flex min-w-[9.5rem] items-center gap-3 rounded-lg border px-3 py-3 text-left transition lg:w-full ${
                    active
                      ? "border-[#a9bfd7] bg-[#eaf2fb] shadow-[0_12px_28px_rgba(91,117,150,0.16)]"
                      : "border-transparent bg-transparent text-[#66758a] hover:border-[#d9e2ec] hover:bg-[#f8fbff]"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold ${
                      active ? "bg-[#6f8fb8] text-white" : "bg-[#e9eef5] text-[#6b7d93]"
                    }`}
                  >
                    {item.index}
                  </span>
                  <span className="min-w-0">
                    <span className={active ? "block text-sm font-semibold text-[#172033]" : "block text-sm font-medium"}>
                      {item.label}
                    </span>
                    <span className="block truncate text-xs text-[#7b8ca2]">{item.description}</span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 flex-col">
          <header className="border-b border-[#d9e2ec] bg-white/78 px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs text-[#8a6f5a]">Admin / {activeItem.label}</div>
                <h1 className="mt-1 text-2xl font-semibold text-[#172033] md:text-3xl">
                  {activeItem.description}
                </h1>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(18rem,24rem)] xl:w-[43rem]">
                <div className="rounded-lg border border-[#d9e2ec] bg-white px-3 py-2 shadow-sm">
                  <div className="text-[11px] text-[#7b8ca2]">API Base</div>
                  <div className="truncate text-sm text-[#172033]">{apiBaseUrl}</div>
                </div>
                <label className="rounded-lg border border-[#d9e2ec] bg-white px-3 py-2 shadow-sm">
                  <span className="flex items-center justify-between gap-3 text-[11px] text-[#7b8ca2]">
                    <span>Admin Token</span>
                    <span className={adminToken ? "text-[#4f8f6b]" : "text-[#b07a5b]"}>
                      {adminToken ? "已保存" : "未配置"}
                    </span>
                  </span>
                  <input
                    value={adminToken}
                    onChange={(event) => onAdminTokenChange(event.target.value)}
                    placeholder="Bearer token，本地保存"
                    type="password"
                    className="mt-1 w-full bg-transparent text-sm text-[#172033] outline-none placeholder:text-[#9aa8b8]"
                  />
                </label>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
