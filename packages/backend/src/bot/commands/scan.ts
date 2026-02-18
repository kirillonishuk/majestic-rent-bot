import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { historyScanner } from "../../services/history-scanner.js";
import { logger } from "../../utils/logger.js";

export async function scanCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (!user || !user.isConnected) {
    await ctx.reply("Аккаунт не подключён. Используй /connect для подключения.");
    return;
  }

  if (historyScanner.isScanning(user.id)) {
    const progress = historyScanner.getProgress(user.id);
    if (progress) {
      await ctx.reply(
        `📥 <b>Скан уже идёт</b>\n\n` +
          `📨 Сообщений: ${progress.totalProcessed.toLocaleString()}\n` +
          `🏷 Новых аренд: ${progress.newRentalsInserted}`,
        { parse_mode: "HTML" },
      );
    } else {
      await ctx.reply("⏳ Скан уже запущен. Дождись завершения.");
    }
    return;
  }

  // Scanner sends its own progress message
  historyScanner.scanUser(user.id).catch((error) => {
    logger.error({ userId: user.id, error }, "Scan command failed");
  });
}
