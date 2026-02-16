import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { userbotManager } from "../../services/userbot-manager.js";
import { mainMenuKeyboard } from "../keyboards.js";

export async function disconnectCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (!user || !user.isConnected) {
    await ctx.reply("Аккаунт не подключён.");
    return;
  }

  await userbotManager.removeClient(user.id);
  await db
    .update(users)
    .set({
      isConnected: false,
      mtprotoSession: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id));

  await ctx.reply("✅ Аккаунт отключён. Отслеживание аренд остановлено.", {
    reply_markup: mainMenuKeyboard(),
  });
}
