import { Bot, type Context } from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import { env } from "../../utils/env.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import { chat } from "../../core/chat.service.js";
import { memoryService } from "../../core/memory.service.js";
import { imageService } from "../../media/image.service.js";
import { prisma } from "../../db/prisma.js";
import type { ChatOutput } from "../../types/chat.js";
import type { MessageContentPart } from "../../types/model.js";

const OWNER_IDS = new Set(env.OWNER_USER_IDS);
const conversationSessions = new Map<number, string>();

class TelegramImageTooLargeError extends Error {}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function getConversationId(chatId: number): string {
  return conversationSessions.get(chatId) ?? `telegram:${chatId}`;
}

function resetConversationId(chatId: number): string {
  const conversationId = `telegram:${chatId}:session:${Date.now()}`;
  conversationSessions.set(chatId, conversationId);
  return conversationId;
}

export function createTelegramBot(token: string) {
  const botOptions = env.TELEGRAM_PROXY
    ? {
        client: {
          baseFetchConfig: {
            agent: new HttpsProxyAgent(env.TELEGRAM_PROXY),
          },
        },
      }
    : {};

  const bot = new Bot(token, botOptions);

  async function sendFinalReplies(ctx: Context, result: ChatOutput): Promise<void> {
    const finalParts = result.reply_parts.length > 0
      ? result.reply_parts.filter((part) => part.kind === "final")
      : result.replies.map((content, index) => ({
          turn_id: result.turn_id,
          sequence: index,
          kind: "final" as const,
          content,
          delay_ms: index === 0 ? 0 : 600,
          transcript: true,
        }));

    const parts = finalParts.length > 0
      ? finalParts
      : [{
          turn_id: result.turn_id,
          sequence: 0,
          kind: "final" as const,
          content: result.reply,
          delay_ms: 0,
          transcript: true,
        }];

    for (const part of parts) {
      if (part.delay_ms > 0) await sleep(part.delay_ms);
      await ctx.reply(part.content);
    }
  }

  async function loadTelegramImagePart(
    fileId: string,
    fileSize?: number,
    fallbackMimeType?: string
  ): Promise<MessageContentPart> {
    if (fileSize && fileSize > runtimeConfig.TELEGRAM_MAX_IMAGE_FILE_BYTES) {
      throw new TelegramImageTooLargeError(
        `Telegram image is too large: ${fileSize} bytes`
      );
    }

    const fileInfo = await bot.api.getFile(fileId);
    const telegramFile = fileInfo as { file_path?: string; file_size?: number };
    const resolvedSize = fileSize ?? telegramFile.file_size;
    if (resolvedSize && resolvedSize > runtimeConfig.TELEGRAM_MAX_IMAGE_FILE_BYTES) {
      throw new TelegramImageTooLargeError(
        `Telegram image is too large: ${resolvedSize} bytes`
      );
    }
    if (!telegramFile.file_path) {
      throw new Error("Telegram file_path is missing");
    }

    const fileUrl = `https://api.telegram.org/file/bot${token}/${telegramFile.file_path}`;
    const imageData = await imageService.loadFromUrl(fileUrl, {
      proxyUrl: env.EXTERNAL_HTTP_PROXY,
      timeoutMs: runtimeConfig.TELEGRAM_FILE_DOWNLOAD_TIMEOUT_MS,
      retries: runtimeConfig.TELEGRAM_FILE_DOWNLOAD_RETRIES,
      fallbackMimeType: fallbackMimeType ?? imageService.inferMimeTypeFromPath(telegramFile.file_path),
    });

    return imageService.toContentPart(imageData);
  }

  bot.command("start", async (ctx) => {
    await ctx.reply(
      "你好，我是陆思源。\n我是一个原创 AI 数字人，不是真人，但我会认真和你聊天。\n\n发消息给我就好，或者输入 /help 看看有什么可以做的。"
    );
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(
      "你可以直接和我聊天。\n\n支持的命令：\n/start — 打个招呼\n/help — 查看帮助\n/reset — 重置本次会话"
    );
  });

  bot.command("reset", async (ctx) => {
    resetConversationId(ctx.chat.id);
    await ctx.reply("好的，咱们重新开始聊吧。刚才的上下文不会带进来了。");
  });

  bot.command("memories", async (ctx) => {
    const userId = `telegram:${ctx.from?.id}`;
    if (!OWNER_IDS.has(userId)) {
      await ctx.reply("这个命令只有管理员才能用。");
      return;
    }
    const user = await prisma.user.findUnique({ where: { externalId: userId } });
    if (!user) {
      await ctx.reply("还没有找到你的用户记录。");
      return;
    }
    const memories = await memoryService.listUserMemories(user.id);
    if (memories.length === 0) {
      await ctx.reply("暂无记忆记录。");
      return;
    }
    const lines = memories
      .slice(0, 20)
      .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
      .join("\n");
    await ctx.reply(lines);
  });

  bot.on("message:text", async (ctx) => {
    const from = ctx.from;
    const chatCtx = ctx.chat;
    const message = ctx.message;

    if (runtimeConfig.MAX_MESSAGE_LENGTH > 0 && message.text.length > runtimeConfig.MAX_MESSAGE_LENGTH) {
      await ctx.reply("消息太长了，请缩短一下再发给我。");
      return;
    }

    // Only respond in private chats; in groups, only respond when @mentioned
    if (chatCtx.type !== "private") {
      const botUsername = ctx.me.username;
      if (botUsername && !message.text.includes(`@${botUsername}`)) {
        return;
      }
    }

    try {
      const result = await chat({
        user_id: `telegram:${from?.id ?? chatCtx.id}`,
        channel: "telegram",
        conversation_id: getConversationId(chatCtx.id),
        message: message.text,
        external_message_id: String(message.message_id),
        display_name: from?.username ?? from?.first_name,
        raw_event: message,
        onIntermediateMessage: async (content: string, delayMs: number) => {
          // Add delay to simulate typing
          await sleep(delayMs);
          await ctx.reply(content);
        },
      });

      if (result.duplicated) return;

      await sendFinalReplies(ctx, result);
    } catch (err) {
      console.error("Telegram message handling failed:", err);
      await ctx.reply("出了点小问题，稍后再试试？");
    }
  });

  // Handle photo messages (with optional caption as the user's text)
  bot.on("message:photo", async (ctx) => {
    const from = ctx.from;
    const chatCtx = ctx.chat;
    const message = ctx.message;

    // Only respond in private chats
    if (chatCtx.type !== "private") return;

    try {
      // Pick the highest-resolution photo variant
      const photos = message.photo;
      const photo = photos[photos.length - 1];
      const imagePart = await loadTelegramImagePart(photo.file_id, photo.file_size);

      const caption = message.caption ?? "（用户发送了一张图片）";

      const result = await chat({
        user_id: `telegram:${from?.id ?? chatCtx.id}`,
        channel: "telegram",
        conversation_id: getConversationId(chatCtx.id),
        message: caption,
        images: [imagePart],
        external_message_id: String(message.message_id),
        display_name: from?.username ?? from?.first_name,
        raw_event: message,
        onIntermediateMessage: async (content: string, delayMs: number) => {
          await sleep(delayMs);
          await ctx.reply(content);
        },
      });

      if (result.duplicated) return;

      await sendFinalReplies(ctx, result);
    } catch (err) {
      console.error("Telegram photo handling failed:", err);
      const text = err instanceof TelegramImageTooLargeError
        ? "这张图片太大了，请压缩到 10MB 以内再发我。"
        : "图片处理出了点问题，稍后再试试？";
      await ctx.reply(text);
    }
  });

  // Handle images sent as Telegram documents/files.
  bot.on("message:document", async (ctx) => {
    const from = ctx.from;
    const chatCtx = ctx.chat;
    const message = ctx.message;
    const document = message.document;

    if (chatCtx.type !== "private") return;

    const mimeType = document.mime_type ?? "";
    if (!mimeType.startsWith("image/")) {
      await ctx.reply("我现在还只能处理图片文件，普通文件暂时看不了。");
      return;
    }

    try {
      const imagePart = await loadTelegramImagePart(
        document.file_id,
        document.file_size,
        mimeType
      );
      const caption = message.caption ?? "（用户发送了一张图片文件）";

      const result = await chat({
        user_id: `telegram:${from?.id ?? chatCtx.id}`,
        channel: "telegram",
        conversation_id: getConversationId(chatCtx.id),
        message: caption,
        images: [imagePart],
        external_message_id: String(message.message_id),
        display_name: from?.username ?? from?.first_name,
        raw_event: message,
        onIntermediateMessage: async (content: string, delayMs: number) => {
          await sleep(delayMs);
          await ctx.reply(content);
        },
      });

      if (result.duplicated) return;

      await sendFinalReplies(ctx, result);
    } catch (err) {
      console.error("Telegram document image handling failed:", err);
      const text = err instanceof TelegramImageTooLargeError
        ? "这张图片文件太大了，请压缩到 10MB 以内再发我。"
        : "图片文件处理出了点问题，稍后再试试？";
      await ctx.reply(text);
    }
  });

  return bot;
}
