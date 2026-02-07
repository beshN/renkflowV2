// ============================================
// 1. STATE MANAGEMENT PATTERN
// Zustand + Context API Hybrid Approach
// ============================================

/**
 * @module store
 * @description Global state management using Zustand with middleware.
 * 
 * Features:
 * - **devtools**: Redux DevTools integration for debugging
 * - **persist**: LocalStorage persistence for UI preferences
 * - **subscribeWithSelector**: Efficient subscriptions with selectors
 * - **immer**: Immutable state updates with mutable syntax
 * 
 * @example
 * ```tsx
 * // In a component
 * import { useAppStore, useUser } from '@/lib/store';
 * 
 * function UserProfile() {
 *   const user = useUser();
 *   const { setTheme } = useAppStore();
 *   
 *   return <div>{user?.name}</div>;
 * }
 * ```
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============================================
// ZUSTAND STORE - Global Client State
// ============================================

/**
 * User entity representing authenticated user
 */
interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
}

/**
 * Notification item displayed in toast
 */
interface Notification {
  /** Unique identifier */
  id: string;
  /** Notification severity type */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Message to display */
  message: string;
  /** Unix timestamp when notification was created */
  timestamp: number;
}

interface UIState {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  locale: string;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // UI state
  ui: UIState;
  
  // Notifications
  notifications: Notification[];
  
  // Loading states
  isLoading: boolean;
  loadingMessage: string | null;
}

interface AppActions {
  // User actions
  setUser: (user: User | null) => void;
  logout: () => void;
  
  // UI actions
  toggleSidebar: () => void;
  setTheme: (theme: UIState['theme']) => void;
  setLocale: (locale: string) => void;
  
  // Notification actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Loading actions
  setLoading: (isLoading: boolean, message?: string) => void;
  
  // Reset
  reset: () => void;
}

type AppStore = AppState & AppActions;

// Initial state
const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  ui: {
    sidebarOpen: true,
    theme: 'system',
    locale: 'tr',
  },
  notifications: [],
  isLoading: false,
  loadingMessage: null,
};

/**
 * Main application store with middleware stack.
 * 
 * Middleware order matters:
 * 1. devtools - Wraps everything for DevTools
 * 2. subscribeWithSelector - Enables efficient subscriptions
 * 3. persist - Handles localStorage persistence
 * 4. immer - Enables mutable state updates
 */
export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((set, get) => ({
          ...initialState,
          
          // User actions
          setUser: (user) => set((state) => {
            state.user = user;
            state.isAuthenticated = !!user;
          }),
          
          logout: () => set((state) => {
            state.user = null;
            state.isAuthenticated = false;
          }),
          
          // UI actions
          toggleSidebar: () => set((state) => {
            state.ui.sidebarOpen = !state.ui.sidebarOpen;
          }),
          
          setTheme: (theme) => set((state) => {
            state.ui.theme = theme;
          }),
          
          setLocale: (locale) => set((state) => {
            state.ui.locale = locale;
          }),
          
          // Notification actions
          addNotification: (notification) => set((state) => {
            state.notifications.push({
              ...notification,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            });
          }),
          
          removeNotification: (id) => set((state) => {
            state.notifications = state.notifications.filter(n => n.id !== id);
          }),
          
          clearNotifications: () => set((state) => {
            state.notifications = [];
          }),
          
          // Loading actions
          setLoading: (isLoading, message) => set((state) => {
            state.isLoading = isLoading;
            state.loadingMessage = message ?? null;
          }),
          
          // Reset
          reset: () => set(initialState),
        })),
        {
          name: 'app-storage',
          partialize: (state) => ({
            ui: state.ui,
          }),
        }
      )
    ),
    { name: 'AppStore' }
  )
);

// ============================================
// SELECTOR HOOKS - Optimized Re-renders
// ============================================

/**
 * Get current authenticated user.
 * Returns null if not authenticated.
 * @returns Current user or null
 */
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useTheme = () => useAppStore((state) => state.ui.theme);
export const useSidebarOpen = () => useAppStore((state) => state.ui.sidebarOpen);
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useIsLoading = () => useAppStore((state) => state.isLoading);

// ============================================
// COMPUTED SELECTORS
// ============================================

export const useUserRole = () => useAppStore((state) => state.user?.role ?? 'guest');
export const useUnreadNotifications = () => useAppStore((state) => 
  state.notifications.filter(n => n.timestamp > Date.now() - 60000)
);

// ============================================
// ACTIONS HOOKS - Stable References
// ============================================

export const useAppActions = () => useAppStore((state) => ({
  setUser: state.setUser,
  logout: state.logout,
  toggleSidebar: state.toggleSidebar,
  setTheme: state.setTheme,
  addNotification: state.addNotification,
  removeNotification: state.removeNotification,
  setLoading: state.setLoading,
}));

// ============================================
// STORE SUBSCRIBERS - Side Effects
// ============================================

// Theme sync with document
if (typeof window !== 'undefined') {
  useAppStore.subscribe(
    (state) => state.ui.theme,
    (theme) => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');
      
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? 'dark' 
          : 'light';
        root.classList.add(systemTheme);
      } else {
        root.classList.add(theme);
      }
    }
  );
}

// ============================================
// DOMAIN-SPECIFIC STORES (Slice Pattern)
// ============================================

// Cart Store Example
interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      immer((set, get) => ({
        items: [],
        
        addItem: (item) => set((state) => {
          const existing = state.items.find(i => i.id === item.id);
          if (existing) {
            existing.quantity += 1;
          } else {
            state.items.push({ ...item, quantity: 1 });
          }
        }),
        
        removeItem: (id) => set((state) => {
          state.items = state.items.filter(i => i.id !== id);
        }),
        
        updateQuantity: (id, quantity) => set((state) => {
          const item = state.items.find(i => i.id === id);
          if (item) {
            item.quantity = Math.max(0, quantity);
          }
        }),
        
        clearCart: () => set((state) => {
          state.items = [];
        }),
        
        total: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      })),
      { name: 'cart-storage' }
    ),
    { name: 'CartStore' }
  )
);
