import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

const seed = {
  userId: "admin-demo-user",
  personId: "admin-demo-person",
  conversationId: "admin-demo-conversation",
  dreamJobId: "admin-demo-dream-job",
  dailyNoteId: "admin-demo-daily-note",
  dreamSignalIds: [
    "admin-demo-dream-signal-1",
    "admin-demo-dream-signal-2",
    "admin-demo-dream-signal-3",
  ],
  diaryEntryId: "admin-demo-diary-entry",
  consolidationReportId: "admin-demo-dream-report",
  dreamRiskFlagId: "admin-demo-dream-risk",
  dreamGrowthLogId: "admin-demo-dream-growth-log",
  targetMemoryId: "admin-demo-target-memory",
  globalMemoryId: "admin-demo-global-memory",
  messageIds: [
    "admin-demo-message-1",
    "admin-demo-message-2",
    "admin-demo-message-3",
  ],
} as const;

async function cleanupPreviousSeed(): Promise<void> {
  await prisma.dreamConsolidationReport.deleteMany({
    where: { id: seed.consolidationReportId },
  });

  await prisma.dreamDiaryEntry.deleteMany({
    where: { id: seed.diaryEntryId },
  });

  await prisma.dreamSignal.deleteMany({
    where: { id: { in: [...seed.dreamSignalIds] } },
  });

  await prisma.dailyNote.deleteMany({
    where: { id: seed.dailyNoteId },
  });

  await prisma.dreamJob.deleteMany({
    where: { id: seed.dreamJobId },
  });

  await prisma.memory.deleteMany({
    where: {
      OR: [
        { id: seed.targetMemoryId },
        { id: seed.globalMemoryId },
        { content: { startsWith: "Seed demo:" } },
      ],
    },
  });
}

