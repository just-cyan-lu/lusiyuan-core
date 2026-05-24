import "dotenv/config";
import { createTelegramBot } from "../src/channels/telegram/telegram.bot.js";
import { env } from "../src/utils/env.js";

if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);

bot.catch((err) => {
  console.error("Telegram bot error:", err);
});

await bot.start();
console.log("Telegram bot started (long polling).");
