import { Bot, type Context } from "grammy";
import {
  type Conversation,
  type ConversationFlavor,
  conversations,
  createConversation,
} from "@grammyjs/conversations";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";
import { startCommand } from "./commands/start.js";
import { statusCommand } from "./commands/status.js";
import { disconnectCommand } from "./commands/disconnect.js";
import { scanCommand } from "./commands/scan.js";
import { authConversation } from "./conversations/auth-conversation.js";

export type BotContext = ConversationFlavor<Context>;

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(config.botToken);

  bot.use(conversations());
  bot.use(createConversation(authConversation));

  bot.command("start", startCommand);
  bot.command("connect", async (ctx) => {
    await ctx.conversation.enter("authConversation");
  });
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
        await ctx.conversation.enter("authConversation");
        break;
      case "disconnect":
        await ctx.answerCallbackQuery();
        await disconnectCommand(ctx);
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
