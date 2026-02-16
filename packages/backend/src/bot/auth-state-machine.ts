import type { Context, NextFunction } from "grammy";
import { eq } from "drizzle-orm";
import { AuthFlow } from "../services/auth-flow.js";
import { UserbotClient } from "../services/userbot-client.js";
import { userbotManager } from "../services/userbot-manager.js";
import { historyScanner } from "../services/history-scanner.js";
import { handleIncomingMessage } from "../services/message-parser.js";
import { encrypt } from "../utils/crypto.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { connectedMenuKeyboard } from "./keyboards.js";
import { logger } from "../utils/logger.js";

interface AuthState {
  step: "awaiting_phone" | "awaiting_code" | "awaiting_2fa";
  authFlow: AuthFlow;
  phoneNumber?: string;
  userId?: number;
}

const authStates = new Map<number, AuthState>();

/** Start the /connect flow */
export async function startConnect(ctx: Context): Promise<void> {
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

  // Clean up any previous auth state
  const old = authStates.get(telegramId);
  if (old) await old.authFlow.destroy().catch(() => {});

  authStates.set(telegramId, {
    step: "awaiting_phone",
    authFlow: new AuthFlow(),
    userId: user.id,
  });

  await ctx.reply(
    "📱 Для подключения мне нужен твой номер телефона.\n\n" +
      "Введи номер в международном формате (например, +79991234567):\n\n" +
      "Для отмены отправь /cancel",
  );
}

/** Middleware that intercepts text messages during auth flow */
export async function authStateMachine(ctx: Context, next: NextFunction): Promise<void> {
  // Only intercept plain text messages from users with active auth
  if (!ctx.message?.text || !ctx.from) return next();

  const telegramId = ctx.from.id;
  const state = authStates.get(telegramId);
  if (!state) return next();

  const text = ctx.message.text.trim();

  // Allow cancellation at any step
  if (text === "/cancel" || text === "/start") {
    await state.authFlow.destroy().catch(() => {});
    authStates.delete(telegramId);
    if (text === "/start") return next(); // let /start handler run
    await ctx.reply("❌ Подключение отменено.");
    return;
  }

  // Don't intercept other commands
  if (text.startsWith("/")) return next();

  try {
    switch (state.step) {
      case "awaiting_phone":
        await handlePhone(ctx, telegramId, state, text);
        break;
      case "awaiting_code":
        await handleCode(ctx, telegramId, state, text);
        break;
      case "awaiting_2fa":
        await handle2FA(ctx, telegramId, state, text);
        break;
    }
  } catch (error) {
    logger.error({ error, telegramId, step: state.step }, "Auth flow error");
    await state.authFlow.destroy().catch(() => {});
    authStates.delete(telegramId);
    await ctx.reply("❌ Произошла ошибка. Попробуй снова: /connect");
  }
}

async function handlePhone(ctx: Context, telegramId: number, state: AuthState, text: string): Promise<void> {
  if (!text.startsWith("+")) {
    await ctx.reply("❌ Номер должен начинаться с +. Попробуй ещё раз:");
    return;
  }

  state.phoneNumber = text;
  await ctx.reply("⏳ Отправляю код авторизации...");

  const result = await state.authFlow.startAuth(text);

  if (!result.success) {
    await state.authFlow.destroy().catch(() => {});
    authStates.delete(telegramId);
    await ctx.reply(`❌ Ошибка: ${result.error}\nПопробуй снова: /connect`);
    return;
  }

  state.step = "awaiting_code";
  await ctx.reply("✅ Код отправлен в Telegram!\n\nВведи код авторизации (5 цифр):");
}

async function handleCode(ctx: Context, telegramId: number, state: AuthState, text: string): Promise<void> {
  const code = text.replace(/[^0-9]/g, "");

  if (!code) {
    await ctx.reply("❌ Код должен содержать цифры. Попробуй ещё раз:");
    return;
  }

  logger.info({ telegramId }, "Submitting auth code...");
  const result = await state.authFlow.submitCode(state.phoneNumber!, code);
  logger.info({ telegramId, success: result.success, needs2FA: result.needs2FA }, "Auth code result");

  if (result.needs2FA) {
    state.step = "awaiting_2fa";
    await ctx.reply("🔐 Требуется пароль двухфакторной аутентификации.\n\nВведи пароль:");
    return;
  }

  if (!result.success) {
    await state.authFlow.destroy().catch(() => {});
    authStates.delete(telegramId);
    await ctx.reply(`❌ Неверный код: ${result.error}\nПопробуй снова: /connect`);
    return;
  }

  await finishAuth(ctx, telegramId, state);
}

async function handle2FA(ctx: Context, telegramId: number, state: AuthState, text: string): Promise<void> {
  // Delete password message for security
  try { await ctx.deleteMessage(); } catch {}

  const result = await state.authFlow.submit2FA(text);

  if (!result.success) {
    await state.authFlow.destroy().catch(() => {});
    authStates.delete(telegramId);
    await ctx.reply(`❌ Неверный пароль: ${result.error}\nПопробуй снова: /connect`);
    return;
  }

  await finishAuth(ctx, telegramId, state);
}

async function finishAuth(ctx: Context, telegramId: number, state: AuthState): Promise<void> {
  const sessionString = state.authFlow.getSessionString();
  const encryptedSession = encrypt(sessionString);

  await db
    .update(users)
    .set({
      mtprotoSession: encryptedSession,
      isConnected: true,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, state.userId!));

  const existingClient = state.authFlow.getClient();
  if (existingClient) {
    const userbotClient = UserbotClient.fromExistingClient(
      state.userId!,
      existingClient,
      handleIncomingMessage,
    );
    userbotManager.addExistingClient(state.userId!, userbotClient);

    historyScanner.scanUser(state.userId!).catch((error) => {
      logger.error({ userId: state.userId, error }, "Auto-scan after auth failed");
    });
  }

  authStates.delete(telegramId);

  await ctx.reply(
    "✅ Аккаунт успешно подключён!\n\n" +
      "Теперь я отслеживаю уведомления об аренде от @MajesticRolePlayBot и пришлю тебе уведомление, когда аренда истечёт.\n\n" +
      "Запускаю импорт истории сообщений...",
    { reply_markup: connectedMenuKeyboard() },
  );
}
