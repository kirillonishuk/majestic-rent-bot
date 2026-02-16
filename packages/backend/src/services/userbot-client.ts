import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { NewMessage, type NewMessageEvent } from "telegram/events/index.js";
import type { EntityLike } from "telegram/define.js";
import type { IterMessagesParams } from "telegram/client/messages.js";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export class UserbotClient {
  private client: TelegramClient;
  private connected = false;

  constructor(
    private userId: number,
    sessionString: string,
    private onMessage: (userId: number, event: NewMessageEvent) => void,
  ) {
    this.client = new TelegramClient(
      new StringSession(sessionString),
      config.telegramApiId,
      config.telegramApiHash,
      { connectionRetries: 5 },
    );
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;

      this.client.addEventHandler(
        (event: NewMessageEvent) => {
          this.onMessage(this.userId, event);
        },
        new NewMessage({
          fromUsers: [config.majesticBotUsername],
        }),
      );

      logger.info({ userId: this.userId }, "Userbot connected");
    } catch (error) {
      this.connected = false;
      logger.error({ userId: this.userId, error }, "Failed to connect userbot");
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      logger.error({ userId: this.userId, error }, "Error disconnecting userbot");
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  iterMessages(
    entity: EntityLike,
    params: Partial<IterMessagesParams>,
  ): ReturnType<TelegramClient["iterMessages"]> {
    return this.client.iterMessages(entity, params);
  }

  static fromExistingClient(
    userId: number,
    client: TelegramClient,
    onMessage: (userId: number, event: NewMessageEvent) => void,
  ): UserbotClient {
    const instance = Object.create(UserbotClient.prototype) as UserbotClient;
    instance.client = client;
    instance.userId = userId;
    instance.onMessage = onMessage;
    instance.connected = true;

    client.addEventHandler(
      (event: NewMessageEvent) => {
        onMessage(userId, event);
      },
      new NewMessage({
        fromUsers: [config.majesticBotUsername],
      }),
    );

    return instance;
  }
}
