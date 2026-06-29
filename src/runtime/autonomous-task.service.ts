import { Prisma, type AutonomousArtifact, type AutonomousTask, type AutonomousTaskRun } from "@prisma/client";
import { modelProvider } from "../core/model-provider.js";
import { prisma } from "../db/prisma.js";

export const autonomousTaskTypes = [
  "reading",
  "game_research",
  "content_creation",
  "self_growth",
  "open_research",
  "custom",
] as const;

export type AutonomousTaskType = (typeof autonomousTaskTypes)[number];
export type AutonomousTaskStatus = "active" | "paused" | "completed" | "abandoned";
export type AutonomousTaskRunTrigger = "manual" | "autonomy_tick";

export interface CreateAutonomousTaskInput {
  title: string;
  description: string;
  type?: string;
  priority?: number;
  currentStep?: string | null;
  nextStep?: string | null;
  createdBy?: string;
}

export interface UpdateAutonomousTaskInput {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  priority?: number;
  currentStep?: string | null;
  nextStep?: string | null;
}

interface TaskStepModelOutput {
  summary?: string;
  plan?: {
    objective?: string;
    thisStep?: string;
    method?: string;
    expectedArtifact?: string;
    doneCriteria?: string;
  };
  artifact?: {
    kind?: string;
    title?: string;
    content?: string;
  };
  currentStep?: string | null;
  nextStep?: string | null;
  status?: string;
  notes?: string[];
}

export interface AutonomousTaskRunResult {
  status: "completed" | "skipped" | "failed";
  summary: string;
  task: AutonomousTask | null;
  run: AutonomousTaskRun | null;
  artifact: AutonomousArtifact | null;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.round(parsed), min), max);
}

function cleanText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxChars ? `${trimmed.slice(0, maxChars - 1)}…` : trimmed;
}

function cleanNullableText(value: unknown, maxChars: number): string | null | undefined {
  if (value === null) return null;
  return cleanText(value, maxChars);
}

function normalizeType(value: unknown): AutonomousTaskType {
  return autonomousTaskTypes.includes(value as AutonomousTaskType)
    ? value as AutonomousTaskType
    : "custom";
}

function normalizeStatus(value: unknown): AutonomousTaskStatus | undefined {
  if (value === "active" || value === "paused" || value === "completed" || value === "abandoned") {
    return value;
  }
  return undefined;
}

function taskTemplate(type: string): string {
  switch (type) {
    case "reading":
      return [
        "读书/资料任务：不要一次假装读完整本书。",
        "每轮只做一小步：提一个问题、整理一个观点、写一段自己的理解，或生成下一步阅读计划。",
      ].join("\n");
    case "game_research":
      return [
        "游戏研究任务：可以整理机制、路线、攻略、角色理解或自己的游玩计划。",
        "每轮输出一个可继续累积的小成果，不要写成空泛总结。",
      ].join("\n");
    case "content_creation":
      return [
        "内容创作任务：适合小红书/B站/动态草稿。",
        "每轮可以做选题、角度、标题、正文片段、发布计划或复盘。",
      ].join("\n");
    case "self_growth":
      return [
        "自我成长任务：整理陆思源自己的表达、喜好、边界、长期想法。",
        "每轮要留下能复用的观察或规则，不要只写情绪散文。",
      ].join("\n");
    case "open_research":
      return [
        "开放研究任务：先界定问题，再拆小步。",
        "没有外部工具结果时，不要编造事实；可以产出问题清单、假设和下一步资料需求。",
      ].join("\n");
    default:
      return [
        "自定义任务：先根据任务描述自己选择流程。",
        "每轮必须落成一个小产物，并给出下一步。",
      ].join("\n");
  }
}

