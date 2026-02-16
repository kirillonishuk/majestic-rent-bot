import { eq } from "drizzle-orm";
import type { Bot } from "grammy";
import { FloodWaitError } from "telegram/errors/RPCErrorList.js";
import { isRentalMessage } from "@majestic/shared";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { processRentalMessage } from "./message-parser.js";
import { userbotManager } from "./userbot-manager.js";
import { logger } from "../utils/logger.js";

interface ScanProgress {
  totalProcessed: number;
  rentalsFound: number;
  newRentalsInserted: number;
  isRunning: boolean;
}

class HistoryScanner {
  private activeScans = new Map<number, ScanProgress>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private bot: Bot<any> | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setBot(bot: Bot<any>): void {
    this.bot = bot;
  }

  isScanning(userId: number): boolean {
    return this.activeScans.get(userId)?.isRunning ?? false;
  }

  async scanUser(internalUserId: number): Promise<ScanProgress> {
    if (this.isScanning(internalUserId)) {
      throw new Error("Scan already in progress for this user");
    }

    const client = userbotManager.getClient(internalUserId);
    if (!client || !client.isConnected()) {
      throw new Error("User not connected");
    }

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, internalUserId))
      .get();
    if (!user) throw new Error("User not found");

    const progress: ScanProgress = {
      totalProcessed: 0,
      rentalsFound: 0,
      newRentalsInserted: 0,
      isRunning: true,
    };
    this.activeScans.set(internalUserId, progress);

    try {
      const minId = user.lastScannedMessageId ?? 0;
      const isIncremental = minId > 0;

      await this.sendProgress(
        user.telegramId,
        isIncremental
          ? "Проверяю пропущенные сообщения..."
          : "Запускаю полный скан истории. Это может занять несколько минут...",
      );

      let highestMessageId = minId;
      let lastProgressUpdate = Date.now();

      const iter = client.iterMessages(config.majesticBotUsername, {
        minId,
        reverse: true,
        waitTime: 2,
      });

      for await (const message of iter) {
        progress.totalProcessed++;

        if (message.id > highestMessageId) {
          highestMessageId = message.id;
        }

        const text = message.message;
        if (text && isRentalMessage(text)) {
          progress.rentalsFound++;

          const messageDate = new Date(message.date * 1000);
          const result = await processRentalMessage({
            internalUserId,
            text,
            messageId: message.id,
            messageDate,
          });

          if (result.inserted) {
            progress.newRentalsInserted++;
          }
        }

        // Progress update every 30 seconds
        const now = Date.now();
        if (now - lastProgressUpdate > 30_000) {
          await this.sendProgress(
            user.telegramId,
            `Сканирование... ${progress.totalProcessed} сообщений проверено, ` +
              `${progress.newRentalsInserted} новых аренд найдено`,
          );
          lastProgressUpdate = now;
        }

        // Checkpoint every 500 messages
        if (progress.totalProcessed % 500 === 0 && highestMessageId > minId) {
          await db
            .update(users)
            .set({ lastScannedMessageId: highestMessageId })
            .where(eq(users.id, internalUserId));
        }
      }

      // Final checkpoint
      if (highestMessageId > minId) {
        await db
          .update(users)
          .set({ lastScannedMessageId: highestMessageId })
          .where(eq(users.id, internalUserId));
      }

      await this.sendProgress(
        user.telegramId,
        `Скан завершён!\n\n` +
          `Сообщений проверено: ${progress.totalProcessed}\n` +
          `Аренд найдено: ${progress.rentalsFound}\n` +
          `Новых импортировано: ${progress.newRentalsInserted}\n` +
          `Дубликатов пропущено: ${progress.rentalsFound - progress.newRentalsInserted}`,
      );

      logger.info(
        { userId: internalUserId, ...progress },
        "History scan completed",
      );

      return progress;
    } catch (error) {
      if (error instanceof FloodWaitError) {
        const waitSeconds = error.seconds;
        logger.warn(
          { userId: internalUserId, waitSeconds },
          "FloodWait during scan",
        );
        await this.sendProgress(
          user.telegramId,
          `Telegram ограничил скорость. Ожидание ${waitSeconds} секунд...`,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, waitSeconds * 1000),
        );
        progress.isRunning = false;
        this.activeScans.delete(internalUserId);
        return this.scanUser(internalUserId);
      }

      logger.error({ error, userId: internalUserId }, "History scan failed");
      await this.sendProgress(
        user.telegramId,
        `Скан прерван. Импортировано ${progress.newRentalsInserted} аренд до ошибки. ` +
          `Используйте /scan для продолжения.`,
      );
      throw error;
    } finally {
      progress.isRunning = false;
      this.activeScans.delete(internalUserId);
    }
  }

  private async sendProgress(
    telegramId: number,
    text: string,
  ): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.sendMessage(telegramId, text);
    } catch (error) {
      logger.warn({ error, telegramId }, "Failed to send scan progress");
    }
  }
}

export const historyScanner = new HistoryScanner();
