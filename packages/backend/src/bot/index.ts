import { Bot, type Context } from "grammy";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { disconnectCommand, performDisconnect } from "./commands/disconnect.js";
import { scanCommand } from "./commands/scan.js";
import { authStateMachine, startConnect } from "./auth-state-machine.js";

export function createBot(): Bot {
  const bot = new Bot(config.botToken);

  // Auth state machine middleware — must be before command handlers
  bot.use(authStateMachine);

  bot.command("start", startCommand);
  bot.command("connect", startConnect);
  bot.command("status", statusCommand);
  bot.command("disconnect", disconnectCommand);
  bot.command("scan", scanCommand);
  bot.command("help", async (ctx) => {
    await ctx.reply(
      "📋 Команды:\n\n" +
        "/start — Главное меню\n" +
        "/connect — Подключить Telegram аккаунт\n" +
        "/disconnect — Отключить аккаунт\n" +
        "/scan — Импорт истории аренд\n" +
        "/status — Статус подключения и статистика\n" +
        "/help — Список команд",
    );
  });

  bot.catch((err) => {
    const e = err.error;
    logger.error({
      error: e instanceof Error ? { message: e.message, stack: e.stack } : e,
      update: err.ctx?.update?.update_id,
    }, "Bot error");
  });

  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;

    switch (data) {
      case "connect":
        await ctx.answerCallbackQuery();
        await startConnect(ctx);
        break;
      case "disconnect":
        await ctx.answerCallbackQuery();
        await disconnectCommand(ctx);
        break;
      case "disconnect_confirm":
        await ctx.answerCallbackQuery({ text: "Отключаю..." });
        try { await ctx.deleteMessage(); } catch { /* ignore */ }
        await performDisconnect(ctx);
        break;
      case "disconnect_cancel":
        await ctx.answerCallbackQuery({ text: "Отменено" });
        try { await ctx.deleteMessage(); } catch { /* ignore */ }
        break;
      case "status":
        await ctx.answerCallbackQuery();
        await statusCommand(ctx);
        break;
      case "scan":
        await ctx.answerCallbackQuery();
        await scanCommand(ctx);
        break;
      default:
        await ctx.answerCallbackQuery();
    }
  });

  return bot;
}
