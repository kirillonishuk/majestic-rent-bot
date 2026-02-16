import type { Context } from "grammy";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { mainMenuKeyboard, connectedMenuKeyboard } from "../keyboards.js";

export async function startCommand(ctx: Context): Promise<void> {
  const telegramId = ctx.from!.id;

  let user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .get();

  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        telegramId,
        telegramUsername: ctx.from!.username ?? null,
        telegramFirstName: ctx.from!.first_name ?? null,
      })
      .returning();
  }

  const keyboard = user.isConnected
    ? connectedMenuKeyboard()
    : mainMenuKeyboard();

  await ctx.reply(
    `Привет, ${ctx.from!.first_name}! 👋\n\n` +
      `Я помогу отслеживать аренду твоего транспорта в Majestic RP.\n\n` +
      `${user.isConnected ? "✅ Твой аккаунт подключён. Я отслеживаю аренды." : "Для начала подключи свой Telegram аккаунт, чтобы я мог читать уведомления от @MajesticRolePlayBot."}`,
    { reply_markup: keyboard },
  );
}
