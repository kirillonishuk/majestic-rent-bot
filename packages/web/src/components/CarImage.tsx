import { getCarImageUrl } from "../utils/format.js";

interface CarImageProps {
  slug: string | null;
  name: string;
  className?: string;
}

export default function CarImage({ slug, name, className = "" }: CarImageProps) {
  return (
    <img
      src={getCarImageUrl(slug)}
      alt={name}
      className={`object-cover ${className}`}
      onError={(e) => {
        (e.target as HTMLImageElement).src = getCarImageUrl(null);
      }}
    />
  );
}
