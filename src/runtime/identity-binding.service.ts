import { randomInt } from "node:crypto";
import { prisma } from "../db/prisma.js";
import {
  extractIdentityHints,
  relationshipStateService,
} from "./relationship-state.service.js";

const bindingCodeTtlMs = 10 * 60 * 1000;
const codeAlphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type IdentityBindingChatAction =
  | {
      type: "issued";
      code: string;
      expiresAt: Date;
      reply: string;
    }
  | {
      type: "redeemed" | "already_linked" | "self_code" | "expired" | "invalid" | "used";
      code: string;
      reply: string;
    };

function generateBindingCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += codeAlphabet[randomInt(codeAlphabet.length)];
  }
  return `CYAN-${suffix}`;
}

export function extractIdentityBindingCode(message: string): string | null {
  const normalized = message.toUpperCase();
  const match = normalized.match(/\bCYAN[\s-]?([A-Z0-9]{6})\b/u);
  return match?.[1] ? `CYAN-${match[1]}` : null;
}

const genericSelfIntroductionHints = new Set([
  "学生",
  "老师",
  "人类",
  "新人",
  "路人",
  "粉丝",
  "朋友",
  "同学",
  "作者",
  "程序员",
  "开发者",
  "普通人",
]);

function hasSpecificIdentityHint(message: string): boolean {
  const hints = extractIdentityHints(message);
  return hints.some((hint) => {
    const normalized = hint.trim().toLowerCase();
    if (!normalized || genericSelfIntroductionHints.has(normalized)) return false;
    return true;
  });
}

export function shouldOfferIdentityBinding(message: string): boolean {
  const text = message.trim();
  if (!text || extractIdentityBindingCode(text)) return false;

  const explicitBindingIntent =
    /绑定(?:一下)?(?:身份|账号|平台|渠道)?|身份绑定|账号绑定|合并(?:身份|账号)|把.+绑到.+|认一下我|认出我/u.test(text);
  if (explicitBindingIntent) return true;

  const platformSwitchIntent =
    /(换|切到|切换|从).{0,8}(微信|weixin|wx|telegram|tg|网页|web|小红书|xhs|b站|bilibili|微博|抖音|qq|discord).{0,8}(来|聊|号|账号|平台|这边|了|啦|这儿|这里)/iu.test(text) ||
    /(微信|weixin|wx|telegram|tg|网页|web|小红书|xhs|b站|bilibili|微博|抖音|qq|discord).{0,8}(那边|上|里).{0,8}(也是我|是我|聊过|认识)/iu.test(text);
  if (platformSwitchIntent) return true;

  const oldIdentityIntent = /(我是|我叫|叫我).{1,24}(之前|以前|上次|刚才|换号|小号|同一个人)/u.test(text);
  if (oldIdentityIntent && hasSpecificIdentityHint(text)) return true;

  const plainSelfIntroduction = /^(我是|我叫|叫我)\s*[@A-Za-z0-9_.\-\u4e00-\u9fa5]{2,32}$/u.test(text);
  return plainSelfIntroduction && hasSpecificIdentityHint(text);
}

function issuedReply(code: string): string {
  return [
    "可以绑呀。",
    `你去另一个平台也给我发这个码：${code}`,
    "10 分钟内有效。发过去之后，我就会把两边当成同一个人。",
  ].join("\n");
}

function redeemedReply(): string {
  return [
    "绑好了。",
    "以后我会把这边和刚才那个平台当成同一个人。"
  ].join("\n");
}

async function markExpired(code: string) {
  await prisma.identityBindingCode.updateMany({
    where: {
      code,
      status: "active",
    },
    data: {
      status: "expired",
    },
  });
}

