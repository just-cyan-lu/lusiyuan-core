import { useMemo, type ReactNode } from "react";
import { Icon } from "animal-island-ui";
import type { AdminSection } from "./AdminShell";
import bgImage from "../../assets/home/bg.PNG";

interface IslandHomePageProps {
  onNavigate: (section: AdminSection) => void;
}

interface ModuleState {
  label: string;
  status: "ok" | "warn" | "off" | "running";
  statusText: string;
  extra?: string;
  detail: string;
  route: AdminSection;
}

interface TimelineEvent {
  time: string;
  icon: "telegram" | "lighthouse" | "archive";
  text: string;
}

interface Person {
  name: string;
  avatarColor: string;
}

interface IslandData {
  greeting: string;
  status: {
    summary: string;
    activity: string;
    recentAction: string;
  };
  weather: {
    label: string;
    wave: string;
    wind: string;
    dreamActivity: string;
    reflectionActivity: string;
  };
  modules: Record<string, ModuleState>;
  relations: {
    statusText: string;
    people: Person[];
  };
  timeline: TimelineEvent[];
}

const mockIslandData: IslandData = {
  greeting: "今天记忆流入有点快，记得帮我看看。",
  status: {
    summary: "今天整体还算平稳。",
    activity: "写作日记",
    recentAction: "更新记忆片段",
  },
  weather: {
    label: "晴间多云",
    wave: "平静",
    wind: "东南风 2级",
    dreamActivity: "稳定",
    reflectionActivity: "稳定",
  },
  modules: {
    reflection: {
      label: "Reflection",
      status: "running",
      statusText: "运行中",
      detail: "帮陆思源整理刚发生的事。最近运行：12:45。",
      route: "ops",
    },
    dream: {
      label: "Dream",
      status: "ok",
      statusText: "平和稳定",
      detail: "梦境、联想、长期情绪氛围。最近：昨晚。",
      route: "dream",
    },
    memory: {
      label: "Memory",
      status: "ok",
      statusText: "新增",
      extra: "3",
      detail: "记忆存储、检索、证据。待审核：0。",
      route: "memory",
    },
    tools: {
      label: "Tools",
      status: "running",
      statusText: "调用中",
      detail: "工具调用、页面读取、Web Search、MCP 均已启用。",
      route: "tools",
    },
    channels: {
      label: "Channels",
      status: "running",
      statusText: "运行中",
      detail: "Telegram 已启用；Weixin 尚未开放。",
      route: "platforms",
    },
    model: {
      label: "Model",
      status: "ok",
      statusText: "当前模型",
      extra: "MiniMax-M3",
      detail: "当前思考引擎。Provider：MiniMax。",
      route: "settings",
    },
    safety: {
      label: "Safety",
      status: "ok",
      statusText: "防护正常",
      detail: "边界、自治、安全限制均正常。",
      route: "runtime",
    },
  },
  relations: {
    statusText: "活跃",
    people: [
      { name: "陈屿", avatarColor: "#f8a6b2" },
      { name: "群聊", avatarColor: "#889df0" },
      { name: "Admin", avatarColor: "#f7cd67" },
    ],
  },
  timeline: [
    { time: "12:41", icon: "telegram", text: "Telegram 码头收到一条新消息" },
    { time: "12:45", icon: "lighthouse", text: "灯塔完成一次整理" },
    { time: "12:53", icon: "archive", text: "档案馆收下了3条新记忆" },
  ],
};

function statusColor(status: ModuleState["status"]): string {
  switch (status) {
    case "ok":
      return "bg-[#7bc47b]";
    case "running":
      return "bg-[#f7cd67]";
    case "warn":
      return "bg-[#e59266]";
    case "off":
    default:
      return "bg-[#b19a82]";
  }
}

