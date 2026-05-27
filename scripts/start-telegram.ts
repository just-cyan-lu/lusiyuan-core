import "dotenv/config";
import "../src/init.js"; // Initialize app (register tools, etc.)
import { createTelegramBot } from "../src/channels/telegram/telegram.bot.js";
import { env } from "../src/utils/env.js";

if (!env.TELEGRAM_BOT_TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

console.log("Starting Telegram bot...");

const bot = createTelegramBot(env.TELEGRAM_BOT_TOKEN);

bot.catch((err) => {
  console.error("Telegram bot error:", err);
});

bot
  .start({
    onStart: (info) => {
      console.log(`Telegram bot @${info.username} started (long polling).`);
    },
  })
  .catch((err) => {
    console.error("Failed to start Telegram bot:", err);
    process.exit(1);
  });