export const identityBindingService = {
  async handleChatMessage(input: {
    userId: string;
    channel: string;
    conversationId: string;
    messageId: string;
    userMessage: string;
  }): Promise<IdentityBindingChatAction | null> {
    const code = extractIdentityBindingCode(input.userMessage);
    if (code) {
      return this.redeemCode({
        code,
        userId: input.userId,
        channel: input.channel,
        conversationId: input.conversationId,
        messageId: input.messageId,
      });
    }

    if (!shouldOfferIdentityBinding(input.userMessage)) return null;

    const issued = await this.issueCode(input.userId);
    return {
      type: "issued",
      code: issued.code,
      expiresAt: issued.expiresAt,
      reply: issuedReply(issued.code),
    };
  },

  async issueCode(userId: string) {
    const issuerPerson = await relationshipStateService.getOrCreatePersonForUser(userId);
    const now = new Date();

    await prisma.identityBindingCode.updateMany({
      where: {
        issuerUserId: userId,
        status: "active",
        expiresAt: { lte: now },
      },
      data: { status: "expired" },
    });

    const existing = await prisma.identityBindingCode.findFirst({
      where: {
        issuerUserId: userId,
        status: "active",
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return existing;

    const expiresAt = new Date(now.getTime() + bindingCodeTtlMs);
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        return await prisma.identityBindingCode.create({
          data: {
            code: generateBindingCode(),
            issuerUserId: userId,
            issuerPersonId: issuerPerson.id,
            expiresAt,
          },
        });
      } catch (error) {
        if (attempt === 7) throw error;
      }
    }

    throw new Error("Failed to create identity binding code");
  },

  async redeemCode(input: {
    code: string;
    userId: string;
    channel: string;
    conversationId: string;
    messageId: string;
  }): Promise<IdentityBindingChatAction> {
    const code = extractIdentityBindingCode(input.code) ?? input.code.toUpperCase();
    const bindingCode = await prisma.identityBindingCode.findUnique({
      where: { code },
    });

    if (!bindingCode) {
      return {
        type: "invalid",
        code,
        reply: "这个绑定码没找到。你是不是少复制了一位？",
      };
    }

    const now = new Date();
    if (bindingCode.status === "redeemed") {
      return {
        type: "used",
        code,
        reply: "这个绑定码已经用过了。要不在原来的平台再让我发一个新的？",
      };
    }
    if (bindingCode.status !== "active" || bindingCode.expiresAt.getTime() <= now.getTime()) {
      await markExpired(code);
      return {
        type: "expired",
        code,
        reply: "这个绑定码过期了。你在原来的平台再让我发一个新的就行。",
      };
    }
    if (bindingCode.issuerUserId === input.userId) {
      return {
        type: "self_code",
        code,
        reply: "这个码是这边生成的啦。要去另一个平台发给我，才算绑定。",
      };
    }

    const currentPerson = await relationshipStateService.getOrCreatePersonForUser(input.userId);
    if (currentPerson.id === bindingCode.issuerPersonId) {
      await prisma.identityBindingCode.update({
        where: { id: bindingCode.id },
        data: {
          status: "redeemed",
          redeemedUserId: input.userId,
          redeemedAt: now,
        },
      });
      return {
        type: "already_linked",
        code,
        reply: "已经绑在同一个身份下面了。",
      };
    }

    const issuerRelationship = await relationshipStateService.getOrCreateForPerson(bindingCode.issuerPersonId);
    const currentRelationship = await relationshipStateService.getOrCreate(input.userId);
    await relationshipStateService.mergeRelationships({
      sourceRelationshipId: currentRelationship.id,
      targetRelationshipId: issuerRelationship.id,
      source: "identity_binding_code",
      reviewedBy: "self_binding_code",
    });

    await prisma.identityBindingCode.update({
      where: { id: bindingCode.id },
      data: {
        status: "redeemed",
        redeemedUserId: input.userId,
        redeemedAt: now,
      },
    });

    await prisma.relationshipStateEvent.create({
      data: {
        relationshipStateId: issuerRelationship.id,
        personId: issuerRelationship.personId,
        userId: input.userId,
        eventType: "identity_binding_code_redeemed",
        source: "identity_binding_code",
        summary: `用户通过绑定码 ${code} 确认两个渠道账号属于同一个现实身份。`,
        patch: {
          code,
          issuerUserId: bindingCode.issuerUserId,
          redeemedUserId: input.userId,
        },
        conversationId: input.conversationId,
        messageId: input.messageId,
        channel: input.channel,
      },
    });

    return {
      type: "redeemed",
      code,
      reply: redeemedReply(),
    };
  },
};
