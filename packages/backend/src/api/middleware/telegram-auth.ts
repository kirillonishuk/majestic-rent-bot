import { createHmac } from "node:crypto";
import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { config } from "../../config.js";
import { db } from "../../db/index.js";
import { users } from "../../db/schema.js";

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    telegramUser?: TelegramUser;
    dbUserId?: number;
  }
}

export async function telegramAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Static files and health check don't need auth
  if (request.url.startsWith("/cars/") || request.url === "/api/health") {
    return;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("tma ")) {
    reply.code(401).send({ error: "Missing authorization" });
    return;
  }

  const initData = authHeader.slice(4);
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    reply.code(401).send({ error: "Invalid initData" });
    return;
  }

  params.delete("hash");
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(config.botToken)
    .digest();
  const calculatedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (calculatedHash !== hash) {
    reply.code(401).send({ error: "Invalid hash" });
    return;
  }

  const userParam = params.get("user");
  if (!userParam) {
    reply.code(401).send({ error: "Missing user data" });
    return;
  }

  const telegramUser: TelegramUser = JSON.parse(userParam);
  request.telegramUser = telegramUser;

  const user = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramUser.id))
    .get();

  if (user) {
    request.dbUserId = user.id;
  }
}
