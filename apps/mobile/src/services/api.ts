import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants';
import { AuthResponse, APIResponse, Order, NewOrderData, User } from '../types';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// Token management
export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getStoredUser(): Promise<User | null> {
  const userData = await SecureStore.getItemAsync(USER_KEY);
  return userData ? JSON.parse(userData) : null;
}

export async function setStoredUser(user: User): Promise<void> {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function removeStoredUser(): Promise<void> {
  await SecureStore.deleteItemAsync(USER_KEY);
}

// API request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  const token = await getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    return { success: false, error: 'Bağlantı hatası' };
  }
}

// Auth API
export async function login(email: string, password: string): Promise<APIResponse<AuthResponse>> {
  const response = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  if (response.success && response.data) {
    await setToken(response.data.accessToken);
    await setStoredUser(response.data.user);
  }
  
  return response;
}

export async function logout(): Promise<void> {
  await removeToken();
  await removeStoredUser();
}

export async function getCurrentUser(): Promise<APIResponse<User>> {
  return apiRequest<User>('/auth/me');
}

// Orders API
export async function getOrders(): Promise<APIResponse<Order[]>> {
  return apiRequest<Order[]>('/orders');
}

export async function getOrderById(id: string): Promise<APIResponse<Order>> {
  return apiRequest<Order>(`/orders/${id}`);
}

export async function createOrder(data: NewOrderData): Promise<APIResponse<Order>> {
  return apiRequest<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOrder(id: string, updates: Partial<Order>): Promise<APIResponse<Order>> {
  return apiRequest<Order>(`/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function updateOrderStatus(
  id: string, 
  status: Order['status']
): Promise<APIResponse<Order>> {
  return apiRequest<Order>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteOrder(id: string): Promise<APIResponse<{ id: string }>> {
  return apiRequest<{ id: string }>(`/orders/${id}`, {
    method: 'DELETE',
  });
}
