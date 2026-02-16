import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { config } from "../config.js";
import { telegramAuthMiddleware } from "./middleware/telegram-auth.js";
import { rentalsRoutes } from "./routes/rentals.js";
import { vehiclesRoutes } from "./routes/vehicles.js";
import { logger } from "../utils/logger.js";

export async function createApi() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  await app.register(fastifyStatic, {
    root: resolve(process.cwd(), "cars"),
    prefix: "/cars/",
    decorateReply: false,
  });

  app.addHook("onRequest", telegramAuthMiddleware);

  await app.register(rentalsRoutes);
  await app.register(vehiclesRoutes);

  app.get("/api/health", async () => ({ status: "ok" }));

  await app.listen({ port: config.apiPort, host: "0.0.0.0" });
  logger.info({ port: config.apiPort }, "API server started");

  return app;
}
