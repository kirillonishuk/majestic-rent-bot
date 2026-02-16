export function formatPrice(price: number): string {
  return `$${price.toLocaleString("ru-RU")}`;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(hours: number): string {
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remaining = hours % 24;
    return remaining > 0 ? `${days}д ${remaining}ч` : `${days}д`;
  }
  return `${hours}ч`;
}

export function getCarImageUrl(slug: string | null): string {
  if (slug) return `/cars/${slug}.png`;
  return `/cars/default.webp`;
}
