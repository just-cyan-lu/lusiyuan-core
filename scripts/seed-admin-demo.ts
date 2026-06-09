import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

const seed = {
  userId: "admin-demo-user",
  conversationId: "admin-demo-conversation",
  jobId: "admin-demo-reflection-job",
  reportId: "admin-demo-reflection-report",
  riskFlagId: "admin-demo-reflection-risk",
  growthLogId: "admin-demo-growth-log",
  dreamJobId: "admin-demo-dream-job",
  dailyNoteId: "admin-demo-daily-note",
  dreamSignalIds: [
    "admin-demo-dream-signal-1",
    "admin-demo-dream-signal-2",
    "admin-demo-dream-signal-3",
  ],
  diaryEntryId: "admin-demo-diary-entry",
  consolidationReportId: "admin-demo-dream-report",
  dreamReflectionJobId: "admin-demo-dream-reflection-job",
  dreamReflectionReportId: "admin-demo-dream-reflection-report",
  dreamRiskFlagId: "admin-demo-dream-risk",
  dreamGrowthLogId: "admin-demo-dream-growth-log",
  dreamProposalIds: [
    "admin-demo-dream-proposal-create",
    "admin-demo-dream-proposal-update",
  ],
  targetMemoryId: "admin-demo-target-memory",
  globalMemoryId: "admin-demo-global-memory",
  messageIds: [
    "admin-demo-message-1",
    "admin-demo-message-2",
    "admin-demo-message-3",
  ],
  proposalIds: [
    "admin-demo-proposal-create-pending",
    "admin-demo-proposal-create-approved",
    "admin-demo-proposal-update-pending",
    "admin-demo-proposal-rejected",
  ],
} as const;

