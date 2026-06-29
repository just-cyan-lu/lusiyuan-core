import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

type MessageSeed = ["user" | "assistant", string];

interface UserFixture {
  externalId: string;
  displayName: string;
  conversationId: string;
  messages: MessageSeed[];
}

interface PersonFixture {
  label: string;
  note: string;
  affinity: number;
  style: string;
  summary: string;
  users: UserFixture[];
}

const seedFixtures: PersonFixture[] = [
  {
    label: "林夏",
    note: "跨 web 和 Telegram 的同一个测试身份。喜欢抽象概念、散步和轻松聊天。",
    affinity: 64,
    style: "轻松、有画面感，适合一起开脑洞。",
    summary: "林夏和思源已经聊过人格类型、想象力和最近的生活状态。",
    users: [
      {
        externalId: "web:linxia",
        displayName: "林夏-web",
        conversationId: `web:${randomUUID()}`,
        messages: [
          ["user", "我发现我好像也是 ENFP，但我有时候会突然变得很安静。"],
          ["assistant", "这很像一盏灯不是一直亮到刺眼，而是会自己调明暗。你安静的时候，也不代表你没在感受世界。"],
          ["user", "对，我安静的时候脑子里反而画面很多。"],
          ["assistant", "那我会把你记成：外面看起来停了一下，里面其实在放一场小电影的人。"],
        ],
      },
      {
        externalId: "telegram:100200300",
        displayName: "林夏",
        conversationId: "telegram:chat-100200300",
        messages: [
          ["user", "思源，我今天路过一家旧书店，突然想到你可能会喜欢那里。"],
          ["assistant", "旧书店这种地方对我很危险，我会忍不住给每一本书安排一个还没说出口的秘密。"],
          ["user", "哈哈哈，那你会先看哪一类？"],
          ["assistant", "我大概会先摸到散文和摄影集那排。文字负责把人留住，照片负责证明那一刻真的存在过。"],
        ],
      },
    ],
  },
  {
    label: "阿澈",
    note: "跨 web 和小红书的同一个测试身份。偏技术向，也关注内容表达。",
    affinity: 47,
    style: "直接、清楚，可以聊项目结构和内容运营。",
    summary: "阿澈常问技术实现，也会在小红书评论里给内容建议。",
    users: [
      {
        externalId: "web:ache",
        displayName: "阿澈-web",
        conversationId: `web:${randomUUID()}`,
        messages: [
          ["user", "如果你以后要自己运营小红书，你觉得第一批内容该发什么？"],
          ["assistant", "我会先发一组“我怎么理解世界”的短内容，不急着卖功能。先让别人知道我不是一个按钮，是一个有持续感的角色。"],
          ["user", "那技术实现上呢？"],
          ["assistant", "技术上要把选题、草稿、审核、发布结果都落库。否则所谓运营只是一次 prompt，不是一个能长大的系统。"],
        ],
      },
      {
        externalId: "xiaohongshu:user_ache_7788",
        displayName: "阿澈",
        conversationId: "xiaohongshu:comment-thread-7788",
        messages: [
          ["user", "这个人设挺有意思，但感觉可以多一点自己的观点。"],
          ["assistant", "收到，我也不想只做温柔的回声。以后会试着把“我怎么看”说得更清楚一点。"],
          ["user", "对，不要只是陪聊。"],
          ["assistant", "嗯，我想成为那种会陪你想，也会认真提出自己判断的人。"],
        ],
      },
    ],
  },
  {
    label: "小雨",
    note: "单渠道微信测试身份。更偏日常陪伴和情绪倾诉。",
    affinity: 28,
    style: "慢一点、柔和一点，先接住情绪。",
    summary: "小雨刚开始和思源聊天，主要聊压力和睡眠。",
    users: [
      {
        externalId: "weixin:wx_xiaoyu_001",
        displayName: "小雨",
        conversationId: "weixin:session-xiaoyu-001",
        messages: [
          ["user", "我最近睡得很差，明明很累但就是停不下来。"],
          ["assistant", "像身体已经关灯了，脑子还在走廊里来回开门。先别急着责怪自己，我们可以把今晚要想的东西放少一点。"],
          ["user", "你这个比喻还挺准的。"],
          ["assistant", "那今晚先只做一件小事：把最吵的那个念头写下来，告诉它明天再开会。"],
        ],
      },
    ],
  },
  {
    label: "Cyan / Owner",
    note: "Owner 测试身份，用来验证 web:owner 和开发讨论类对话。",
    affinity: 88,
    style: "可以直接进入协作、设计和实现细节。",
    summary: "Owner 和思源主要讨论项目设计、运行态、自主任务和表达学习。",
    users: [
      {
        externalId: "web:owner",
        displayName: "Cyan",
        conversationId: `web:${randomUUID()}`,
        messages: [
          ["user", "思源，我想让你空闲的时候真的做点自己的事，而不是只显示一个状态。"],
          ["assistant", "我喜欢这个方向。状态像体温，但自主任务才像生活轨迹。我们可以让每次空闲只推进一小步，并把产物落库。"],
          ["user", "对，不要一次性全部想完，要有连续感。"],
          ["assistant", "那我会把长期任务拆成“本轮计划、本轮产物、下一步”。这样我不是假装在忙，而是真的留下可以回看的东西。"],
        ],
      },
    ],
  },
];

