import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { decrypt } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";
import { UserbotClient } from "./userbot-client.js";
import { handleIncomingMessage } from "./message-parser.js";
import { historyScanner } from "./history-scanner.js";

class UserbotManager {
  private clients = new Map<number, UserbotClient>();

  async initialize(): Promise<void> {
    const connectedUsers = await db
      .select()
      .from(users)
      .where(eq(users.isConnected, true))
      .all();

    logger.info({ count: connectedUsers.length }, "Restoring userbot sessions");

    for (const user of connectedUsers) {
      if (!user.mtprotoSession) continue;

      try {
        const session = decrypt(user.mtprotoSession);
        await this.addClient(user.id, session);
      } catch (error) {
        logger.error(
          { userId: user.id, error },
          "Failed to restore userbot session",
        );
        await db
          .update(users)
          .set({ isConnected: false })
          .where(eq(users.id, user.id));
      }
    }
  }

  async addClient(userId: number, sessionString: string): Promise<void> {
    if (this.clients.has(userId)) {
      await this.removeClient(userId);
    }

    const client = new UserbotClient(userId, sessionString, handleIncomingMessage);
    await client.connect();
    this.clients.set(userId, client);

    // Trigger background scan for missed messages
    historyScanner.scanUser(userId).catch((error) => {
      logger.error({ userId, error }, "Auto-scan after connect failed");
    });
  }

  addExistingClient(userId: number, client: UserbotClient): void {
    this.clients.set(userId, client);
  }

  async removeClient(userId: number): Promise<void> {
    const client = this.clients.get(userId);
    if (client) {
      await client.disconnect();
      this.clients.delete(userId);
    }
  }

  getClient(userId: number): UserbotClient | undefined {
    return this.clients.get(userId);
  }

  isConnected(userId: number): boolean {
    return this.clients.get(userId)?.isConnected() ?? false;
  }

  async disconnectAll(): Promise<void> {
    for (const [userId, client] of this.clients) {
      try {
        await client.disconnect();
      } catch (error) {
        logger.error({ userId, error }, "Error disconnecting client");
      }
    }
    this.clients.clear();
  }
}

export const userbotManager = new UserbotManager();
