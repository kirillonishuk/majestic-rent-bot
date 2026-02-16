import type { FastifyInstance } from "fastify";
import { eq, desc, count, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { vehicles, rentals } from "../../db/schema.js";

export async function vehiclesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/vehicles", async (request, reply) => {
    const userId = request.dbUserId;
    if (!userId) return reply.code(401).send({ error: "User not found" });

    const items = await db
      .select({
        id: vehicles.id,
        name: vehicles.name,
        plateNumber: vehicles.plateNumber,
        imageSlug: vehicles.imageSlug,
        rentalCount: count(rentals.id),
        totalRevenue: sql<number>`coalesce(sum(${rentals.price}), 0)`,
      })
      .from(vehicles)
      .leftJoin(rentals, eq(vehicles.id, rentals.vehicleId))
      .where(eq(vehicles.userId, userId))
      .groupBy(vehicles.id)
      .orderBy(desc(sql`sum(${rentals.price})`))
      .all();

    return { items };
  });

  app.get<{ Params: { id: string } }>("/api/vehicles/:id", async (request, reply) => {
    const userId = request.dbUserId;
    if (!userId) return reply.code(401).send({ error: "User not found" });

    const vehicleId = parseInt(request.params.id, 10);

    const vehicle = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .get();

    if (!vehicle || vehicle.userId !== userId) {
      return reply.code(404).send({ error: "Vehicle not found" });
    }

    const vehicleRentals = await db
      .select({
        id: rentals.id,
        server: rentals.server,
        price: rentals.price,
        durationHours: rentals.durationHours,
        renterName: rentals.renterName,
        rentedAt: rentals.rentedAt,
        expiresAt: rentals.expiresAt,
      })
      .from(rentals)
      .where(eq(rentals.vehicleId, vehicleId))
      .orderBy(desc(rentals.rentedAt))
      .all();

    return { vehicle, rentals: vehicleRentals };
  });
}
