import { eq, and } from "drizzle-orm";
import type { NewMessageEvent } from "telegram/events/index.js";
import { isRentalMessage, parseRentalMessage, vehicleNameToImageSlug } from "@majestic/shared";
import { db } from "../db/index.js";
import { users, vehicles, rentals } from "../db/schema.js";
import { logger } from "../utils/logger.js";
import type { NotificationScheduler } from "./notification-scheduler.js";

let scheduler: NotificationScheduler | null = null;

export function setNotificationScheduler(s: NotificationScheduler): void {
  scheduler = s;
}

export interface ProcessRentalParams {
  internalUserId: number;
  text: string;
  messageId: number;
  messageDate: Date;
}

export async function processRentalMessage(
  params: ProcessRentalParams,
): Promise<{ inserted: boolean; rentalId?: number }> {
  const { internalUserId, text, messageId, messageDate } = params;

  if (!isRentalMessage(text)) return { inserted: false };

  const parsed = parseRentalMessage(text);
  if (!parsed) {
    logger.warn({ userId: internalUserId }, "Failed to parse rental message");
    return { inserted: false };
  }

  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, internalUserId))
    .get();

  if (!user) {
    logger.error({ userId: internalUserId }, "User not found");
    return { inserted: false };
  }

  let vehicle = await db
    .select()
    .from(vehicles)
    .where(
      and(
        eq(vehicles.userId, internalUserId),
        eq(vehicles.plateNumber, parsed.plateNumber),
      ),
    )
    .get();

  if (!vehicle) {
    const imageSlug = vehicleNameToImageSlug(parsed.vehicleName);
    const [inserted] = await db
      .insert(vehicles)
      .values({
        userId: internalUserId,
        name: parsed.vehicleName,
        plateNumber: parsed.plateNumber,
        imageSlug,
      })
      .returning();
    vehicle = inserted;
  }

  const rentedAt = messageDate;
  const expiresAt = new Date(
    rentedAt.getTime() + parsed.durationHours * 60 * 60 * 1000,
  );
  const now = new Date();
  const alreadyExpired = expiresAt <= now;

  const [rental] = await db
    .insert(rentals)
    .values({
      userId: internalUserId,
      vehicleId: vehicle.id,
      server: parsed.server,
      characterName: parsed.characterName,
      characterId: parsed.characterId,
      price: parsed.price,
      durationHours: parsed.durationHours,
      renterName: parsed.renterName,
      rentedAt: rentedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      telegramMessageId: messageId,
      notificationSent: alreadyExpired,
    })
    .onConflictDoNothing()
    .returning();

  if (!rental) {
    return { inserted: false };
  }

  logger.info(
    {
      rentalId: rental.id,
      vehicle: parsed.vehicleName,
      plate: parsed.plateNumber,
      price: parsed.price,
      duration: parsed.durationHours,
    },
    "Rental recorded",
  );

  if (!alreadyExpired && scheduler) {
    scheduler.scheduleNotification({
      rentalId: rental.id,
      telegramId: user.telegramId,
      vehicleName: parsed.vehicleName,
      plateNumber: parsed.plateNumber,
      expiresAt,
    });
  }

  return { inserted: true, rentalId: rental.id };
}

export async function handleIncomingMessage(
  internalUserId: number,
  event: NewMessageEvent,
): Promise<void> {
  const text = event.message?.text;
  if (!text) return;

  const messageDate = new Date(event.message.date * 1000);

  try {
    await processRentalMessage({
      internalUserId,
      text,
      messageId: event.message.id,
      messageDate,
    });
  } catch (error) {
    logger.error({ error, userId: internalUserId }, "Error processing rental message");
  }
}