async function main(): Promise<void> {
  await cleanupPreviousSeed();

  const user = await prisma.user.upsert({
    where: { externalId: seed.userId },
    update: {
      displayName: "Admin Demo User",
    },
    create: {
      id: seed.userId,
      externalId: seed.userId,
      displayName: "Admin Demo User",
    },
  });

  const person = await prisma.personIdentity.upsert({
    where: { id: seed.personId },
    update: {
      label: "Admin Demo User",
      note: "Seed demo identity",
    },
    create: {
      id: seed.personId,
      label: "Admin Demo User",
      note: "Seed demo identity",
    },
  });

  await prisma.identityLink.upsert({
    where: { userId: user.id },
    update: {
      personId: person.id,
      source: "admin_demo_seed",
      verifiedBy: "seed",
    },
    create: {
      personId: person.id,
      userId: user.id,
      source: "admin_demo_seed",
      verifiedBy: "seed",
    },
  });

  const conversation = await prisma.conversation.upsert({
    where: { id: seed.conversationId },
    update: {
      userId: user.id,
      channel: "web",
      externalConversationId: seed.conversationId,
      metadata: { seed: "admin_demo" },
    },
    create: {
      id: seed.conversationId,
      userId: user.id,
      channel: "web",
      externalConversationId: seed.conversationId,
      metadata: { seed: "admin_demo" },
    },
  });

  const messages = [
    {
      id: seed.messageIds[0],
      role: "user",
      content: "我希望后台界面明快一点，低饱和、不要太刺眼。",
      externalMessageId: "admin-demo-external-message-1",
    },
    {
      id: seed.messageIds[1],
      role: "assistant",
      content: "收到，我会把控制台设计得更清爽，并且避免临时感强的实现。",
      externalMessageId: "admin-demo-external-message-2",
    },
    {
      id: seed.messageIds[2],
      role: "user",
      content: "后续 Admin 平台先把记忆库管理做好，单条操作就好。",
      externalMessageId: "admin-demo-external-message-3",
    },
  ];

  for (const message of messages) {
    await prisma.message.upsert({
      where: { id: message.id },
      update: {
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        externalMessageId: message.externalMessageId,
        metadata: { seed: "admin_demo" },
      },
      create: {
        id: message.id,
        conversationId: conversation.id,
        role: message.role,
        content: message.content,
        externalMessageId: message.externalMessageId,
        metadata: { seed: "admin_demo" },
      },
    });
  }

  await prisma.memory.create({
    data: {
      id: seed.targetMemoryId,
      personId: person.id,
      type: "user_preference",
      scope: "person",
      tier: "short",
      content: "Seed demo: 用户偏好浅色、低饱和、真实业务链路清楚的 Admin 控制台。",
      summary: "Dream 已整理出的 Admin 视觉与产品偏好。",
      status: "active",
      sourceMessageIds: [seed.messageIds[0]],
      mentionDayKeys: [new Date().toISOString().slice(0, 10)],
      lastMentionedAt: new Date(),
    },
  });

  await prisma.memory.create({
    data: {
      id: seed.globalMemoryId,
      personId: null,
      type: "project_context",
      scope: "global",
      tier: "long",
      content: "Seed demo: 陆思源后台管理应保持浅色、清爽、低饱和，并优先呈现真实业务链路。",
      summary: "全局基础记忆示例：Admin 设计取向与开发原则。",
      status: "active",
      sourceMessageIds: [seed.messageIds[0], seed.messageIds[1]],
      mentionDayKeys: [new Date().toISOString().slice(0, 10)],
      lastMentionedAt: new Date(),
    },
  });

  const dreamJob = await prisma.dreamJob.create({
    data: {
      id: seed.dreamJobId,
      status: "completed",
      triggerType: "manual",
      scope: "daily",
      userId: user.id,
      conversationId: conversation.id,
      channel: "web",
      fromTime: new Date(Date.now() - 24 * 3600_000),
      toTime: new Date(),
      phase: "completed",
      startedAt: new Date(Date.now() - 8 * 60_000),
      completedAt: new Date(Date.now() - 6 * 60_000),
      metadata: { seed: "admin_demo" },
    },
  });

  await prisma.dailyNote.create({
    data: {
      id: seed.dailyNoteId,
      jobId: dreamJob.id,
      date: new Date(),
      scope: "daily",
      userId: user.id,
      channel: "web",
      title: "Seed demo: Admin 平台阶段整理",
      summary:
        "用户正在把 Web Chat 扩展成 Admin 平台，当前重点是用真实后台链路管理记忆和 Dream 产物。",
      keyPoints: [
        "Admin 壳已经从占位页进入真实业务页面",
        "记忆库已接入真实数据",
        "下一步需要让运行态可观察、可手动触发",
      ],
      sourceStats: { messages: 3, memories: 2 },
      riskSummary: { medium: 1, high: 0 },
      status: "active",
    },
  });

  await prisma.dreamSignal.createMany({
    data: [
      {
        id: seed.dreamSignalIds[0],
        jobId: dreamJob.id,
        signalType: "project_context",
        content:
          "Seed demo: Admin 平台正在从聊天入口升级为包含记忆、运行、草稿、日志和配置的控制台。",
        summary: "Admin 平台阶段目标：从单一聊天扩展为业务管理台。",
        confidence: 0.91,
        strength: 0.82,
        riskLevel: "low",
        sourceTypes: ["message", "memory"],
        sourceIds: [seed.messageIds[2], seed.globalMemoryId],
        evidenceCount: 2,
        tags: ["admin", "project"],
        entities: ["Admin 平台", "Dream Cycle"],
        status: "active",
      },
      {
        id: seed.dreamSignalIds[1],
        jobId: dreamJob.id,
        signalType: "user_preference",
        content:
          "Seed demo: 用户偏好浅色、低饱和、明快且经过设计的控制台界面。",
        summary: "视觉偏好：浅色、低饱和、不要临时感。",
        confidence: 0.94,
        strength: 0.88,
        riskLevel: "low",
        sourceTypes: ["message"],
        sourceIds: [seed.messageIds[0]],
        evidenceCount: 1,
        tags: ["ui", "preference"],
        entities: ["控制台"],
        status: "active",
      },
      {
        id: seed.dreamSignalIds[2],
        jobId: dreamJob.id,
        signalType: "memory_conflict",
        content:
          "Seed demo: 旧的深色高对比偏好记忆与最新浅色低饱和偏好冲突。",
        summary: "旧 UI 偏好需要被更新或替换。",
        confidence: 0.87,
        strength: 0.74,
        riskLevel: "medium",
        sourceTypes: ["memory", "message"],
        sourceIds: [seed.targetMemoryId, seed.messageIds[0]],
        evidenceCount: 2,
        tags: ["memory", "conflict"],
        entities: ["Memory"],
        status: "active",
      },
    ],
  });

  await prisma.dreamDiaryEntry.create({
    data: {
      id: seed.diaryEntryId,
      jobId: dreamJob.id,
      date: new Date(),
      title: "Seed demo: 把后台做成可以信任的工作台",
      content:
        "今天的线索很清楚：用户不想要临时堆出来的后台，而是希望每一步都能看见真实数据、真实状态和真实动作。先把运行台做稳，后面的草稿、日志、配置才有地方自然生长。",
      style: "lusiyuan_inner_diary",
      grounded: true,
      sourceSignalIds: [...seed.dreamSignalIds],
      sourceMessageIds: [...seed.messageIds],
      visibility: "owner_only",
      status: "active",
    },
  });

  const consolidationReport = await prisma.dreamConsolidationReport.create({
    data: {
      id: seed.consolidationReportId,
      jobId: dreamJob.id,
      summary:
        "Seed demo: Dream Cycle 识别到 Admin 平台的阶段目标、视觉偏好和一处记忆冲突。",
      phase: "deep_sleep",
      candidateCount: 3,
      promotedCount: 2,
      rejectedCount: 1,
      riskCount: 1,
      rawOutput: { seed: "admin_demo", source: "dream_deep_sleep" },
      metadata: {
        seed: "admin_demo",
        dreamJobId: dreamJob.id,
        sourceSignalIds: [...seed.dreamSignalIds],
        generatedMemoryIds: [seed.targetMemoryId, seed.globalMemoryId],
      },
    },
  });

  await prisma.memoryRiskFlag.create({
    data: {
      id: seed.dreamRiskFlagId,
      reportId: consolidationReport.id,
      type: "memory_conflict",
      severity: "medium",
      description:
        "Seed demo: Dream Deep Sleep 发现旧 UI 偏好记忆与最新偏好冲突。",
      suggestedAction: "优先更新已有 user_preference，避免新增重复记忆。",
      relatedMessageIds: [seed.messageIds[0], seed.messageIds[1]],
      status: "open",
    },
  });

  await prisma.growthLogProposal.create({
    data: {
      id: seed.dreamGrowthLogId,
      reportId: consolidationReport.id,
      title: "Seed demo: Dream 识别到控制台建设节奏",
      content:
        "Dream Deep Sleep 将多个信号整合为一个阶段判断：先让 Admin 真实可用，再扩展高级管理能力。",
      tags: ["dream", "admin", "growth"],
      confidence: 0.84,
      status: "pending",
      sourceMessageIds: [seed.messageIds[2]],
    },
  });

  console.log("Seeded Admin demo data:");
  console.log(`- user: ${user.externalId}`);
  console.log(`- conversation: ${conversation.externalConversationId}`);
  console.log(`- dream job: ${dreamJob.id}`);
  console.log(`- dream signals: ${seed.dreamSignalIds.length}`);
  console.log("- dream memories: 2");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
