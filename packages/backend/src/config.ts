import "dotenv/config";
import { resolve } from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  telegramApiId: Number(required("TELEGRAM_API_ID")),
  telegramApiHash: required("TELEGRAM_API_HASH"),
  botToken: required("BOT_TOKEN"),
  databasePath: resolve(process.env.DATABASE_PATH || "./data/majestic.db"),
  sessionEncryptionKey: required("SESSION_ENCRYPTION_KEY"),
  webAppUrl: process.env.WEB_APP_URL || "https://localhost:8080",
  apiPort: Number(process.env.API_PORT || "3000"),
  majesticBotUsername: process.env.MAJESTIC_BOT_USERNAME || "MajesticRolePlayBot",
} as const;
