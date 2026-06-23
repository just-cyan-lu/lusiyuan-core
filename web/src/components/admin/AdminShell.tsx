import { Card, Icon, Input, Time, Title, type CardColor, type IconName } from "animal-island-ui";
import type { ChangeEvent, ReactNode } from "react";

export type AdminSection =
  | "overview"
  | "runtime"
  | "relationships"
  | "conversations"
  | "skills"
  | "learning"
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
  icon: IconName;
  color: CardColor;
  accentClass: string;
}> = [
  {
    section: "overview",
    index: "01",
    label: "总览",
    description: "状态与配置",
    icon: "icon-map",
    color: "app-teal",
    accentClass: "bg-[#82d5bb] text-[#285d50]",
  },
  {
    section: "runtime",
    index: "02",
    label: "运行态",
    description: "心情 / 状态",
    icon: "icon-miles",
    color: "app-yellow",
    accentClass: "bg-[#f7cd67] text-[#725d42]",
  },
  {
    section: "relationships",
    index: "03",
    label: "关系",
    description: "用户关系状态",
    icon: "icon-chat",
    color: "app-pink",
    accentClass: "bg-[#f8a6b2] text-white",
  },
  {
    section: "conversations",
    index: "04",
    label: "对话",
    description: "现实身份追溯",
    icon: "icon-chat",
    color: "app-blue",
    accentClass: "bg-[#889df0] text-white",
  },
  {
    section: "memory",
    index: "05",
    label: "记忆",
    description: "记忆库 / 提案",
    icon: "icon-critterpedia",
    color: "lime-green",
    accentClass: "bg-[#d1da49] text-[#3d5a1a]",
  },
  {
    section: "skills",
    index: "06",
    label: "Skills",
    description: "能力开关",
    icon: "icon-diy",
    color: "app-orange",
    accentClass: "bg-[#e59266] text-white",
  },
  {
    section: "learning",
    index: "07",
    label: "表达学习",
    description: "Owner 表达经验",
    icon: "icon-design",
    color: "purple",
    accentClass: "bg-[#b77dee] text-white",
  },
  {
    section: "reflection",
    index: "08",
    label: "复盘",
    description: "Reflection",
    icon: "icon-camera",
    color: "warm-peach-pink",
    accentClass: "bg-[#e18c6f] text-white",
  },
  {
    section: "dream",
    index: "09",
    label: "梦境",
    description: "Dream Cycle",
    icon: "icon-helicopter",
    color: "app-blue",
    accentClass: "bg-[#889df0] text-white",
  },
  {
    section: "platforms",
    index: "10",
    label: "平台",
    description: "外部平台工作台",
    icon: "icon-shopping",
    color: "yellow-green",
    accentClass: "bg-[#ecdf52] text-[#725d42]",
  },
  {
    section: "tools",
    index: "11",
    label: "工具",
    description: "调用与日志",
    icon: "icon-variant",
    color: "app-green",
    accentClass: "bg-[#8ac68a] text-white",
  },
  {
    section: "chat",
    index: "12",
    label: "Web Chat",
    description: "Web Chat",
    icon: "icon-chat",
    color: "app-pink",
    accentClass: "bg-[#f8a6b2] text-white",
  },
  {
    section: "settings",
    index: "13",
    label: "配置",
    description: "实时设置 / 连接",
    icon: "icon-diy",
    color: "brown",
    accentClass: "bg-[#9a835a] text-white",
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
    <div className="admin-island-shell">
      <div className="relative grid min-h-dvh grid-cols-1 lg:grid-cols-[19.5rem_1fr]">
        <aside className="admin-island-sidebar border-b px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center justify-between gap-4 lg:block">
            <button
              type="button"
              onClick={() => onNavigate("overview")}
              className="group flex items-center gap-3 text-left"
              aria-label="回到总览"
            >
              <span className="admin-brand-mark flex h-12 w-12 items-center justify-center rounded-[18px] border-2 border-[#f7cd67] bg-[#fff4c7] text-xl font-black text-[#794f27]">
                源
              </span>
              <span className="min-w-0">
                <Title size="small" color="app-teal">
                  Lusiyuan Core
                </Title>
                <span className="mt-1 block text-xs font-bold text-[#9f927d]">
                  ENFP-flavored admin
                </span>
              </span>
            </button>

            <Card className="hidden px-4 py-4 lg:mt-6 lg:block" pattern="app-yellow">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black uppercase text-[#794f27]">Island Clock</span>
                <Icon name="icon-miles" size={24} bounce />
              </div>
              <div className="admin-sidebar-time mt-3">
                <Time />
              </div>
              <p className="mt-3 text-xs leading-5 text-[#8a7b66]">
                先看发生了什么，再决定要不要动长期状态。
              </p>
            </Card>
          </div>

          <nav className="mt-4 flex gap-2 overflow-x-auto pb-2 lg:mt-6 lg:block lg:space-y-2 lg:overflow-visible lg:pb-0">
            {navItems.map((item) => {
              const active = item.section === activeSection;
              return (
                <button
                  key={item.section}
                  type="button"
                  onClick={() => onNavigate(item.section)}
                  className={`admin-nav-button group flex min-w-[10rem] items-center gap-3 px-3 py-3 text-left lg:w-full ${
                    active ? "admin-nav-button-active" : "admin-nav-button-idle"
                  }`}
                >
                  <span
                    className={`admin-nav-index flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] ${active ? item.accentClass : "bg-[#f7f3df] text-[#9f927d]"}`}
                  >
                    <Icon name={item.icon} size={22} bounce={active} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="block truncate text-sm font-black text-[#794f27]">{item.label}</span>
                      <span className="text-[10px] font-black text-[#c4b89e]">{item.index}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#9f927d]">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-h-0 flex-col">
          <header className="admin-island-main-header border-b px-4 py-4 backdrop-blur md:px-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="admin-chip admin-chip-mint">
                    <Icon name={activeItem.icon} size={18} />
                    Admin / {activeItem.label}
                  </span>
                  <span className="admin-chip admin-chip-yellow">{activeItem.index}</span>
                </div>
                <h1 className="text-2xl font-black leading-tight text-[#794f27] md:text-3xl">
                  {activeItem.description}
                </h1>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(12rem,1fr)_minmax(18rem,24rem)] xl:w-[44rem]">
                <Card className="px-4 py-3" pattern={activeItem.color}>
                  <div className="text-[11px] font-black uppercase text-[#794f27]">API Base</div>
                  <div className="mt-1 truncate text-sm font-bold text-[#725d42]" title={apiBaseUrl}>
                    {apiBaseUrl}
                  </div>
                </Card>

                <Card className="px-4 py-3" pattern="app-teal">
                  <div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-black uppercase text-[#794f27]">
                    <span>Admin Token</span>
                    <span className={adminToken ? "text-[#17766e]" : "text-[#a85565]"}>
                      {adminToken ? "已保存" : "未配置"}
                    </span>
                  </div>
                  <Input
                    value={adminToken}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onAdminTokenChange(event.target.value)}
                    onClear={() => onAdminTokenChange("")}
                    placeholder="Bearer token，本地保存"
                    type="password"
                    size="middle"
                    shadow
                    allowClear
                  />
                </Card>
              </div>
            </div>
          </header>

          <div className="admin-island-content min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7 md:py-7">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
