import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RentalStatsResponse } from "@majestic/shared";
import { apiFetch } from "../api/client.js";
import { formatPrice } from "../utils/format.js";
import FilterBar from "../components/FilterBar.js";

export default function Statistics() {
  const [stats, setStats] = useState<RentalStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    setLoading(true);
    apiFetch<RentalStatsResponse>("/api/rentals/stats", { period })
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="text-center py-8 text-[var(--tg-theme-hint-color)] text-sm">
        Загрузка...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-[var(--tg-theme-hint-color)] text-sm">
        Нет данных
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Статистика</h1>

      <FilterBar period={period} onPeriodChange={setPeriod} />

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)]">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Доход
          </div>
          <div className="text-lg font-bold text-[var(--tg-theme-button-color)]">
            {formatPrice(stats.totalRevenue)}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)]">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Аренд
          </div>
          <div className="text-lg font-bold">{stats.totalRentals}</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)]">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Средняя цена
          </div>
          <div className="text-lg font-bold">{formatPrice(stats.averagePrice)}</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)]">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Топ транспорт
          </div>
          <div className="text-sm font-bold truncate">
            {stats.mostRentedVehicle?.name ?? "—"}
          </div>
        </div>
      </div>

      {/* Revenue chart */}
      {stats.chartData.length > 0 && (
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)]">
          <div className="text-xs font-semibold mb-2">Доход по дням</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats.chartData}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "short",
                  })
                }
              />
              <YAxis tick={{ fontSize: 10 }} width={50} />
              <Tooltip
                formatter={(value: number) => [formatPrice(value), "Доход"]}
                labelFormatter={(label) =>
                  new Date(label).toLocaleDateString("ru-RU")
                }
              />
              <Bar dataKey="revenue" fill="var(--tg-theme-button-color)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By vehicle */}
      {stats.byVehicle.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold">По транспорту</div>
          {stats.byVehicle.map((v) => (
            <div
              key={v.vehicleId}
              className="flex items-center justify-between p-3 rounded-xl bg-[var(--tg-theme-bg-color)]"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{v.name}</div>
                <div className="text-xs text-[var(--tg-theme-hint-color)]">
                  {v.plateNumber} · {v.count} аренд
                </div>
              </div>
              <div className="text-sm font-bold text-[var(--tg-theme-button-color)] ml-2">
                {formatPrice(v.revenue)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
