import { useState, useEffect, useCallback } from "react";
import type { RentalResponse, PaginatedResponse } from "@majestic/shared";
import { apiFetch } from "../api/client.js";
import RentalCard from "../components/RentalCard.js";
import FilterBar from "../components/FilterBar.js";

export default function RentalHistory() {
  const [rentals, setRentals] = useState<RentalResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [period, setPeriod] = useState("month");

  const getDateRange = useCallback((p: string) => {
    const now = new Date();
    let from = "";
    switch (p) {
      case "week":
        from = new Date(now.getTime() - 7 * 86400000).toISOString();
        break;
      case "month":
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        break;
      case "year":
        from = new Date(now.getFullYear(), 0, 1).toISOString();
        break;
    }
    return { from };
  }, []);

  const loadRentals = useCallback(
    async (pageNum: number, reset = false) => {
      setLoading(true);
      try {
        const { from } = getDateRange(period);
        const data = await apiFetch<PaginatedResponse<RentalResponse>>(
          "/api/rentals",
          {
            page: String(pageNum),
            limit: "20",
            ...(from && { from }),
          },
        );
        setRentals((prev) => (reset ? data.items : [...prev, ...data.items]));
        setHasMore(pageNum < data.pages);
      } catch {
        // Ignore errors for now
      } finally {
        setLoading(false);
      }
    },
    [period, getDateRange],
  );

  useEffect(() => {
    setPage(1);
    loadRentals(1, true);
  }, [period, loadRentals]);

  const loadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadRentals(nextPage);
    }
  };

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">История аренд</h1>

      <FilterBar period={period} onPeriodChange={setPeriod} />

      <div className="space-y-2">
        {rentals.map((rental) => (
          <RentalCard key={rental.id} rental={rental} />
        ))}
      </div>

      {loading && (
        <div className="text-center py-4 text-[var(--tg-theme-hint-color)] text-sm">
          Загрузка...
        </div>
      )}

      {!loading && rentals.length === 0 && (
        <div className="text-center py-8 text-[var(--tg-theme-hint-color)] text-sm">
          Нет аренд за выбранный период
        </div>
      )}

      {hasMore && !loading && (
        <button
          onClick={loadMore}
          className="w-full py-2 text-sm text-[var(--tg-theme-button-color)] font-medium"
        >
          Загрузить ещё
        </button>
      )}
    </div>
  );
}
