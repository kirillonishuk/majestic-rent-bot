import { resolve } from "node:path";
import { sql } from "drizzle-orm";
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
    migrate(db, { migrationsFolder: resolve(import.meta.dirname, "../drizzle") });
    logger.info("Database migrations applied");
  } catch (error) {
    logger.warn({ error }, "Migration skipped (may need to generate first)");
  }

  // Fixup: ensure plate_number is nullable (migration 0002 may not have applied)
  const colInfo = db.get<{ notnull: number }>(
    sql`SELECT "notnull" FROM pragma_table_info('vehicles') WHERE name='plate_number'`,
  );
  if (colInfo && colInfo.notnull === 1) {
    logger.info("Fixing vehicles.plate_number NOT NULL constraint...");
    db.run(sql`PRAGMA foreign_keys=OFF`);
    db.run(sql`CREATE TABLE IF NOT EXISTS __fix_vehicles (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      plate_number text,
      image_slug text,
      created_at text DEFAULT (datetime('now')) NOT NULL
    )`);
    db.run(sql`INSERT INTO __fix_vehicles(id, user_id, name, plate_number, image_slug, created_at)
      SELECT id, user_id, name, plate_number, image_slug, created_at FROM vehicles`);
    db.run(sql`DROP TABLE vehicles`);
    db.run(sql`ALTER TABLE __fix_vehicles RENAME TO vehicles`);
    db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS vehicles_user_name_idx ON vehicles(user_id, name)`);
    db.run(sql`CREATE INDEX IF NOT EXISTS vehicles_user_id_idx ON vehicles(user_id)`);
    db.run(sql`PRAGMA foreign_keys=ON`);
    logger.info("Fixed vehicles.plate_number constraint");
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