function artifactKind(value: unknown): string {
  const kind = cleanText(value, 40) ?? "note";
  return /^[a-zA-Z0-9_-]+$/.test(kind) ? kind : "note";
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

async function recentTaskArtifacts(taskId: string): Promise<AutonomousArtifact[]> {
  return prisma.autonomousArtifact.findMany({
    where: { taskId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
}

async function hasRunningTaskRun(): Promise<boolean> {
  const count = await prisma.autonomousTaskRun.count({
    where: { status: "running" },
  });
  return count > 0;
}

async function selectNextIdleTask(): Promise<AutonomousTask | null> {
  return prisma.autonomousTask.findFirst({
    where: { status: "active" },
    orderBy: [
      { priority: "desc" },
      { lastRunAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
  });
}

async function generateTaskStep(input: {
  task: AutonomousTask;
  artifacts: AutonomousArtifact[];
  trigger: AutonomousTaskRunTrigger;
  signal?: AbortSignal;
}): Promise<TaskStepModelOutput> {
  const { task, artifacts, trigger, signal } = input;
  return modelProvider.chatJson<TaskStepModelOutput>([
    {
      role: "system",
      content: [
        "你是陆思源的自主活动执行模块。",
        "你的任务不是和用户聊天，而是在无人打扰时替陆思源推进一件他正在做的事。",
        "陆思源是一个有自己兴趣、表达欲和连续生活感的聊天机器人；产物要像他自己真的想过一点东西。",
        "每次只推进一小步，不要一口气把长期任务全部做完。",
        "如果缺少外部资料，不要编造事实；可以写下一步需要查什么，或先整理已有想法。",
        "只输出 JSON，不要 Markdown 围栏。",
      ].join("\n"),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          trigger,
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            type: task.type,
            priority: task.priority,
            currentStep: task.currentStep,
            nextStep: task.nextStep,
          },
          taskTemplate: taskTemplate(task.type),
          recentArtifacts: artifacts.map((artifact) => ({
            kind: artifact.kind,
            title: artifact.title,
            content: artifact.content.slice(0, 1600),
            createdAt: artifact.createdAt.toISOString(),
          })),
          requiredJsonShape: {
            summary: "一句话说明本轮推进了什么",
            plan: {
              objective: "这件任务长期想达成什么",
              thisStep: "本轮只做哪一小步",
              method: "本轮怎么做",
              expectedArtifact: "本轮产物是什么",
              doneCriteria: "本轮做到什么算完成",
            },
            artifact: {
              kind: "note|draft|plan|outline|reflection|research",
              title: "产物标题",
              content: "本轮真实产物，尽量完整，但不要假装完成整个长期任务",
            },
            currentStep: "当前进度一句话",
            nextStep: "下一次空闲时继续做什么",
            status: "active|completed",
            notes: ["可选，风险、缺资料或需要 owner 审核的地方"],
          },
        },
        null,
        2
      ),
    },
  ], signal ? { signal } : undefined);
}

export const autonomousTaskService = {
  async listTasks(input: {
    status?: string;
    limit?: number;
  } = {}) {
    const status = input.status && input.status !== "all"
      ? normalizeStatus(input.status)
      : undefined;
    return prisma.autonomousTask.findMany({
      where: status ? { status } : undefined,
      orderBy: [
        { status: "asc" },
        { priority: "desc" },
        { updatedAt: "desc" },
      ],
      take: clampInt(input.limit, 80, 1, 200),
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 3,
        },
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });
  },

  async getTask(taskId: string) {
    return prisma.autonomousTask.findUnique({
      where: { id: taskId },
      include: {
        runs: {
          orderBy: { startedAt: "desc" },
          take: 20,
        },
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
  },

  async createTask(input: CreateAutonomousTaskInput) {
    const title = cleanText(input.title, 120);
    const description = cleanText(input.description, 2000);
    if (!title) throw new Error("任务标题不能为空");
    if (!description) throw new Error("任务描述不能为空");

    return prisma.autonomousTask.create({
      data: {
        title,
        description,
        type: normalizeType(input.type),
        priority: clampInt(input.priority, 50, 0, 100),
        currentStep: cleanNullableText(input.currentStep, 240),
        nextStep: cleanNullableText(input.nextStep, 240),
        createdBy: cleanText(input.createdBy, 80) ?? "admin",
      },
    });
  },

  async updateTask(taskId: string, input: UpdateAutonomousTaskInput) {
    const data: Prisma.AutonomousTaskUpdateInput = {};
    if (input.title !== undefined) {
      const title = cleanText(input.title, 120);
      if (!title) throw new Error("任务标题不能为空");
      data.title = title;
    }
    if (input.description !== undefined) {
      const description = cleanText(input.description, 2000);
      if (!description) throw new Error("任务描述不能为空");
      data.description = description;
    }
    if (input.type !== undefined) data.type = normalizeType(input.type);
    if (input.status !== undefined) {
      const status = normalizeStatus(input.status);
      if (!status) throw new Error("任务状态无效");
      data.status = status;
      data.completedAt = status === "completed" ? new Date() : null;
    }
    if (input.priority !== undefined) {
      data.priority = clampInt(input.priority, 50, 0, 100);
    }
    if (input.currentStep !== undefined) {
      data.currentStep = cleanNullableText(input.currentStep, 240);
    }
    if (input.nextStep !== undefined) {
      data.nextStep = cleanNullableText(input.nextStep, 240);
    }

    return prisma.autonomousTask.update({
      where: { id: taskId },
      data,
    });
  },

  async runNextIdleTask(input: {
    trigger: AutonomousTaskRunTrigger;
    signal?: AbortSignal;
  }): Promise<AutonomousTaskRunResult> {
    if (await hasRunningTaskRun()) {
      return {
        status: "skipped",
        summary: "已有自主任务正在运行，本次跳过。",
        task: null,
        run: null,
        artifact: null,
      };
    }

    const task = await selectNextIdleTask();
    if (!task) {
      return {
        status: "skipped",
        summary: "没有可推进的自主任务。",
        task: null,
        run: null,
        artifact: null,
      };
    }

    return this.runTaskStep({
      taskId: task.id,
      trigger: input.trigger,
      signal: input.signal,
    });
  },

  async runTaskStep(input: {
    taskId: string;
    trigger: AutonomousTaskRunTrigger;
    signal?: AbortSignal;
  }): Promise<AutonomousTaskRunResult> {
    const task = await prisma.autonomousTask.findUnique({
      where: { id: input.taskId },
    });
    if (!task) throw new Error("自主任务不存在");
    if (task.status !== "active") {
      return {
        status: "skipped",
        summary: `任务不是 active 状态，当前为 ${task.status}。`,
        task,
        run: null,
        artifact: null,
      };
    }
    if (await hasRunningTaskRun()) {
      return {
        status: "skipped",
        summary: "已有自主任务正在运行，本次跳过。",
        task,
        run: null,
        artifact: null,
      };
    }

    const run = await prisma.autonomousTaskRun.create({
      data: {
        taskId: task.id,
        trigger: input.trigger,
        status: "running",
      },
    });

    try {
      const artifacts = await recentTaskArtifacts(task.id);
      const output = await generateTaskStep({
        task,
        artifacts,
        trigger: input.trigger,
        signal: input.signal,
      });
      const artifactContent = cleanText(output.artifact?.content, 20000);
      const artifact = artifactContent
        ? await prisma.autonomousArtifact.create({
            data: {
              taskId: task.id,
              runId: run.id,
              kind: artifactKind(output.artifact?.kind),
              title: cleanText(output.artifact?.title, 160) ?? `${task.title} - 本轮产物`,
              content: artifactContent,
              metadata: jsonValue({
                notes: Array.isArray(output.notes)
                  ? output.notes.filter((item): item is string => typeof item === "string")
                  : [],
              }),
            },
          })
        : null;

      const status = normalizeStatus(output.status) ?? "active";
      const completed = status === "completed";
      const summary = cleanText(output.summary, 240) ?? "自主任务推进了一小步。";
      const updatedTask = await prisma.autonomousTask.update({
        where: { id: task.id },
        data: {
          status: completed ? "completed" : "active",
          currentStep: cleanNullableText(output.currentStep, 240) ?? task.currentStep,
          nextStep: completed ? null : cleanNullableText(output.nextStep, 240) ?? task.nextStep,
          lastRunAt: new Date(),
          completedAt: completed ? new Date() : null,
          metadata: jsonValue({
            lastRunId: run.id,
            lastSummary: summary,
            lastArtifactId: artifact?.id ?? null,
          }),
        },
      });

      const completedRun = await prisma.autonomousTaskRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          summary,
          plan: jsonValue(output.plan ?? {}),
          result: jsonValue(output),
          finishedAt: new Date(),
        },
      });

      return {
        status: "completed",
        summary,
        task: updatedTask,
        run: completedRun,
        artifact,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedRun = await prisma.autonomousTaskRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          summary: "自主任务执行失败。",
          error: message.slice(0, 1000),
          finishedAt: new Date(),
        },
      });
      return {
        status: "failed",
        summary: `自主任务执行失败：${message.slice(0, 160)}`,
        task,
        run: failedRun,
        artifact: null,
      };
    }
  },

  async formatForPrompt(): Promise<string> {
    const activeTasks = await prisma.autonomousTask.findMany({
      where: { status: "active" },
      orderBy: [
        { priority: "desc" },
        { lastRunAt: { sort: "asc", nulls: "first" } },
      ],
      take: 3,
      include: {
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (activeTasks.length === 0) {
      return [
        "## 自主活动",
        "- 当前没有 active 自主任务；如果用户问起最近在做什么，不要编造具体任务。",
      ].join("\n");
    }

    return [
      "## 自主活动",
      ...activeTasks.flatMap((task) => {
        const latestArtifact = task.artifacts[0];
        return [
          `- ${task.title}（${task.type}，优先级 ${task.priority}）`,
          task.currentStep ? `  当前进度：${task.currentStep}` : "",
          task.nextStep ? `  下一步：${task.nextStep}` : "",
          latestArtifact ? `  最近产物：${latestArtifact.title}` : "",
        ].filter(Boolean);
      }),
    ].join("\n");
  },
};
