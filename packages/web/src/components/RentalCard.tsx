import { useNavigate } from "react-router-dom";
import type { RentalResponse } from "@majestic/shared";
import { formatPrice, formatDate, formatDuration, getCarImageUrl } from "../utils/format.js";

export default function RentalCard({ rental }: { rental: RentalResponse }) {
  const navigate = useNavigate();
  const isActive = new Date(rental.expiresAt) > new Date();

  return (
    <div
      onClick={() => navigate(`/vehicle/${rental.vehicleId}`)}
      className="flex gap-3 p-3 rounded-xl bg-[var(--tg-theme-bg-color)] cursor-pointer active:opacity-80 transition-opacity"
    >
      <img
        src={getCarImageUrl(rental.imageSlug)}
        alt={rental.vehicleName}
        className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).src = getCarImageUrl(null);
        }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate">{rental.vehicleName}</span>
          <span className="font-bold text-sm text-[var(--tg-theme-button-color)]">
            {formatPrice(rental.price)}
          </span>
        </div>

        <div className="text-xs text-[var(--tg-theme-hint-color)] mt-0.5">
          {rental.plateNumber ? `${rental.plateNumber} · ` : ""}{rental.server}
        </div>

        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-[var(--tg-theme-hint-color)]">
            {formatDuration(rental.durationHours)} · {rental.renterName}
          </span>
          {isActive && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              Активна
            </span>
          )}
        </div>

        <div className="text-[10px] text-[var(--tg-theme-hint-color)] mt-1">
          {formatDate(rental.rentedAt)}
        </div>
      </div>
    </div>
  );
}
