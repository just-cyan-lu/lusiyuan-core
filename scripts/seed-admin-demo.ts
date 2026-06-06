import "dotenv/config";
import { prisma } from "../src/db/prisma.js";

const seed = {
  userId: "admin-demo-user",
  conversationId: "admin-demo-conversation",
  jobId: "admin-demo-reflection-job",
  reportId: "admin-demo-reflection-report",
  targetMemoryId: "admin-demo-target-memory",
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
    where: { id: { in: [...seed.proposalIds] } },
  });

  await prisma.reflectionReport.deleteMany({
    where: { id: seed.reportId },
  });

  await prisma.reflectionJob.deleteMany({
    where: { id: seed.jobId },
  });

  await prisma.memory.deleteMany({
    where: {
      OR: [
        { id: seed.targetMemoryId },
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
      type: "preference",
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
        type: "preference",
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
        type: "workflow",
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
        type: "preference",
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
        type: "note",
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

  console.log("Seeded Admin demo data:");
  console.log(`- user: ${user.externalId}`);
  console.log(`- conversation: ${conversation.externalConversationId}`);
  console.log(`- report: ${report.id}`);
  console.log(`- proposals: ${seed.proposalIds.length}`);
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
