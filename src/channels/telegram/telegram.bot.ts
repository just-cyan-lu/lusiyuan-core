import { Bot } from "grammy";
import { HttpsProxyAgent } from "https-proxy-agent";
import { env } from "../../utils/env.js";
import { chat } from "../../core/chat.service.js";
import { memoryService } from "../../core/memory.service.js";
import { imageService } from "../../media/image.service.js";
import type { MessageContentPart } from "../../types/model.js";

const OWNER_IDS = new Set(env.OWNER_USER_IDS);

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
    // Reset is handled at chat.service level by starting a new conversation_id.
    // Here we just acknowledge — the next message will create a new conversation naturally
    // if the user changes their conversation_id. For now, inform the user.
    await ctx.reply("好的，咱们重新开始聊吧。");
  });

  bot.command("memories", async (ctx) => {
    const userId = `telegram:${ctx.from?.id}`;
    if (!OWNER_IDS.has(userId)) {
      await ctx.reply("这个命令只有管理员才能用。");
      return;
    }
    const memories = await memoryService.listUserMemories(userId);
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

    if (message.text.length > env.MAX_MESSAGE_LENGTH) {
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
        conversation_id: `telegram:${chatCtx.id}`,
        message: message.text,
        external_message_id: String(message.message_id),
        display_name: from?.username ?? from?.first_name,
        raw_event: message,
        onIntermediateMessage: async (content: string, delayMs: number) => {
          // Add delay to simulate typing
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          await ctx.reply(content);
        },
      });

      if (result.duplicated) return;

      await ctx.reply(result.reply);
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
      const fileInfo = await ctx.api.getFile(photo.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;

      const imageData = await imageService.loadFromUrl(fileUrl);
      const imagePart: MessageContentPart = imageService.toContentPart(imageData);

      const caption = message.caption ?? "（用户发送了一张图片）";

      const result = await chat({
        user_id: `telegram:${from?.id ?? chatCtx.id}`,
        channel: "telegram",
        conversation_id: `telegram:${chatCtx.id}`,
        message: caption,
        images: [imagePart],
        external_message_id: String(message.message_id),
        display_name: from?.username ?? from?.first_name,
        raw_event: message,
        onIntermediateMessage: async (content: string, delayMs: number) => {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          await ctx.reply(content);
        },
      });

      if (result.duplicated) return;

      await ctx.reply(result.reply);
    } catch (err) {
      console.error("Telegram photo handling failed:", err);
      await ctx.reply("图片处理出了点问题，稍后再试试？");
    }
  });

  return bot;
}
