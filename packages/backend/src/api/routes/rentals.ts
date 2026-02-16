import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { rentals, vehicles } from "../../db/schema.js";

export async function rentalsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      from?: string;
      to?: string;
      vehicleId?: string;
      server?: string;
    };
  }>("/api/rentals", async (request, reply) => {
    const userId = request.dbUserId;
    if (!userId) return reply.code(401).send({ error: "User not found" });

    const page = Math.max(1, parseInt(request.query.page || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || "20", 10)));
    const offset = (page - 1) * limit;

    const conditions = [eq(rentals.userId, userId)];

    if (request.query.from) {
      conditions.push(gte(rentals.rentedAt, request.query.from));
    }
    if (request.query.to) {
      conditions.push(lte(rentals.rentedAt, request.query.to));
    }
    if (request.query.vehicleId) {
      conditions.push(eq(rentals.vehicleId, parseInt(request.query.vehicleId, 10)));
    }
    if (request.query.server) {
      conditions.push(eq(rentals.server, request.query.server));
    }

    const where = and(...conditions);

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: rentals.id,
          vehicleId: rentals.vehicleId,
          vehicleName: vehicles.name,
          plateNumber: vehicles.plateNumber,
          imageSlug: vehicles.imageSlug,
          server: rentals.server,
          price: rentals.price,
          durationHours: rentals.durationHours,
          renterName: rentals.renterName,
          rentedAt: rentals.rentedAt,
          expiresAt: rentals.expiresAt,
        })
        .from(rentals)
        .innerJoin(vehicles, eq(rentals.vehicleId, vehicles.id))
        .where(where)
        .orderBy(desc(rentals.rentedAt))
        .limit(limit)
        .offset(offset)
        .all(),
      db
        .select({ total: count() })
        .from(rentals)
        .where(where)
        .get(),
    ]);

    const total = totalResult?.total ?? 0;

    return {
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  });

  app.get<{
    Querystring: {
      period?: string;
      vehicleId?: string;
      server?: string;
    };
  }>("/api/rentals/stats", async (request, reply) => {
    const userId = request.dbUserId;
    if (!userId) return reply.code(401).send({ error: "User not found" });

    const period = request.query.period || "month";
    const now = new Date();
    let fromDate: Date;

    switch (period) {
      case "week":
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        fromDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        fromDate = new Date(0);
    }

    const conditions = [
      eq(rentals.userId, userId),
      gte(rentals.rentedAt, fromDate.toISOString()),
    ];

    if (request.query.vehicleId) {
      conditions.push(eq(rentals.vehicleId, parseInt(request.query.vehicleId, 10)));
    }
    if (request.query.server) {
      conditions.push(eq(rentals.server, request.query.server));
    }

    const where = and(...conditions);

    const totals = await db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${rentals.price}), 0)`,
        totalRentals: count(),
        averagePrice: sql<number>`coalesce(avg(${rentals.price}), 0)`,
      })
      .from(rentals)
      .where(where)
      .get();

    const byVehicle = await db
      .select({
        vehicleId: vehicles.id,
        name: vehicles.name,
        plateNumber: vehicles.plateNumber,
        count: count(),
        revenue: sql<number>`sum(${rentals.price})`,
      })
      .from(rentals)
      .innerJoin(vehicles, eq(rentals.vehicleId, vehicles.id))
      .where(where)
      .groupBy(vehicles.id)
      .orderBy(desc(sql`sum(${rentals.price})`))
      .all();

    const chartData = await db
      .select({
        date: sql<string>`date(${rentals.rentedAt})`,
        revenue: sql<number>`sum(${rentals.price})`,
        count: count(),
      })
      .from(rentals)
      .where(where)
      .groupBy(sql`date(${rentals.rentedAt})`)
      .orderBy(sql`date(${rentals.rentedAt})`)
      .all();

    const mostRented = byVehicle.length > 0
      ? { id: byVehicle[0].vehicleId, name: byVehicle[0].name, count: byVehicle[0].count }
      : null;

    return {
      totalRevenue: totals?.totalRevenue ?? 0,
      totalRentals: totals?.totalRentals ?? 0,
      averagePrice: Math.round(totals?.averagePrice ?? 0),
      mostRentedVehicle: mostRented,
      chartData,
      byVehicle,
    };
  });
}
