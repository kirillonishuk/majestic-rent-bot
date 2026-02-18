import { useState } from "react";
import { getCarImageUrl } from "../utils/format.js";

interface CarImageProps {
  slug: string | null;
  name: string;
  className?: string;
}

export default function CarImage({ slug, name, className = "" }: CarImageProps) {
  const [error, setError] = useState(false);

  if (error || !slug) {
    return (
      <div className={`flex items-center justify-center bg-[var(--tg-theme-secondary-bg-color)] text-[var(--tg-theme-hint-color)] font-bold text-lg ${className}`}>
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={getCarImageUrl(slug)}
      alt={name}
      className={`object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
}
