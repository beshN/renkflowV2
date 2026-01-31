// Type Definitions for RenkFlow

export type OrderStatus = 'pending' | 'in_production' | 'delivered';
export type ViewMode = 'list' | 'table' | 'calendar';

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  email?: string;
  phone?: string;
  date: string;
  deliveryDate?: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
  productName?: string;
  quantity?: number;
  documents?: Document[];
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  [key: string]: unknown;
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
  email?: string;
  phone?: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  deliveryDate?: string;
  notes?: string;
  documents?: Document[];
}
