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

export function scanCompleteKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("🔄 Повторить скан", "scan");
}

export function disconnectConfirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Да, отключить", "disconnect_confirm")
    .text("❌ Отмена", "disconnect_cancel");
}
