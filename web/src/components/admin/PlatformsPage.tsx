import type { ReactNode } from "react";

type PlatformStatus = "ready" | "planning" | "placeholder";

interface PlatformSummary {
  id: string;
  name: string;
  subtitle: string;
  status: PlatformStatus;
  accent: string;
  description: string;
  capabilities: string[];
  metrics: Array<{ label: string; value: string }>;
}

interface PlatformsPageProps {
  onOpenPlatform: (platformId: string) => void;
}

interface XiaohongshuPlatformPageProps {
  onBack: () => void;
}

const platforms: PlatformSummary[] = [
  {
    id: "xiaohongshu",
    name: "小红书",
    subtitle: "评论、笔记、互动信号",
    status: "placeholder",
    accent: "#d86a50",
    description:
      "给小红书单独留一个工作台：连接状态、评论读取、回复草稿、平台日志以后都收在这里。",
    capabilities: ["评论读取", "笔记观察", "回复草稿", "互动归档"],
    metrics: [
      { label: "连接", value: "待接入" },
      { label: "任务", value: "0" },
      { label: "日志", value: "0" },
    ],
  },
  {
    id: "bilibili",
    name: "B站",
    subtitle: "视频、评论、弹幕反馈",
    status: "planning",
    accent: "#6f8fb8",
    description:
      "后续可接视频评论、弹幕摘要、创作反馈整理。当前只保留平台入口位置。",
    capabilities: ["评论同步", "弹幕摘要", "创作反馈", "素材线索"],
    metrics: [
      { label: "连接", value: "规划中" },
      { label: "任务", value: "-" },
      { label: "日志", value: "-" },
    ],
  },
];

function statusText(status: PlatformStatus): string {
  if (status === "ready") return "已接入";
  if (status === "planning") return "规划中";
  return "占位中";
}

function statusClass(status: PlatformStatus): string {
  if (status === "ready") return "border-[#b9d8c7] bg-[#eef8f2] text-[#3f7b5d]";
  if (status === "planning") return "border-[#d9e2ec] bg-[#f8fbff] text-[#66758a]";
  return "border-[#e4d8b6] bg-[#fff9e8] text-[#7d6a34]";
}

export function PlatformsPage({ onOpenPlatform }: PlatformsPageProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Platform Directory</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">平台工作台</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              这里只展示外部平台入口。平台自己的连接设置、读取能力、任务和日志放到各自详情页里，避免把通用工具页搅成杂物间。
            </p>
          </div>
          <div className="rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 py-3 text-sm text-[#66758a]">
            当前阶段：先占位信息架构，后续逐个平台接真实能力。
          </div>
        </div>
      </section>

      <section className="columns-1 gap-5 md:columns-2 xl:columns-3">
        {platforms.map((platform, index) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            tall={index % 2 === 0}
            onOpen={() => onOpenPlatform(platform.id)}
          />
        ))}

        <div className="mb-5 inline-block w-full break-inside-avoid rounded-lg border border-dashed border-[#c9d7e6] bg-white/70 p-5">
          <div className="text-xs font-semibold text-[#8a6f5a]">Next Slots</div>
          <h3 className="mt-2 text-lg font-semibold text-[#172033]">预留更多平台</h3>
          <p className="mt-2 text-sm leading-6 text-[#66758a]">
            公众号、抖音、知乎、微博这类平台都可以按同一结构接进来：先平台工作台，再按需要暴露成 LLM 工具。
          </p>
        </div>
      </section>
    </div>
  );
}