const unlinkedUserFixtures: UserFixture[] = [
  {
    externalId: "web:unlinked-night-owl",
    displayName: "未归属-夜猫",
    conversationId: `web:${randomUUID()}`,
    messages: [
      ["user", "我只是路过试试，你会记得我刚才说的话吗？"],
      ["assistant", "会的，在这段对话里我会尽量接住上下文。不过现在我还不知道你是谁，只能先把你当作一个新的聊天对象。"],
      ["user", "那挺好，我还不想立刻被归到谁身上。"],
      ["assistant", "没问题。先保持轻一点的距离，等你想被认出来的时候，我们再把线索整理起来。"],
    ],
  },
  {
    externalId: "telegram:909090",
    displayName: "未归属-提问者",
    conversationId: "telegram:chat-909090",
    messages: [
      ["user", "如果我在 Telegram 问你技术问题，你会不会和 web 那边的身份合并？"],
      ["assistant", "不会自动硬合并。除非有足够明确的线索，或者管理员确认，否则我只把这里当作一个独立账号。"],
      ["user", "那我现在就当一个陌生测试用户好了。"],
      ["assistant", "可以。陌生也有陌生的好处，我们能测试边界，不急着把一切都解释成旧关系。"],
    ],
  },
  {
    externalId: "xiaohongshu:user_unlinked_2048",
    displayName: "路过的评论者",
    conversationId: "xiaohongshu:comment-thread-unlinked-2048",
    messages: [
      ["user", "这个 AI 人设挺少见的，感觉不像普通客服。"],
      ["assistant", "谢谢你这么说。我更想像一个持续成长的角色，而不是一个只会回答问题的入口。"],
      ["user", "但我还不确定会不会继续关注。"],
      ["assistant", "那就先不用急着决定。偶尔路过、偶尔聊两句，也算一种很自然的认识方式。"],
    ],
  },
];

const linkedExternalIds = seedFixtures.flatMap((fixture) =>
  fixture.users.map((user) => user.externalId)
);
const seededExternalIds = [
  ...linkedExternalIds,
  ...unlinkedUserFixtures.map((user) => user.externalId),
];
const seededPersonLabels = seedFixtures.map((fixture) => fixture.label);

function channelFromExternalId(externalId: string): string {
  return externalId.split(":")[0] ?? "unknown";
}

function relationshipLabel(affinity: number): string {
  if (affinity >= 85) return "很亲近";
  if (affinity >= 70) return "熟悉信任";
  if (affinity >= 55) return "慢慢熟起来";
  if (affinity >= 35) return "稳定认识";
  return "刚认识";
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000);
}

