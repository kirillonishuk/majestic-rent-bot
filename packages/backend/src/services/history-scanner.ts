import { eq, and, isNull, count } from "drizzle-orm";
import type { Bot, InlineKeyboard } from "grammy";
import { FloodWaitError } from "telegram/errors/RPCErrorList.js";
import { isRentalMessage, vehicleNameToImageSlug } from "@majestic/shared";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { users, vehicles, rentals } from "../db/schema.js";
import { processRentalMessage } from "./message-parser.js";
import { userbotManager } from "./userbot-manager.js";
import { scanCompleteKeyboard } from "../bot/keyboards.js";
import { logger } from "../utils/logger.js";

interface ScanProgress {
  totalProcessed: number;
  rentalsFound: number;
  newRentalsInserted: number;
  parseFailures: number;
  progressMessageId: number | null;
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

  getProgress(userId: number): ScanProgress | undefined {
    return this.activeScans.get(userId);
  }

  async scanUser(
    internalUserId: number,
    existingProgressMessageId?: number,
    forceFullRescan?: boolean,
  ): Promise<ScanProgress> {
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
      parseFailures: 0,
      progressMessageId: existingProgressMessageId ?? null,
      isRunning: true,
    };
    this.activeScans.set(internalUserId, progress);

    try {
      if (forceFullRescan) {
        await db
          .update(users)
          .set({ lastScannedMessageId: null })
          .where(eq(users.id, internalUserId));
      }
      const minId = forceFullRescan ? 0 : (user.lastScannedMessageId ?? 0);
      const isIncremental = minId > 0;

      await this.updateProgress(
        user.telegramId,
        isIncremental
          ? `📥 <b>Импорт истории</b>\n\n⏳ Проверяю новые сообщения...`
          : `📥 <b>Импорт истории</b>\n\n⏳ Запускаю полный скан. Это может занять несколько минут...`,
        progress,
      );

      let highestMessageId = minId;
      let lastProgressUpdate = Date.now();

      const iter = client.iterMessages(config.majesticBotUsername, {
        ...(minId > 0 ? { minId } : {}),
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
          if (result.parseError) {
            progress.parseFailures++;
          }
        }

        // Progress update every 30 seconds
        const now = Date.now();
        if (now - lastProgressUpdate > 30_000) {
          await this.updateProgress(
            user.telegramId,
            `📥 <b>Импорт истории</b>\n\n` +
              `⏳ Сканирование...\n\n` +
              `📨 Сообщений: ${progress.totalProcessed.toLocaleString()}\n` +
              `🏷 Новых аренд: ${progress.newRentalsInserted}`,
            progress,
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

      // Recalculate image slugs for vehicles missing them
      const vehiclesWithoutImage = await db
        .select()
        .from(vehicles)
        .where(and(eq(vehicles.userId, internalUserId), isNull(vehicles.imageSlug)))
        .all();

      for (const v of vehiclesWithoutImage) {
        const slug = vehicleNameToImageSlug(v.name);
        if (slug) {
          await db.update(vehicles).set({ imageSlug: slug }).where(eq(vehicles.id, v.id));
        }
      }

      const duplicates = progress.rentalsFound - progress.newRentalsInserted - progress.parseFailures;

      // When incremental scan found 0 messages, show existing stats
      if (isIncremental && progress.totalProcessed === 0) {
        const existingRentals = await db
          .select({ count: count() })
          .from(rentals)
          .where(eq(rentals.userId, internalUserId))
          .get();
        const totalRentals = existingRentals?.count ?? 0;

        await this.updateProgress(
          user.telegramId,
          `📥 <b>Импорт истории</b>\n\n` +
            `✅ Новых сообщений нет.\n\n` +
            `📦 Всего аренд в базе: ${totalRentals}\n\n` +
            `💡 Если хочешь пересканировать всё заново — нажми кнопку ниже.`,
          progress,
          { reply_markup: scanCompleteKeyboard() },
        );
      } else {
        await this.updateProgress(
          user.telegramId,
          `📥 <b>Импорт истории</b>\n\n` +
            `✅ Скан завершён!\n\n` +
            `📨 Сообщений проверено: ${progress.totalProcessed.toLocaleString()}\n` +
            `🏷 Аренд найдено: ${progress.rentalsFound}\n` +
            `📥 Новых импортировано: ${progress.newRentalsInserted}` +
            (duplicates > 0 ? `\n🔄 Дубликатов: ${duplicates}` : ``) +
            (progress.parseFailures > 0 ? `\n⚠️ Не распарсилось: ${progress.parseFailures}` : ``),
          progress,
          { reply_markup: scanCompleteKeyboard() },
        );
      }

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
        await this.updateProgress(
          user.telegramId,
          `📥 <b>Импорт истории</b>\n\n` +
            `⏳ Telegram ограничил скорость. Ожидание ${waitSeconds} сек...`,
          progress,
        );
        await new Promise((resolve) =>
          setTimeout(resolve, waitSeconds * 1000),
        );
        const savedMsgId = progress.progressMessageId;
        progress.isRunning = false;
        this.activeScans.delete(internalUserId);
        return this.scanUser(internalUserId, savedMsgId ?? undefined, false);
      }

      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error({ error, userId: internalUserId }, "History scan failed");
      await this.updateProgress(
        user.telegramId,
        `📥 <b>Импорт истории</b>\n\n` +
          `❌ Скан прерван.\n\n` +
          `📥 Импортировано до ошибки: ${progress.newRentalsInserted}\n` +
          `⚠️ ${errorMsg}`,
        progress,
        { reply_markup: scanCompleteKeyboard() },
      );
      throw error;
    } finally {
      progress.isRunning = false;
      this.activeScans.delete(internalUserId);
    }
  }

  private async updateProgress(
    telegramId: number,
    text: string,
    progress: ScanProgress,
    options?: { reply_markup?: InlineKeyboard },
  ): Promise<void> {
    if (!this.bot) return;
    try {
      if (progress.progressMessageId) {
        try {
          await this.bot.api.editMessageText(
            telegramId,
            progress.progressMessageId,
            text,
            { parse_mode: "HTML", reply_markup: options?.reply_markup },
          );
          return;
        } catch (editError: unknown) {
          if (
            editError instanceof Error &&
            editError.message.includes("message is not modified")
          ) {
            return;
          }
          logger.debug(
            { editError, telegramId },
            "Failed to edit progress message, sending new one",
          );
        }
      }
      const sent = await this.bot.api.sendMessage(telegramId, text, {
        parse_mode: "HTML",
        reply_markup: options?.reply_markup,
      });
      progress.progressMessageId = sent.message_id;
    } catch (error) {
      logger.warn({ error, telegramId }, "Failed to send scan progress");
    }
  }
}

export const historyScanner = new HistoryScanner();
