import vehiclesMap from "./vehicles-map.json" with { type: "json" };

// Build reverse lookup: "brand model" (lowercase) → vehicle id
const nameToId = new Map<string, string>();
for (const [id, info] of Object.entries(vehiclesMap)) {
  const fullName = `${info.brand} ${info.model}`.toLowerCase().trim();
  if (fullName) nameToId.set(fullName, id);
}

export function vehicleNameToImageSlug(vehicleName: string): string | null {
  // Strip tags like [RL], [DLC], etc.
  const withoutTag = vehicleName.replace(/^\[.*?\]\s*/, "").trim();
  const lower = withoutTag.toLowerCase();

  // 1. Exact match: "Brand Model"
  const exact = nameToId.get(lower);
  if (exact) return exact;

  // 2. Match by model name (last word or remaining after brand)
  const words = withoutTag.split(/\s+/);
  const model = words[words.length - 1].toLowerCase();
  for (const [id, info] of Object.entries(vehiclesMap)) {
    if (info.model.toLowerCase() === model) return id;
  }

  // 3. Match by full model name (all words except first = brand)
  if (words.length > 1) {
    const modelFull = words.slice(1).join(" ").toLowerCase();
    for (const [id, info] of Object.entries(vehiclesMap)) {
      if (info.model.toLowerCase() === modelFull) return id;
    }
  }

  // 4. Match by vehicle ID directly
  const normalized = withoutTag.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (vehiclesMap[normalized as keyof typeof vehiclesMap]) return normalized;

  // 5. Partial match: id starts with last word or vice versa
  for (const id of Object.keys(vehiclesMap)) {
    if (id.startsWith(model) || model.startsWith(id)) return id;
  }

  return null;
}

export { vehiclesMap };
