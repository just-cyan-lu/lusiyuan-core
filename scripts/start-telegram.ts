import "dotenv/config";
import "../src/init.js"; // Initialize app (register tools, etc.)
import { createTelegramBot } from "../src/channels/telegram/telegram.bot.js";
import { env } from "../src/utils/env.js";
import { runtimeSettingsService } from "../src/config/runtime-settings.service.js";

async function main() {
  await runtimeSettingsService.initialize();
  if (!env.TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  console.log("Starting Telegram bot...");
  const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);
  bot.catch((err) => console.error("Telegram bot error:", err));
  await bot.start({
    onStart: (info) => {
      console.log(`Telegram bot @${info.username} started (long polling).`);
    },
  });
}

void main().catch((error) => {
  console.error("Failed to start Telegram bot:", error);
  process.exit(1);
});
