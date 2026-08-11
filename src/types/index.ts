// --- SHARED DOMAIN TYPES (mirror the SQLite schema in src-tauri/migrations) ---

export type Role = "admin" | "user";

export interface Shop {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppUser {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

export type PartCategory = "Engine" | "Brakes" | "Electrical" | "Accessories";

export interface Part {
  id: string;
  shopId: string;
  partName: string;
  partNumber: string;
  category: PartCategory;
  stock: number;
  minThreshold: number;
  costPrice: number;
  sellingPrice: number;
  updatedAt: string;
}

export type MotorcycleCategory = "Sport" | "Scooter" | "Naked" | "Off-Road";

export interface Motorcycle {
  id: string;
  shopId: string;
  modelName: string;
  vin: string;
  displacement: string;
  category: MotorcycleCategory;
  price: number;
  cost: number;
  stock: number;
  updatedAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  partId: string;
  partName: string;
  partNumber: string;
  qty: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  shopId: string;
  userId: string | null;
  customerName: string | null;
  total: number;
  createdAt: string;
  items: SaleItem[];
}

export type RepairJobStatus = "open" | "in_progress" | "completed";

export interface RepairJobPart {
  id: string;
  jobId: string;
  partId: string;
  partName: string;
  partNumber: string;
  qty: number;
  unitPrice: number;
}

export interface RepairJob {
  id: string;
  shopId: string;
  userId: string | null;
  customerName: string;
  customerPhone: string | null;
  motorcycleDesc: string | null;
  status: RepairJobStatus;
  laborFee: number;
  notes: string | null;
  total: number;
  createdAt: string;
  completedAt: string | null;
  parts: RepairJobPart[];
}

export interface StockReceipt {
  id: string;
  shopId: string;
  partId: string;
  userId: string | null;
  qty: number;
  unitCost: number;
  supplier: string | null;
  reference: string | null;
  createdAt: string;
}

export const NAV_MODULES = [
  "dashboard",
  "inventory",
  "pos",
  "repairs",
  "labels",
  "admin",
] as const;

export type NavModule = (typeof NAV_MODULES)[number];