function ModuleCard({
  module,
  onClick,
  className = "",
  children,
}: {
  module: ModuleState;
  onClick: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={module.detail}
      className={`group absolute flex flex-col items-start transition-all duration-200 ease-out hover:scale-105 focus:outline-none ${className}`}
    >
      {children}
      <div className="admin-island-module-card flex min-w-[7.5rem] items-center gap-2 rounded-xl border-2 border-[#8a6f5a] bg-[#c4a878] px-3 py-2 shadow-[0_4px_0_#8a6f5a,0_8px_16px_rgba(91,75,55,0.2)]">
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusColor(module.status)}`} />
        <span className="flex-1 text-left">
          <span className="block text-xs font-black text-white">{module.label}</span>
          <span className="flex items-center gap-1 text-[10px] font-bold text-white/90">
            {module.statusText}
            {module.extra && <span>· {module.extra}</span>}
          </span>
        </span>
        <span className="text-xs font-black text-white/80">›</span>
      </div>
    </button>
  );
}

function WeatherPanel({ weather }: { weather: IslandData["weather"] }) {
  return (
    <div className="admin-island-weather-panel absolute right-4 top-4 z-20 w-52 rounded-2xl border-2 border-white/70 bg-white/85 p-4 shadow-lg backdrop-blur-sm md:right-8 md:top-6 md:w-56">
      <div className="space-y-2 text-sm font-bold text-[var(--ls-ink-strong)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-[var(--ls-ink)]">
            <span>☀️</span> 天气
          </span>
          <span>{weather.label}</span>
        </div>
        <div className="flex items-center justify-between text-[var(--ls-ink-soft)]">
          <span className="flex items-center gap-2">
            <span>🌊</span> 海浪
          </span>
          <span className="text-[var(--ls-ink)]">{weather.wave}</span>
        </div>
        <div className="flex items-center justify-between text-[var(--ls-ink-soft)]">
          <span className="flex items-center gap-2">
            <span>💨</span> 风向
          </span>
          <span className="text-[var(--ls-ink)]">{weather.wind}</span>
        </div>
        <div className="flex items-center justify-between text-[var(--ls-ink-soft)]">
          <span className="flex items-center gap-2">
            <span>✨</span> Dream活跃
          </span>
          <span className="flex items-center gap-1 text-[var(--ls-ink)]">
            <span className="h-2 w-2 rounded-full bg-[var(--ls-green)]" />
            {weather.dreamActivity}
          </span>
        </div>
        <div className="flex items-center justify-between text-[var(--ls-ink-soft)]">
          <span className="flex items-center gap-2">
            <span>💡</span> Reflection活跃
          </span>
          <span className="flex items-center gap-1 text-[var(--ls-ink)]">
            <span className="h-2 w-2 rounded-full bg-[var(--ls-green)]" />
            {weather.reflectionActivity}
          </span>
        </div>
      </div>
    </div>
  );
}

function PersonChip({ person }: { person: Person }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border-2 border-white/70 bg-white/80 px-2 py-1 shadow-sm backdrop-blur-sm">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black text-white"
        style={{ backgroundColor: person.avatarColor }}
      >
        {person.name.charAt(0)}
      </div>
      <span className="text-xs font-black text-[var(--ls-ink-strong)]">{person.name}</span>
    </div>
  );
}

function TimelineBar({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="pointer-events-auto absolute bottom-0 left-0 right-0 z-30 border-t-4 border-[#9a835a] bg-[#d4c9b4] px-3 py-3 shadow-[0_-4px_20px_rgba(91,75,55,0.15)] md:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 md:flex-row md:items-center">
        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-[#c4a878] px-3 py-2 text-sm font-black text-white shadow-[0_3px_0_#8a6f5a]">
          <span>📜</span>
          <span>今日岛志 / Timeline</span>
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {events.map((event, index) => (
            <button
              key={index}
              type="button"
              className="admin-island-timeline-chip flex flex-1 items-center gap-2 rounded-xl border-2 border-[#e8dcc8] bg-[#fff9e8] px-3 py-2 text-left text-xs font-bold text-[var(--ls-ink-strong)] shadow-sm transition-transform hover:scale-[1.02]"
            >
              <span className="text-base">
                {event.icon === "telegram" && "✈️"}
                {event.icon === "lighthouse" && "🗼"}
                {event.icon === "archive" && "📝"}
              </span>
              <span className="text-[10px] font-black text-[var(--ls-ink-faint)]">{event.time}</span>
              <span className="flex-1">{event.text}</span>
              <span className="text-[var(--ls-ink-faint)]">›</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-xl bg-[#c4a878] px-3 py-2 text-xs font-black text-white shadow-[0_3px_0_#8a6f5a] transition-transform hover:scale-105"
        >
          查看全部记录
        </button>
      </div>
    </div>
  );
}


export function IslandHomePage({ onNavigate }: IslandHomePageProps) {
  const data = useMemo(() => mockIslandData, []);

  return (
    <div className="relative h-full min-h-[46rem] w-full overflow-hidden rounded-none md:min-h-[52rem]">
      {/* Background image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${bgImage})` }}
      />

      {/* Soft vignette for readability */}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/5 via-transparent to-black/10" />

      {/* Top header bar */}
      <div className="pointer-events-auto absolute left-2 right-2 top-2 z-30 flex items-center justify-between gap-3 rounded-2xl border-2 border-[#e8dcc8] bg-[#fff9e8]/92 px-3 py-2 shadow-[0_6px_0_#c4b89e,0_12px_24px_rgba(91,75,55,0.15)] backdrop-blur-sm md:left-4 md:right-4 md:top-4 md:px-5 md:py-3">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#8a6f5a] bg-[var(--ls-yellow-soft)] text-sm font-black text-[var(--ls-ink-strong)] shadow-sm md:h-11 md:w-11 md:rounded-2xl md:text-base">
            源
          </div>
          <div>
            <div className="text-sm font-black text-[var(--ls-ink-strong)] md:text-base">Lusiyuan Core</div>
            <div className="hidden text-[10px] font-bold text-[var(--ls-ink-soft)] md:block">Island Home</div>
          </div>
          <button
            type="button"
            className="hidden h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--ls-border)] bg-white/60 text-[var(--ls-ink-soft)] md:flex"
          >
            ▼
          </button>
        </div>

        <div className="hidden text-center md:block">
          <h1 className="text-xl font-black leading-tight text-[var(--ls-ink-strong)] md:text-2xl">陆思源此刻的岛</h1>
          <p className="text-xs font-bold text-[var(--ls-ink-soft)]">先看看他现在过得怎么样，再决定要不要动配置。</p>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="admin-island-ghost-btn flex h-8 items-center gap-1 rounded-full border-2 border-[var(--ls-border)] bg-white/70 px-2.5 text-[10px] font-black text-[var(--ls-ink-strong)] shadow-sm backdrop-blur-sm md:h-9 md:px-3 md:text-xs"
          >
            <Icon name="icon-variant" size={14} />
            <span className="hidden sm:inline">刷新状态</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("settings")}
            className="admin-island-ghost-btn flex h-8 items-center gap-1 rounded-full border-2 border-[var(--ls-border)] bg-white/70 px-2.5 text-[10px] font-black text-[var(--ls-ink-strong)] shadow-sm backdrop-blur-sm md:h-9 md:px-3 md:text-xs"
          >
            <Icon name="icon-diy" size={14} />
            <span className="hidden sm:inline">系统设置</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("overview")}
            className="admin-island-ghost-btn flex h-8 items-center gap-1 rounded-full border-2 border-[var(--ls-border)] bg-white/70 px-2.5 text-[10px] font-black text-[var(--ls-ink-strong)] shadow-sm backdrop-blur-sm md:h-9 md:px-3 md:text-xs"
          >
            <Icon name="icon-map" size={14} />
            <span className="hidden sm:inline">返回旧版控制台</span>
          </button>
        </div>
      </div>

      {/* Weather panel */}
      <WeatherPanel weather={data.weather} />

      {/* Dream label */}
      <button
        type="button"
        onClick={() => onNavigate(data.modules.dream.route)}
        className="pointer-events-auto absolute left-[4%] top-[22%] z-20 flex flex-col items-start transition-transform hover:scale-105 md:left-[6%] md:top-[24%]"
      >
        <span className="text-lg font-black text-white drop-shadow-md md:text-2xl">Dream</span>
        <span className="mt-1 flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[var(--ls-ink)] shadow-sm backdrop-blur-sm md:text-xs">
          <span className="h-2 w-2 rounded-full bg-[var(--ls-green)]" />
          情绪氛围：{data.modules.dream.statusText}
        </span>
      </button>

      {/* Reflection lighthouse */}
      <ModuleCard
        module={data.modules.reflection}
        onClick={() => onNavigate(data.modules.reflection.route)}
        className="left-[6%] top-[42%] md:left-[8%] md:top-[44%]"
      >
        <div className="relative mb-1 flex h-28 w-14 flex-col items-center md:h-32 md:w-16">
          <div className="h-9 w-10 rounded-t-full bg-[#5a7a9a] md:h-10 md:w-11" />
          <div className="h-16 w-9 bg-[#f8f8f0] shadow-md md:h-18 md:w-10" />
          <div className="h-3 w-14 rounded-full bg-[#8a6f5a] md:w-16" />
          <div className="absolute right-[-10px] top-6 h-10 w-10 rounded-full bg-[var(--ls-yellow)]/40 blur-md md:top-7" />
        </div>
      </ModuleCard>

      {/* Channels dock */}
      <ModuleCard
        module={data.modules.channels}
        onClick={() => onNavigate(data.modules.channels.route)}
        className="left-[8%] top-[72%] md:left-[10%] md:top-[70%]"
      >
        <div className="relative mb-2 flex h-16 w-36 items-end justify-center gap-2 rounded-lg border-b-4 border-[#8a6f5a] bg-[#c4a878] p-2 shadow-md md:h-18 md:w-44">
          <div className="relative flex h-10 w-14 items-center justify-center rounded-lg bg-white shadow-sm md:h-11 md:w-16">
            <span className="text-[10px] font-black text-[var(--ls-ink-strong)]">Telegram</span>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ls-red)] text-[9px] font-black text-white">2</span>
          </div>
          <div className="relative flex h-10 w-14 items-center justify-center rounded-lg bg-white shadow-sm md:h-11 md:w-16">
            <span className="text-[10px] font-black text-[var(--ls-ink-strong)]">Weixin</span>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--ls-red)] text-[9px] font-black text-white">1</span>
          </div>
        </div>
      </ModuleCard>

      {/* Core House */}
      <div className="pointer-events-none absolute left-1/2 top-[34%] z-10 flex -translate-x-1/2 flex-col items-center md:top-[36%]">
        <div className="relative">
          <div className="flex h-28 w-32 flex-col items-center md:h-36 md:w-40">
            <div
              className="h-14 w-[130%] bg-[#f7cd67] shadow-md md:h-16"
              style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }}
            />
            <div className="h-16 w-28 rounded-b-xl bg-[#fff9e8] shadow-lg md:h-20 md:w-36" />
            <div className="absolute bottom-3 h-12 w-9 rounded-t-full border-2 border-[#8a6f5a] bg-[#c4a878] md:bottom-4 md:h-14 md:w-11" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border-2 border-[#8a6f5a] bg-[#c4a878] px-3 py-1 text-[10px] font-black text-white shadow-sm md:text-xs">
            Lusiyuan Core
          </div>
        </div>
      </div>

      {/* Lusiyuan character */}
      <button
        type="button"
        onClick={() => onNavigate("runtime")}
        className="pointer-events-auto absolute left-[34%] top-[46%] z-20 flex flex-col items-center transition-transform hover:scale-105 md:left-[36%] md:top-[48%]"
      >
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-[var(--ls-pink)] text-xl font-black text-white shadow-lg md:h-16 md:w-16 md:text-2xl">
            源
          </div>
          <div className="mt-1 h-9 w-11 rounded-lg bg-[var(--ls-blue)] shadow-sm md:h-10 md:w-12" />
        </div>
      </button>

      {/* Speech bubble */}
      <div className="pointer-events-none absolute left-[36%] top-[30%] z-20 w-44 -translate-x-1/2 rounded-2xl border-2 border-white bg-white/90 p-3 text-center text-xs font-bold text-[var(--ls-ink-strong)] shadow-md backdrop-blur-sm md:left-[38%] md:top-[32%] md:w-52 md:text-sm">
        {data.greeting}
        <div className="absolute -bottom-2 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-white bg-white/90" />
      </div>

      {/* Status card below house */}
      <div className="pointer-events-auto absolute left-1/2 top-[58%] z-20 w-56 -translate-x-1/2 rounded-2xl border-2 border-white/70 bg-white/85 p-3 shadow-lg backdrop-blur-sm md:top-[60%] md:w-64">
        <div className="text-sm font-black text-[var(--ls-ink-strong)]">{data.status.summary}</div>
        <div className="mt-2 space-y-1.5 text-xs font-bold text-[var(--ls-ink)]">
          <div className="flex items-center gap-2">
            <span className="text-[var(--ls-ink-faint)]">📝 当前活动</span>
            <span>{data.status.activity}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--ls-ink-faint)]">🕐 最近动作</span>
            <span>{data.status.recentAction}</span>
          </div>
        </div>
      </div>

      {/* Memory house */}
      <ModuleCard
        module={data.modules.memory}
        onClick={() => onNavigate(data.modules.memory.route)}
        className="left-[52%] top-[38%] md:left-[54%] md:top-[40%]"
      >
        <div className="relative mb-1 flex h-20 w-24 flex-col items-center md:h-24 md:w-28">
          <div className="h-10 w-24 rounded-t-2xl bg-[#6a9e6a] shadow-md md:h-12 md:w-28" />
          <div className="h-12 w-20 rounded-b-lg bg-[#fff9e8] shadow-md md:h-14 md:w-24" />
          <div className="absolute bottom-4 h-6 w-5 rounded-t-full bg-[var(--ls-yellow)] md:bottom-5" />
        </div>
      </ModuleCard>

      {/* Tools workshop */}
      <ModuleCard
        module={data.modules.tools}
        onClick={() => onNavigate(data.modules.tools.route)}
        className="left-[68%] top-[44%] md:left-[70%] md:top-[46%]"
      >
        <div className="relative mb-1 flex h-20 w-24 flex-col items-center md:h-24 md:w-28">
          <div className="flex h-8 w-22 items-end justify-center gap-1 rounded-t-xl bg-[#7a7a8a] md:h-9 md:w-26">
            <div className="h-5 w-5 rounded-t bg-[var(--ls-blue)]/70 md:h-6 md:w-6" />
            <div className="h-5 w-5 rounded-t bg-[var(--ls-blue)]/70 md:h-6 md:w-6" />
          </div>
          <div className="h-12 w-20 rounded-b-xl bg-[#d4c9b4] shadow-md md:h-14 md:w-24" />
          <div className="absolute -top-3 flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#8a6f5a] bg-[var(--ls-yellow-soft)] text-lg shadow-sm md:-top-4 md:h-10 md:w-10">
            ⚙️
          </div>
        </div>
      </ModuleCard>

      {/* Model compass platform */}
      <ModuleCard
        module={data.modules.model}
        onClick={() => onNavigate(data.modules.model.route)}
        className="right-[2%] top-[42%] md:right-[4%] md:top-[44%]"
      >
        <div className="relative mb-2 flex h-20 w-22 flex-col items-center md:h-24 md:w-24">
          <div className="flex h-8 w-20 items-center justify-center rounded-t-lg border-2 border-[#8a6f5a] bg-[#c4a878] md:h-9 md:w-22">
            <div className="h-5 w-5 rotate-45 transform rounded-sm bg-[var(--ls-yellow)]" />
          </div>
          <div className="h-10 w-20 rounded-b-lg bg-[#9a835a] shadow-md md:h-12 md:w-22" />
          <div className="absolute -top-4 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#8a6f5a] bg-[var(--ls-yellow-soft)] text-lg shadow-sm md:-top-5 md:h-11 md:w-11">
            🧭
          </div>
        </div>
      </ModuleCard>

      {/* Relations tree */}
      <button
        type="button"
        onClick={() => onNavigate("relationships")}
        className="group pointer-events-auto absolute left-[54%] top-[66%] z-20 flex -translate-x-1/2 flex-col items-center transition-transform hover:scale-105 md:left-[56%] md:top-[66%]"
      >
        <div className="admin-island-module-card mb-2 flex min-w-[7rem] items-center gap-2 rounded-xl border-2 border-[#8a6f5a] bg-[#c4a878] px-3 py-2 shadow-[0_4px_0_#8a6f5a]">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--ls-green)]" />
          <span className="text-xs font-black text-white">Relations</span>
          <span className="text-[10px] font-bold text-white/90">{data.relations.statusText}</span>
          <span className="text-xs font-black text-white/80">›</span>
        </div>
        <div className="relative flex h-24 w-24 flex-col items-center justify-end md:h-28 md:w-28">
          <div className="h-14 w-24 rounded-full bg-[var(--ls-green)] shadow-md md:h-16 md:w-28" />
          <div className="h-12 w-4 bg-[#8a6f5a]" />
          <div className="absolute top-1 flex flex-wrap justify-center gap-1 px-2">
            {data.relations.people.map((person, idx) => (
              <PersonChip key={idx} person={person} />
            ))}
          </div>
        </div>
      </button>

      {/* Safety */}
      <ModuleCard
        module={data.modules.safety}
        onClick={() => onNavigate(data.modules.safety.route)}
        className="right-[4%] top-[74%] md:right-[6%] md:top-[72%]"
      >
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#8a6f5a] bg-[var(--ls-mint-light)] text-lg shadow-sm md:h-11 md:w-11">
          🛡️
        </div>
      </ModuleCard>

      {/* Timeline */}
      <TimelineBar events={data.timeline} />
    </div>
  );
}