async function cleanupPreviousSeed(): Promise<void> {
  await prisma.memoryProposal.deleteMany({
    where: { id: { in: [...seed.proposalIds, ...seed.dreamProposalIds] } },
  });

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

  await prisma.reflectionReport.deleteMany({
    where: { id: { in: [seed.reportId, seed.dreamReflectionReportId] } },
  });

  await prisma.reflectionJob.deleteMany({
    where: { id: { in: [seed.jobId, seed.dreamReflectionJobId] } },
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
      content: "后续 Admin 平台先接记忆提案审核，单条操作就好。",
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

  const targetMemory = await prisma.memory.create({
    data: {
      id: seed.targetMemoryId,
      userId: user.id,
      type: "user_preference",
      scope: "user",
      content: "Seed demo: 用户偏好深色高对比控制台。",
      summary: "旧的界面偏好，需要被新提案更新。",
      importance: 5,
      confidence: 0.72,
      status: "active",
      source: "admin_demo_seed",
      channel: "web",
      conversationId: conversation.id,
      tags: ["admin", "ui"],
      metadata: { seed: "admin_demo" },
    },
  });

  await prisma.memory.create({
    data: {
      id: seed.globalMemoryId,
      userId: null,
      type: "core",
      scope: "global",
      content: "Seed demo: 陆思源后台管理应保持浅色、清爽、低饱和，并优先呈现真实业务链路。",
      summary: "全局基础记忆示例：Admin 设计取向与开发原则。",
      importance: 7,
      confidence: 0.86,
      status: "active",
      source: "admin_demo_seed",
      channel: "web",
      tags: ["admin", "global", "design"],
      entities: ["陆思源", "Admin 平台"],
      metadata: { seed: "admin_demo", global: true },
    },
  });

  const job = await prisma.reflectionJob.create({
    data: {
      id: seed.jobId,
      status: "completed",
      triggerType: "manual",
      scope: "conversation",
      userId: user.id,
      conversationId: conversation.id,
      channel: "web",
      messageLimit: 40,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  const report = await prisma.reflectionReport.create({
    data: {
      id: seed.reportId,
      jobId: job.id,
      summary:
        "Seed demo: 用户正在建设 Admin 平台，当前最需要稳定、清爽的记忆提案审核工作流。",
      confidence: 0.93,
      rawOutput: { seed: "admin_demo" },
      metadata: { seed: "admin_demo" },
    },
  });

  await prisma.reflectionRiskFlag.create({
    data: {
      id: seed.riskFlagId,
      reportId: report.id,
      type: "memory_conflict",
      severity: "medium",
      description:
        "Seed demo: 旧记忆记录了偏深色高对比界面，和用户最新偏好存在冲突。",
      suggestedAction: "审核 update_memory 提案后，替换旧的界面偏好记忆。",
      relatedMessageIds: [seed.messageIds[0], seed.messageIds[1]],
      status: "open",
    },
  });

  await prisma.growthLogProposal.create({
    data: {
      id: seed.growthLogId,
      reportId: report.id,
      title: "Seed demo: Admin 平台推进节奏",
      content:
        "用户倾向先把真实业务链路接稳，再逐步扩展复杂管理能力。",
      tags: ["admin", "workflow"],
      confidence: 0.86,
      status: "pending",
      sourceMessageIds: [seed.messageIds[2]],
    },
  });

  await prisma.memoryProposal.createMany({
    data: [
      {
        id: seed.proposalIds[0],
        reportId: report.id,
        userId: user.id,
        conversationId: conversation.id,
        channel: "web",
        proposalType: "create_memory",
        scope: "user",
        type: "user_preference",
        content: "Seed demo: 用户偏好浅色、低饱和、明快的控制台界面。",
        summary: "Admin 平台视觉偏好：浅色、低饱和、明快。",
        tags: ["admin", "ui", "preference"],
        entities: ["Admin 平台"],
        reason: "用户明确提出控制台希望看起来明快，不要高饱和。",
        confidence: 0.94,
        riskLevel: "low",
        status: "pending",
        sourceMessageIds: [seed.messageIds[0]],
        metadata: { seed: "admin_demo" },
      },
      {
        id: seed.proposalIds[1],
        reportId: report.id,
        userId: user.id,
        conversationId: conversation.id,
        channel: "web",
        proposalType: "create_memory",
        scope: "user",
        type: "project_context",
        content: "Seed demo: Admin 功能开发应先接真实链路，再逐步扩展批量操作。",
        summary: "Admin 开发节奏：真实链路优先，批量能力后置。",
        tags: ["admin", "workflow"],
        entities: ["MemoryProposal"],
        reason: "用户认可先做记忆提案审核，并强调不要用临时感强的实现。",
        confidence: 0.88,
        riskLevel: "low",
        status: "approved",
        reviewedBy: "admin_demo_seed",
        reviewedAt: new Date(),
        sourceMessageIds: [seed.messageIds[2]],
        metadata: { seed: "admin_demo" },
      },
      {
        id: seed.proposalIds[2],
        reportId: report.id,
        userId: user.id,
        conversationId: conversation.id,
        channel: "web",
        proposalType: "update_memory",
        targetMemoryId: targetMemory.id,
        scope: "user",
        type: "user_preference",
        content: "Seed demo: 用户偏好浅色、低饱和、层次清楚的控制台界面。",
        summary: "更新旧界面偏好为浅色低饱和。",
        tags: ["admin", "ui"],
        entities: ["Admin 平台"],
        reason: "用户从蓝+血橙调整为浅色明快风格，旧偏好需要更新。",
        confidence: 0.91,
        riskLevel: "medium",
        status: "pending",
        sourceMessageIds: [seed.messageIds[0], seed.messageIds[1]],
        metadata: { seed: "admin_demo" },
      },
      {
        id: seed.proposalIds[3],
        reportId: report.id,
        userId: user.id,
        conversationId: conversation.id,
        channel: "web",
        proposalType: "create_memory",
        scope: "user",
        type: "other",
        content: "Seed demo: 这是一条已拒绝的示例提案。",
        summary: "已拒绝示例。",
        reason: "用于验证 rejected 筛选和只读状态展示。",
        confidence: 0.62,
        riskLevel: "low",
        status: "rejected",
        reviewedBy: "admin_demo_seed",
        reviewedAt: new Date(),
        metadata: {
          seed: "admin_demo",
          rejectReason: "示例提案，不需要写入。",
        },
      },
    ],
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
      title: "Seed demo: Admin 平台阶段复盘",
      summary:
        "用户正在把 Web Chat 扩展成 Admin 平台，当前重点是用真实后台链路管理记忆、复盘和 Dream 产物。",
      keyPoints: [
        "Admin 壳已经从占位页进入真实业务页面",
        "记忆库和提案审核已接入真实数据",
        "下一步需要让运行态可观察、可手动触发",
      ],
      sourceStats: { messages: 3, memories: 2, proposals: 4 },
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

  const dreamReflectionJob = await prisma.reflectionJob.create({
    data: {
      id: seed.dreamReflectionJobId,
      status: "completed",
      triggerType: "dream",
      scope: "daily",
      userId: user.id,
      conversationId: conversation.id,
      channel: "web",
      startedAt: new Date(Date.now() - 5 * 60_000),
      completedAt: new Date(Date.now() - 4 * 60_000),
    },
  });

  const dreamReflectionReport = await prisma.reflectionReport.create({
    data: {
      id: seed.dreamReflectionReportId,
      jobId: dreamReflectionJob.id,
      summary: `Seed demo: Dream Cycle ${dreamJob.id} — Deep Sleep`,
      confidence: 0.88,
      rawOutput: { seed: "admin_demo", source: "dream_deep_sleep" },
      metadata: {
        seed: "admin_demo",
        dreamJobId: dreamJob.id,
        phase: "deep_sleep",
      },
    },
  });

  await prisma.memoryProposal.createMany({
    data: [
      {
        id: seed.dreamProposalIds[0],
        reportId: dreamReflectionReport.id,
        userId: user.id,
        conversationId: conversation.id,
        channel: "web",
        proposalType: "create_memory",
        scope: "user",
        type: "project_context",
        content:
          "Seed demo: Dream 识别到 Admin 平台正在从单一聊天入口扩展成完整管理台。",
        summary: "Dream 提案：Admin 平台阶段目标变化。",
        tags: ["dream", "admin", "project"],
        entities: ["Admin 平台", "Dream Cycle"],
        reason: "多个 Dream Signal 指向同一个项目阶段变化，值得进入审核队列。",
        confidence: 0.9,
        riskLevel: "low",
        status: "pending",
        sourceMessageIds: [seed.messageIds[2]],
        metadata: { seed: "admin_demo", source: "dream_deep_sleep" },
      },
      {
        id: seed.dreamProposalIds[1],
        reportId: dreamReflectionReport.id,
        userId: user.id,
        conversationId: conversation.id,
        channel: "web",
        proposalType: "update_memory",
        targetMemoryId: targetMemory.id,
        scope: "user",
        type: "user_preference",
        content:
          "Seed demo: 用户偏好浅色、低饱和、真实业务链路清楚的 Admin 控制台。",
        summary: "Dream 提案：更新 Admin 视觉与产品偏好。",
        tags: ["dream", "ui", "preference"],
        entities: ["Admin 平台"],
        reason: "Dream 发现旧记忆与新偏好冲突，需要更新而不是新增重复记忆。",
        confidence: 0.88,
        riskLevel: "medium",
        status: "pending",
        sourceMessageIds: [seed.messageIds[0], seed.messageIds[1]],
        metadata: { seed: "admin_demo", source: "dream_deep_sleep" },
      },
    ],
  });

  await prisma.reflectionRiskFlag.create({
    data: {
      id: seed.dreamRiskFlagId,
      reportId: dreamReflectionReport.id,
      type: "memory_conflict",
      severity: "medium",
      description:
        "Seed demo: Dream Deep Sleep 发现旧 UI 偏好记忆与最新偏好冲突。",
      suggestedAction: "优先审核 update_memory 提案，避免新增重复 user_preference。",
      relatedMessageIds: [seed.messageIds[0], seed.messageIds[1]],
      status: "open",
    },
  });

  await prisma.growthLogProposal.create({
    data: {
      id: seed.dreamGrowthLogId,
      reportId: dreamReflectionReport.id,
      title: "Seed demo: Dream 识别到控制台建设节奏",
      content:
        "Dream Deep Sleep 将多个信号整合为一个阶段判断：先让 Admin 真实可用，再扩展高级管理能力。",
      tags: ["dream", "admin", "growth"],
      confidence: 0.84,
      status: "pending",
      sourceMessageIds: [seed.messageIds[2]],
    },
  });

  await prisma.dreamConsolidationReport.create({
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
      generatedProposalIds: [...seed.dreamProposalIds],
      rawOutput: { seed: "admin_demo" },
      metadata: {
        seed: "admin_demo",
        dreamReflectionReportId: dreamReflectionReport.id,
      },
    },
  });

  console.log("Seeded Admin demo data:");
  console.log(`- user: ${user.externalId}`);
  console.log(`- conversation: ${conversation.externalConversationId}`);
  console.log(`- report: ${report.id}`);
  console.log(`- proposals: ${seed.proposalIds.length}`);
  console.log(`- dream job: ${dreamJob.id}`);
  console.log(`- dream signals: ${seed.dreamSignalIds.length}`);
  console.log(`- dream proposals: ${seed.dreamProposalIds.length}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
