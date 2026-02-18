PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`plate_number` text,
	`image_slug` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_vehicles`("id", "user_id", "name", "plate_number", "image_slug", "created_at") SELECT "id", "user_id", "name", "plate_number", "image_slug", "created_at" FROM `vehicles`;--> statement-breakpoint
DROP TABLE `vehicles`;--> statement-breakpoint
ALTER TABLE `__new_vehicles` RENAME TO `vehicles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `vehicles_user_name_idx` ON `vehicles` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `vehicles_user_id_idx` ON `vehicles` (`user_id`);