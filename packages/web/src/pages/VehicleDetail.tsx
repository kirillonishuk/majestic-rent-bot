import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client.js";
import CarImage from "../components/CarImage.js";
import { formatPrice, formatDate, formatDuration } from "../utils/format.js";

interface VehicleData {
  vehicle: {
    id: number;
    name: string;
    plateNumber: string | null;
    imageSlug: string | null;
  };
  rentals: {
    id: number;
    server: string;
    price: number;
    durationHours: number;
    renterName: string;
    rentedAt: string;
    expiresAt: string;
  }[];
}

export default function VehicleDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.BackButton.show();
    const handleBack = () => navigate(-1);
    tg?.BackButton.onClick(handleBack);
    return () => {
      tg?.BackButton.offClick(handleBack);
      tg?.BackButton.hide();
    };
  }, [navigate]);

  useEffect(() => {
    apiFetch<VehicleData>(`/api/vehicles/${id}`)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="text-center py-8 text-[var(--tg-theme-hint-color)] text-sm">
        Загрузка...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-[var(--tg-theme-hint-color)] text-sm">
        Транспорт не найден
      </div>
    );
  }

  const { vehicle, rentals } = data;
  const totalRevenue = rentals.reduce((sum, r) => sum + r.price, 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl overflow-hidden bg-[var(--tg-theme-bg-color)]">
        <CarImage
          slug={vehicle.imageSlug}
          name={vehicle.name}
          className="w-full h-48 rounded-t-xl"
        />
        <div className="p-3">
          <h1 className="text-lg font-bold">{vehicle.name}</h1>
          {vehicle.plateNumber && (
            <div className="text-sm text-[var(--tg-theme-hint-color)]">
              {vehicle.plateNumber}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)] text-center">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Доход
          </div>
          <div className="text-sm font-bold text-[var(--tg-theme-button-color)]">
            {formatPrice(totalRevenue)}
          </div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)] text-center">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Аренд
          </div>
          <div className="text-sm font-bold">{rentals.length}</div>
        </div>
        <div className="p-3 rounded-xl bg-[var(--tg-theme-bg-color)] text-center">
          <div className="text-[10px] text-[var(--tg-theme-hint-color)] uppercase">
            Средняя
          </div>
          <div className="text-sm font-bold">
            {rentals.length > 0
              ? formatPrice(Math.round(totalRevenue / rentals.length))
              : "—"}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold">История аренд</div>
        {rentals.map((rental) => (
          <div
            key={rental.id}
            className="flex items-center justify-between p-3 rounded-xl bg-[var(--tg-theme-bg-color)]"
          >
            <div>
              <div className="text-sm font-medium">{rental.renterName}</div>
              <div className="text-xs text-[var(--tg-theme-hint-color)]">
                {formatDate(rental.rentedAt)} · {formatDuration(rental.durationHours)}
              </div>
            </div>
            <div className="text-sm font-bold text-[var(--tg-theme-button-color)]">
              {formatPrice(rental.price)}
            </div>
          </div>
        ))}

        {rentals.length === 0 && (
          <div className="text-center py-4 text-[var(--tg-theme-hint-color)] text-sm">
            Нет аренд
          </div>
        )}
      </div>
    </div>
  );
}
