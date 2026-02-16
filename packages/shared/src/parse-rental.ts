import type { ParsedRental } from "./types.js";

const RENTAL_TRIGGER = "Транспорт сдан в аренду!";

const FIELD_PATTERNS = {
  server: /Сервер:\s*(.+)/,
  character: /Персонаж:\s*(.+?)\s*#(\d+)/,
  vehicle: /Транспорт:\s*(.+)/,
  plateNumber: /Номер транспорта:\s*(.+)/,
  price: /Цена:\s*\$?([\d\s]+)/,
  duration: /Длительность:\s*(\d+)\s*(часов|часа|час|дней|дня|день)/,
  renter: /Арендатор:\s*(.+)/,
};

export function isRentalMessage(text: string): boolean {
  return text.includes(RENTAL_TRIGGER);
}

export function parseRentalMessage(text: string): ParsedRental | null {
  if (!isRentalMessage(text)) return null;

  const server = text.match(FIELD_PATTERNS.server)?.[1]?.trim();
  const charMatch = text.match(FIELD_PATTERNS.character);
  const vehicle = text.match(FIELD_PATTERNS.vehicle)?.[1]?.trim();
  const plate = text.match(FIELD_PATTERNS.plateNumber)?.[1]?.trim();
  const priceMatch = text.match(FIELD_PATTERNS.price);
  const durationMatch = text.match(FIELD_PATTERNS.duration);
  const renter = text.match(FIELD_PATTERNS.renter)?.[1]?.trim();

  if (!server || !vehicle || !plate || !priceMatch || !durationMatch) {
    return null;
  }

  const price = parseInt(priceMatch[1].replace(/\s/g, ""), 10);
  const durationValue = parseInt(durationMatch[1], 10);
  const durationUnit = durationMatch[2];
  const durationHours = durationUnit.startsWith("д")
    ? durationValue * 24
    : durationValue;

  return {
    server,
    characterName: charMatch?.[1]?.trim() ?? "",
    characterId: charMatch?.[2]?.trim() ?? "",
    vehicleName: vehicle,
    plateNumber: plate,
    price,
    durationHours,
    renterName: renter ?? "",
  };
}
