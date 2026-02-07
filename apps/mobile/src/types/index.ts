// Order types matching backend
export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in_production' | 'delivered';
  totalAmount: number;
  currency: string;
  deliveryDate?: string;
  notes?: string;
  documents?: Document[];
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'office' | 'worker' | 'member';
  tenantId: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface NewOrderData {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  productName: string;
  quantity: number;
  unitPrice?: number;
  deliveryDate?: string;
  notes?: string;
}
