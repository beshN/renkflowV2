// Type Definitions for RenkFlow

export type OrderStatus = 'pending' | 'in_production' | 'delivered';
export type ViewMode = 'list' | 'table' | 'calendar';

export interface Order {
  id: string;
  customer: string;
  email?: string;
  phone?: string;
  date: string;
  deliveryDate?: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  description?: string;
  product?: string;
  quantity?: number;
  documents?: Document[];
}

export interface Document {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface StatsCardData {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: string;
}

export interface MenuItem {
  icon: string;
  label: string;
  href: string;
}

export interface ProductionStage {
  id: string;
  name: string;
  orders: Order[];
  color: string;
}

export interface CompanySettings {
  companyName: string;
  taxNumber: string;
  address: string;
  phone: string;
  email: string;
  currency: string;
  language: string;
}

export interface NewOrderFormData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  deliveryDate: string;
  notes?: string;
  documents: Document[];
}
