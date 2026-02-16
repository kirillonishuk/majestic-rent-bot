import type { Context } from "grammy";
import { eq, and, gt, count, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users, rentals } from "../../db/schema.js";
import { userbotManager } from "../../services/userbot-manager.js";

export async function statusCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (!user) {
    await ctx.reply("Сначала нажми /start");
    return;
  }

  const isOnline = userbotManager.isConnected(user.id);

  const stats = await db
    .select({
      total: count(),
      totalRevenue: sql<number>`coalesce(sum(${rentals.price}), 0)`,
    })
    .from(rentals)
    .where(eq(rentals.userId, user.id))
    .get();

  const activeRentals = await db
    .select({ count: count() })
    .from(rentals)
    .where(
      and(
        eq(rentals.userId, user.id),
        gt(rentals.expiresAt, new Date().toISOString()),
        eq(rentals.notificationSent, false),
      ),
    )
    .get();

  await ctx.reply(
    `📊 Статус\n\n` +
      `Подключение: ${isOnline ? "✅ Онлайн" : user.isConnected ? "⚠️ Переподключение..." : "❌ Не подключён"}\n` +
      `Всего аренд: ${stats?.total ?? 0}\n` +
      `Общий доход: $${(stats?.totalRevenue ?? 0).toLocaleString()}\n` +
      `Активных аренд: ${activeRentals?.count ?? 0}`,
  );
}
