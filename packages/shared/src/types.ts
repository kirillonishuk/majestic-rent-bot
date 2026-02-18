export interface ParsedRental {
  server: string;
  characterName: string;
  characterId: string;
  vehicleName: string;
  plateNumber: string | null;
  price: number;
  durationHours: number;
  renterName: string;
}

export interface RentalResponse {
  id: number;
  vehicleId: number;
  vehicleName: string;
  plateNumber: string | null;
  imageSlug: string | null;
  server: string;
  price: number;
  durationHours: number;
  renterName: string;
  rentedAt: string;
  expiresAt: string;
}

export interface VehicleResponse {
  id: number;
  name: string;
  plateNumber: string | null;
  imageSlug: string | null;
  rentalCount: number;
  totalRevenue: number;
}

export interface RentalStatsResponse {
  totalRevenue: number;
  totalRentals: number;
  averagePrice: number;
  mostRentedVehicle: { id: number; name: string; count: number } | null;
  chartData: { date: string; revenue: number; count: number }[];
  byVehicle: {
    vehicleId: number;
    name: string;
    plateNumber: string | null;
    count: number;
    revenue: number;
  }[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}
