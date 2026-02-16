import { resolve } from "node:path";
import { config } from "./config.js";
import { db } from "./db/index.js";
import { logger } from "./utils/logger.js";
import { createBot } from "./bot/index.js";
import { userbotManager } from "./services/userbot-manager.js";
import { NotificationScheduler } from "./services/notification-scheduler.js";
import { setNotificationScheduler } from "./services/message-parser.js";
import { historyScanner } from "./services/history-scanner.js";
import { createApi } from "./api/index.js";

async function main() {
  logger.info("Starting Majestic Rent Bot...");

  // Run migrations
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  try {
    migrate(db, { migrationsFolder: resolve(import.meta.dirname, "../../drizzle") });
    logger.info("Database migrations applied");
  } catch (error) {
    logger.warn({ error }, "Migration skipped (may need to generate first)");
  }

  // Create bot
  const bot = createBot();

  // Initialize notification scheduler
  const scheduler = new NotificationScheduler(bot);
  setNotificationScheduler(scheduler);
  await scheduler.initialize();

  // Initialize history scanner (must be before userbotManager for auto-scan)
  historyScanner.setBot(bot);

  // Initialize userbot manager (restore sessions, triggers auto-scan)
  await userbotManager.initialize();

  // Start API server
  const api = await createApi();

  // Start bot
  bot.start({
    onStart: () => logger.info("Bot started"),
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    scheduler.stop();
    await bot.stop();
    await userbotManager.disconnectAll();
    await api.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.fatal({ error }, "Failed to start");
  process.exit(1);
});
