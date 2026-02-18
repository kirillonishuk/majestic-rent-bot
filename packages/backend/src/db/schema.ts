import { sql } from "drizzle-orm";
import { integer, real, text, index, uniqueIndex, sqliteTable } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    telegramId: integer("telegram_id").notNull().unique(),
    telegramUsername: text("telegram_username"),
    telegramFirstName: text("telegram_first_name"),
    mtprotoSession: text("mtproto_session"),
    isConnected: integer("is_connected", { mode: "boolean" }).notNull().default(false),
    defaultServer: text("default_server"),
    lastScannedMessageId: integer("last_scanned_message_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("users_telegram_id_idx").on(table.telegramId),
  ],
);

export const vehicles = sqliteTable(
  "vehicles",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    plateNumber: text("plate_number"),
    imageSlug: text("image_slug"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("vehicles_user_name_idx").on(table.userId, table.name),
    index("vehicles_user_id_idx").on(table.userId),
  ],
);

export const rentals = sqliteTable(
  "rentals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vehicleId: integer("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    server: text("server").notNull(),
    characterName: text("character_name"),
    characterId: text("character_id"),
    price: integer("price").notNull(),
    durationHours: real("duration_hours").notNull(),
    renterName: text("renter_name"),
    rentedAt: text("rented_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    notificationSent: integer("notification_sent", { mode: "boolean" }).notNull().default(false),
    telegramMessageId: integer("telegram_message_id"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index("rentals_user_id_idx").on(table.userId),
    index("rentals_vehicle_id_idx").on(table.vehicleId),
    index("rentals_expires_at_idx").on(table.expiresAt),
    index("rentals_rented_at_idx").on(table.rentedAt),
    uniqueIndex("rentals_user_msg_idx").on(table.userId, table.telegramMessageId),
  ],
);

export const notificationLog = sqliteTable("notification_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rentalId: integer("rental_id")
    .notNull()
    .references(() => rentals.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sentAt: text("sent_at").notNull().default(sql`(datetime('now'))`),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  errorMessage: text("error_message"),
});
