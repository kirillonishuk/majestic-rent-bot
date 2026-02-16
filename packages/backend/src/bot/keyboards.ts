import { InlineKeyboard } from "grammy";
import { config } from "../config.js";

export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .webApp("📊 Статистика", config.webAppUrl)
    .row()
    .text("🔗 Подключить аккаунт", "connect")
    .row()
    .text("ℹ️ Статус", "status");
}

export function connectedMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .webApp("📊 Статистика", config.webAppUrl)
    .row()
    .text("📥 Импорт истории", "scan")
    .row()
    .text("🔌 Отключить аккаунт", "disconnect")
    .row()
    .text("ℹ️ Статус", "status");
}