function PlatformCard({
  platform,
  tall,
  onOpen,
}: {
  platform: PlatformSummary;
  tall: boolean;
  onOpen: () => void;
}) {
  const available = platform.id === "xiaohongshu";

  return (
    <article className="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-lg border border-[#d9e2ec] bg-white shadow-sm">
      <div className="h-1.5" style={{ backgroundColor: platform.accent }} />
      <div className={tall ? "p-5 md:p-6" : "p-5"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-[#7b8ca2]">{platform.subtitle}</div>
            <h3 className="mt-1 text-2xl font-semibold text-[#172033]">{platform.name}</h3>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${statusClass(platform.status)}`}>
            {statusText(platform.status)}
          </span>
        </div>

        <p className="mt-4 text-sm leading-7 text-[#617188]">{platform.description}</p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          {platform.metrics.map((metric) => (
            <div key={metric.label} className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-3 py-2">
              <div className="text-[11px] text-[#7b8ca2]">{metric.label}</div>
              <div className="mt-1 truncate text-sm font-semibold text-[#172033]">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {platform.capabilities.map((capability) => (
            <span
              key={capability}
              className="rounded-full border border-[#d9e2ec] bg-white px-2.5 py-1 text-xs text-[#66758a]"
            >
              {capability}
            </span>
          ))}
        </div>

        {available ? (
          <a
            href={`/admin/platforms/${platform.id}`}
            onClick={(event) => {
              event.preventDefault();
              onOpen();
            }}
            className="mt-5 flex h-10 w-full items-center justify-center rounded-lg border border-[#a9bfd7] bg-[#eaf2fb] px-4 text-sm font-medium text-[#27496d] transition hover:bg-[#ddebf7]"
          >
            进入{platform.name}
          </a>
        ) : (
          <div className="mt-5 flex h-10 w-full items-center justify-center rounded-lg border border-[#d9e2ec] bg-[#f8fbff] px-4 text-sm font-medium text-[#9aa8b8]">
            详情待规划
          </div>
        )}
      </div>
    </article>
  );
}

export function XiaohongshuPlatformPage({ onBack }: XiaohongshuPlatformPageProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="rounded-lg border border-[#d9e2ec] bg-white p-6 shadow-[0_18px_48px_rgba(91,117,150,0.13)] md:p-7">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-[#c9d7e6] bg-[#f8fbff] px-3 py-2 text-sm font-medium text-[#66758a] transition hover:bg-[#eef5fb]"
        >
          返回平台目录
        </button>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold text-[#8a6f5a]">Platform / Xiaohongshu</div>
            <h2 className="mt-2 text-3xl font-semibold text-[#172033]">小红书工作台</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#617188]">
              这是占位详情页。后续小红书相关的连接配置、评论读取、回复草稿和平台日志都放在这里，不挤进通用工具页。
            </p>
          </div>
          <span className="w-fit rounded-full border border-[#e4d8b6] bg-[#fff9e8] px-3 py-1.5 text-xs font-medium text-[#7d6a34]">
            占位中
          </span>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="连接设置" subtitle="以后接账号、浏览器和频率限制">
          <Checklist
            items={[
              "CDP 浏览器连接状态",
              "小红书登录态检查",
              "默认主页 / 笔记 / 评论 URL",
              "读取频率和失败重试策略",
            ]}
          />
        </Panel>

        <Panel title="内容读取" subtitle="小红书平台自己的能力">
          <div className="grid gap-3 md:grid-cols-2">
            <Capability title="读取笔记" detail="读取标题、正文、图片说明和基础互动数据。" />
            <Capability title="读取评论" detail="读取评论列表、楼中楼、作者、时间和点赞数。" />
            <Capability title="互动分类" detail="把评论分成问题、反馈、负面、合作、闲聊等。" />
            <Capability title="回复草稿" detail="生成待审核回复，不自动发送。" />
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel title="任务" subtitle="平台内任务，不单独拆到工作流">
          <EmptyBlock>
            未来这里放“检查新评论”“生成回复草稿”“同步互动记录”等小红书专属任务。
          </EmptyBlock>
        </Panel>
        <Panel title="暴露给 LLM" subtitle="哪些能力允许模型调用">
          <EmptyBlock>
            后续可以在这里控制 `read_xiaohongshu_comments` 这类专用工具的 on / owner only / off。
          </EmptyBlock>
        </Panel>
        <Panel title="平台日志" subtitle="读取、解析和任务执行记录">
          <EmptyBlock>
            这里会聚合小红书相关日志，通用工具页只保留底层 tool_call_logs。
          </EmptyBlock>
        </Panel>
      </section>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#d9e2ec] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="font-semibold text-[#172033]">{title}</h3>
        <p className="mt-1 text-xs text-[#7b8ca2]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item} className="flex items-center gap-3 rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-3 py-2 text-sm text-[#475569]">
          <span className="h-2 w-2 rounded-full bg-[#d86a50]/70" />
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function Capability({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-[#e5edf5] bg-[#f8fbff] px-4 py-3">
      <div className="font-medium text-[#172033]">{title}</div>
      <div className="mt-2 text-sm leading-6 text-[#66758a]">{detail}</div>
    </div>
  );
}

function EmptyBlock({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-[#c9d7e6] bg-[#f8fbff] px-4 py-5 text-sm leading-7 text-[#66758a]">
      {children}
    </div>
  );
}
