import { and, eq, gt } from "drizzle-orm";
import type { Bot } from "grammy";
import { db } from "../db/index.js";
import { rentals, vehicles, users, notificationLog } from "../db/schema.js";
import { logger } from "../utils/logger.js";

interface ScheduledNotification {
  rentalId: number;
  telegramId: number;
  vehicleName: string;
  plateNumber: string | null;
  expiresAt: Date;
}

export class NotificationScheduler {
  private queue: ScheduledNotification[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL_MS = 30_000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private bot: Bot<any>) {}

  async initialize(): Promise<void> {
    const pending = await db
      .select({
        rentalId: rentals.id,
        telegramId: users.telegramId,
        vehicleName: vehicles.name,
        plateNumber: vehicles.plateNumber,
        expiresAt: rentals.expiresAt,
      })
      .from(rentals)
      .innerJoin(vehicles, eq(rentals.vehicleId, vehicles.id))
      .innerJoin(users, eq(rentals.userId, users.id))
      .where(
        and(
          gt(rentals.expiresAt, new Date().toISOString()),
          eq(rentals.notificationSent, false),
        ),
      )
      .all();

    for (const row of pending) {
      this.queue.push({
        rentalId: row.rentalId,
        telegramId: row.telegramId,
        vehicleName: row.vehicleName,
        plateNumber: row.plateNumber,
        expiresAt: new Date(row.expiresAt),
      });
    }

    this.queue.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
    this.startChecking();

    logger.info({ count: this.queue.length }, "Notification scheduler initialized");
  }

  scheduleNotification(notification: ScheduledNotification): void {
    const idx = this.queue.findIndex(
      (n) => n.expiresAt > notification.expiresAt,
    );
    if (idx === -1) {
      this.queue.push(notification);
    } else {
      this.queue.splice(idx, 0, notification);
    }
  }

  private startChecking(): void {
    this.timer = setInterval(() => this.processQueue(), this.CHECK_INTERVAL_MS);
  }

  private async processQueue(): Promise<void> {
    const now = new Date();
    while (this.queue.length > 0 && this.queue[0].expiresAt <= now) {
      const item = this.queue.shift()!;
      await this.sendNotification(item);
    }
  }

  private async sendNotification(item: ScheduledNotification): Promise<void> {
    try {
      await this.bot.api.sendMessage(
        item.telegramId,
        `🔔 <b>Аренда истекла!</b>\n\n` +
          `Транспорт: ${item.vehicleName}\n` +
          (item.plateNumber ? `Номер: ${item.plateNumber}\n` : "") +
          `\nПора выставить на аренду снова!`,
        { parse_mode: "HTML" },
      );

      await db
        .update(rentals)
        .set({ notificationSent: true })
        .where(eq(rentals.id, item.rentalId));

      const user = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, item.telegramId))
        .get();

      if (user) {
        await db.insert(notificationLog).values({
          rentalId: item.rentalId,
          userId: user.id,
          success: true,
        });
      }

      logger.info(
        { rentalId: item.rentalId, telegramId: item.telegramId },
        "Notification sent",
      );
    } catch (error) {
      logger.error(
        { rentalId: item.rentalId, error },
        "Failed to send notification",
      );

      const user = await db
        .select()
        .from(users)
        .where(eq(users.telegramId, item.telegramId))
        .get();

      if (user) {
        await db.insert(notificationLog).values({
          rentalId: item.rentalId,
          userId: user.id,
          success: false,
          errorMessage: String(error),
        });
      }
    }
  }

  cancelNotification(rentalId: number): void {
    const idx = this.queue.findIndex((n) => n.rentalId === rentalId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      logger.info({ rentalId }, "Notification cancelled (vehicle re-rented)");
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
