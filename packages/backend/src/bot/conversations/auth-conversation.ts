import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import { eq } from "drizzle-orm";
import { AuthFlow } from "../../services/auth-flow.js";
import { UserbotClient } from "../../services/userbot-client.js";
import { userbotManager } from "../../services/userbot-manager.js";
import { historyScanner } from "../../services/history-scanner.js";
import { handleIncomingMessage } from "../../services/message-parser.js";
import { encrypt } from "../../utils/crypto.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";
import { connectedMenuKeyboard } from "../keyboards.js";
import { logger } from "../../utils/logger.js";

// Store auth flows outside conversation to survive replays
const pendingAuths = new Map<number, AuthFlow>();

export async function authConversation(
  conversation: Conversation,
  ctx: Context,
): Promise<void> {
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

  if (user.isConnected) {
    await ctx.reply("Аккаунт уже подключён! Используй /disconnect, чтобы отключить.");
    return;
  }

  await ctx.reply(
    "📱 Для подключения мне нужен твой номер телефона.\n\n" +
      "Введи номер в международном формате (например, +79991234567):",
  );

  const phoneCtx = await conversation.waitFor("message:text");
  const phoneNumber = phoneCtx.message!.text.trim();

  if (!phoneNumber.startsWith("+")) {
    await ctx.reply("❌ Номер должен начинаться с +. Попробуй снова: /connect");
    return;
  }

  // Reuse existing auth flow if conversation replays, otherwise create new
  let authFlow = pendingAuths.get(telegramId);
  if (!authFlow || !authFlow.isStarted()) {
    // Clean up old flow if exists
    if (authFlow) await authFlow.destroy();

    authFlow = new AuthFlow();
    pendingAuths.set(telegramId, authFlow);

    await ctx.reply("⏳ Отправляю код авторизации...");
    const startResult = await authFlow.startAuth(phoneNumber);

    if (!startResult.success) {
      await ctx.reply(`❌ Ошибка: ${startResult.error}\nПопробуй снова: /connect`);
      await authFlow.destroy();
      pendingAuths.delete(telegramId);
      return;
    }
  }

  await ctx.reply(
    "✅ Код отправлен в Telegram!\n\n" +
      "Введи код авторизации (5 цифр):",
  );

  const codeCtx = await conversation.waitFor("message:text");
  const code = codeCtx.message!.text.trim().replace(/[^0-9]/g, "");

  const codeResult = await authFlow.submitCode(phoneNumber, code);

  if (codeResult.needs2FA) {
    await ctx.reply("🔐 Требуется пароль двухфакторной аутентификации.\n\nВведи пароль:");

    const passCtx = await conversation.waitFor("message:text");
    const password = passCtx.message!.text;

    // Delete password message for security
    try {
      await passCtx.deleteMessage();
    } catch {
      // May fail if bot lacks permissions
    }

    const tfaResult = await authFlow.submit2FA(password);
    if (!tfaResult.success) {
      await ctx.reply(`❌ Неверный пароль: ${tfaResult.error}\nПопробуй снова: /connect`);
      await authFlow.destroy();
      pendingAuths.delete(telegramId);
      return;
    }
  } else if (!codeResult.success) {
    await ctx.reply(`❌ Неверный код: ${codeResult.error}\nПопробуй снова: /connect`);
    await authFlow.destroy();
    pendingAuths.delete(telegramId);
    return;
  }

  const sessionString = authFlow.getSessionString();
  const encryptedSession = encrypt(sessionString);
  pendingAuths.delete(telegramId);

  await db
    .update(users)
    .set({
      mtprotoSession: encryptedSession,
      isConnected: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id));

  const existingClient = authFlow.getClient();
  if (existingClient) {
    const userbotClient = UserbotClient.fromExistingClient(
      user.id,
      existingClient,
      handleIncomingMessage,
    );
    userbotManager.addExistingClient(user.id, userbotClient);

    // Trigger background scan of message history
    historyScanner.scanUser(user.id).catch((error) => {
      logger.error({ userId: user.id, error }, "Auto-scan after auth failed");
    });
  }

  await ctx.reply(
    "✅ Аккаунт успешно подключён!\n\n" +
      "Теперь я отслеживаю уведомления об аренде от @MajesticRolePlayBot и пришлю тебе уведомление, когда аренда истечёт.\n\n" +
      "Запускаю импорт истории сообщений...",
    { reply_markup: connectedMenuKeyboard() },
  );
}
