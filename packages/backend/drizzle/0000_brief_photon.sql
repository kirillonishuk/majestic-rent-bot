CREATE TABLE `notification_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rental_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`sent_at` text DEFAULT (datetime('now')) NOT NULL,
	`success` integer DEFAULT true NOT NULL,
	`error_message` text,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`server` text NOT NULL,
	`character_name` text,
	`character_id` text,
	`price` integer NOT NULL,
	`duration_hours` real NOT NULL,
	`renter_name` text,
	`rented_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`notification_sent` integer DEFAULT false NOT NULL,
	`telegram_message_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rentals_user_id_idx` ON `rentals` (`user_id`);--> statement-breakpoint
CREATE INDEX `rentals_vehicle_id_idx` ON `rentals` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `rentals_expires_at_idx` ON `rentals` (`expires_at`);--> statement-breakpoint
CREATE INDEX `rentals_rented_at_idx` ON `rentals` (`rented_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `rentals_user_msg_idx` ON `rentals` (`user_id`,`telegram_message_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`telegram_id` integer NOT NULL,
	`telegram_username` text,
	`telegram_first_name` text,
	`mtproto_session` text,
	`is_connected` integer DEFAULT false NOT NULL,
	`default_server` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_id_unique` ON `users` (`telegram_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_telegram_id_idx` ON `users` (`telegram_id`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`plate_number` text NOT NULL,
	`image_slug` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_user_plate_idx` ON `vehicles` (`user_id`,`plate_number`);--> statement-breakpoint
CREATE INDEX `vehicles_user_id_idx` ON `vehicles` (`user_id`);