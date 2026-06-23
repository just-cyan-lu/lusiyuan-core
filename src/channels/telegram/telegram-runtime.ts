import type { Bot } from "grammy";
import { env } from "../../utils/env.js";
import { runtimeConfig } from "../../config/runtime-settings.service.js";
import { createTelegramBot } from "./telegram.bot.js";

interface RuntimeLogger {
  info: (message: string) => void;
  error: (message: string, error?: unknown) => void;
}

class TelegramRuntime {
  private bot: Bot | null = null;

  async reconfigure(logger?: RuntimeLogger): Promise<void> {
    if (!runtimeConfig.TELEGRAM_ENABLED) {
      await this.stop(logger);
      return;
    }
    if (!env.TELEGRAM_BOT_TOKEN) {
      await this.stop(logger);
      logger?.error("[Telegram] 已启用，但 TELEGRAM_BOT_TOKEN 未配置");
      return;
    }
    if (this.bot) return;

    const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);
    this.bot = bot;
    bot.catch((error) => logger?.error("[Telegram] Bot error", error));
    void bot.start({
      onStart: (info) => logger?.info(`[Telegram] @${info.username} started`),
    }).catch((error) => {
      if (this.bot === bot) this.bot = null;
      logger?.error("[Telegram] Failed to start", error);
    });
  }

  async stop(logger?: Pick<RuntimeLogger, "info">): Promise<void> {
    const bot = this.bot;
    if (!bot) return;
    this.bot = null;
    await bot.stop();
    logger?.info("[Telegram] stopped");
  }
}

export const telegramRuntime = new TelegramRuntime();