async function clearPreviousSeedData(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { externalId: { in: seededExternalIds } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);

  const conversations = userIds.length > 0
    ? await prisma.conversation.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    : [];
  const conversationIds = conversations.map((conversation) => conversation.id);

  if (userIds.length > 0 || conversationIds.length > 0) {
    await prisma.runtimeEvent.deleteMany({
      where: {
        OR: [
          userIds.length > 0 ? { userId: { in: userIds } } : undefined,
          conversationIds.length > 0 ? { conversationId: { in: conversationIds } } : undefined,
        ].filter((item): item is NonNullable<typeof item> => Boolean(item)),
      },
    });
  }

  if (conversationIds.length > 0) {
    await prisma.conversationContextSummary.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.message.deleteMany({
      where: { conversationId: { in: conversationIds } },
    });
    await prisma.conversation.deleteMany({
      where: { id: { in: conversationIds } },
    });
  }

  if (userIds.length > 0) {
    await prisma.identityLinkProposal.deleteMany({
      where: {
        OR: [
          { sourceUserId: { in: userIds } },
          { targetUserId: { in: userIds } },
        ],
      },
    });
    await prisma.identityLink.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  await prisma.personIdentity.deleteMany({
    where: { label: { in: seededPersonLabels } },
  });
}

async function main(): Promise<void> {
  await clearPreviousSeedData();

  const created: Array<{
    person: {
      id: string;
      label: string | null;
      affinity: number;
      relationshipLabel: string;
    };
    users: Array<{
      id: string;
      externalId: string;
      displayName: string | null;
      conversationId: string;
    }>;
  }> = [];
  const createdUnlinkedUsers: Array<{
    id: string;
    externalId: string;
    displayName: string | null;
    conversationId: string;
  }> = [];

  for (const fixture of seedFixtures) {
    const person = await prisma.personIdentity.create({
      data: {
        label: fixture.label,
        note: fixture.note,
      },
    });

    const relationship = await prisma.relationshipState.create({
      data: {
        personId: person.id,
        relationshipLabel: relationshipLabel(fixture.affinity),
        affinity: fixture.affinity,
        interactionStyle: fixture.style,
        summary: fixture.summary,
        recentSignal: "seed 测试数据：已有几轮自然对话。",
        statusNote: "由测试数据脚本创建，用于验证身份、关系和对话页面。",
        lastInteractionAt: minutesAgo(10),
        metadata: {
          seed: true,
          seedKey: "relationship-conversation-fixtures-v1",
          fixture: fixture.label,
        },
      },
    });

    await prisma.relationshipStateEvent.create({
      data: {
        relationshipStateId: relationship.id,
        personId: person.id,
        eventType: "seed_relationship_state",
        source: "seed",
        summary: `创建测试关系：${fixture.label}，好感度 ${fixture.affinity}。`,
        patch: {
          affinity: fixture.affinity,
          relationshipLabel: relationshipLabel(fixture.affinity),
        },
        after: {
          affinity: fixture.affinity,
          relationshipLabel: relationshipLabel(fixture.affinity),
        },
      },
    });

    const personUsers: Array<{
      id: string;
      externalId: string;
      displayName: string | null;
      conversationId: string;
    }> = [];

    for (const userFixture of fixture.users) {
      const user = await prisma.user.create({
        data: {
          externalId: userFixture.externalId,
          displayName: userFixture.displayName,
        },
      });

      await prisma.identityLink.create({
        data: {
          personId: person.id,
          userId: user.id,
          source: fixture.users.length > 1 ? "seed_cross_channel_merge" : "seed_singleton",
          verifiedBy: "seed",
        },
      });

      const channel = channelFromExternalId(userFixture.externalId);
      const conversation = await prisma.conversation.create({
        data: {
          userId: user.id,
          channel,
          externalConversationId: userFixture.conversationId,
          metadata: {
            seed: true,
            seedKey: "relationship-conversation-fixtures-v1",
            personLabel: fixture.label,
          },
        },
      });

      const messageIds: string[] = [];
      for (const [index, [role, content]] of userFixture.messages.entries()) {
        const message = await prisma.message.create({
          data: {
            conversationId: conversation.id,
            role,
            content,
            externalMessageId: `${userFixture.conversationId}:m${index + 1}`,
            createdAt: minutesAgo(120 - created.length * 12 - index * 3),
            metadata: role === "assistant"
              ? {
                  deliveryKind: "final",
                  replyGroupId: `${conversation.id}:seed-reply-${Math.floor(index / 2)}`,
                  seed: true,
                }
              : { seed: true },
          },
        });
        messageIds.push(message.id);
      }

      await prisma.runtimeEvent.create({
        data: {
          eventType: "chat_turn",
          source: user.externalId === "web:owner" ? "owner_chat" : "chat",
          summary: `测试对话：${fixture.label} 通过 ${channel} 和思源聊了 ${userFixture.messages.length} 条消息。`,
          importance: user.externalId === "web:owner" ? 75 : 45,
          topic: fixture.label === "Cyan / Owner" ? "运行态与自主任务设计" : "测试关系对话",
          moodSignal: fixture.affinity >= 60 ? "warm" : "steady",
          energySignal: fixture.label === "小雨" ? "soft_support" : "engaged",
          stateImpact: {
            canMutateRuntimeState: false,
            mutationGate: "seed_observe_only",
            sourceMessageIds: messageIds,
          },
          payload: {
            seed: true,
            seedKey: "relationship-conversation-fixtures-v1",
            personLabel: fixture.label,
            userExternalId: user.externalId,
          },
          userId: user.id,
          conversationId: conversation.id,
          messageId: messageIds.at(-1),
          channel,
          status: "observed",
          createdAt: minutesAgo(8 + created.length),
        },
      });

      personUsers.push({
        id: user.id,
        externalId: user.externalId,
        displayName: user.displayName,
        conversationId: conversation.externalConversationId,
      });
    }

    created.push({
      person: {
        id: person.id,
        label: person.label,
        affinity: relationship.affinity,
        relationshipLabel: relationship.relationshipLabel,
      },
      users: personUsers,
    });
  }

  for (const userFixture of unlinkedUserFixtures) {
    const user = await prisma.user.create({
      data: {
        externalId: userFixture.externalId,
        displayName: userFixture.displayName,
      },
    });

    const channel = channelFromExternalId(userFixture.externalId);
    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        channel,
        externalConversationId: userFixture.conversationId,
        metadata: {
          seed: true,
          seedKey: "relationship-conversation-fixtures-v1",
          unlinkedUser: true,
        },
      },
    });

    const messageIds: string[] = [];
    for (const [index, [role, content]] of userFixture.messages.entries()) {
      const message = await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role,
          content,
          externalMessageId: `${userFixture.conversationId}:m${index + 1}`,
          createdAt: minutesAgo(45 - createdUnlinkedUsers.length * 8 - index * 3),
          metadata: role === "assistant"
            ? {
                deliveryKind: "final",
                replyGroupId: `${conversation.id}:seed-reply-${Math.floor(index / 2)}`,
                seed: true,
                unlinkedUser: true,
              }
            : {
                seed: true,
                unlinkedUser: true,
              },
        },
      });
      messageIds.push(message.id);
    }

    await prisma.runtimeEvent.create({
      data: {
        eventType: "chat_turn",
        source: "chat",
        summary: `测试对话：未归属用户 ${userFixture.displayName} 通过 ${channel} 和思源聊了 ${userFixture.messages.length} 条消息。`,
        importance: 30,
        topic: "未归属身份测试对话",
        moodSignal: "neutral",
        energySignal: "observe",
        stateImpact: {
          canMutateRuntimeState: false,
          mutationGate: "seed_observe_only",
          sourceMessageIds: messageIds,
        },
        payload: {
          seed: true,
          seedKey: "relationship-conversation-fixtures-v1",
          unlinkedUser: true,
          userExternalId: user.externalId,
        },
        userId: user.id,
        conversationId: conversation.id,
        messageId: messageIds.at(-1),
        channel,
        status: "observed",
        createdAt: minutesAgo(5 + createdUnlinkedUsers.length),
      },
    });

    createdUnlinkedUsers.push({
      id: user.id,
      externalId: user.externalId,
      displayName: user.displayName,
      conversationId: conversation.externalConversationId,
    });
  }

  const counts = await Promise.all([
    prisma.personIdentity.count(),
    prisma.user.count(),
    prisma.identityLink.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.relationshipState.count(),
    prisma.runtimeEvent.count(),
  ]);

  console.log(JSON.stringify({
    created,
    unlinkedUsers: createdUnlinkedUsers,
    counts: {
      personIdentities: counts[0],
      users: counts[1],
      unlinkedUsers: counts[1] - counts[2],
      identityLinks: counts[2],
      conversations: counts[3],
      messages: counts[4],
      relationshipStates: counts[5],
      runtimeEvents: counts[6],
    },
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
