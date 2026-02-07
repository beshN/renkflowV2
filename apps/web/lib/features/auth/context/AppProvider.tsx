'use client';

import React, { createContext, useContext, useMemo, useCallback, useReducer, ReactNode } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { Session } from 'next-auth';

/**
 * Atomic Context Architecture
 * - Single unified provider for all app state
 * - Memoized values and callbacks to prevent unnecessary re-renders
 * - Reducers for predictable state updates
 */

// ============================================
// Types
// ============================================

interface User {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  role?: string;
  tenantId?: string;
  brandColor?: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  toasts: Toast[];
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'ADD_TOAST'; payload: Toast }
  | { type: 'REMOVE_TOAST'; payload: string }
  | { type: 'CLEAR_TOASTS' }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' };

interface AppContextValue extends AppState {
  // Auth actions
  refreshUser: () => Promise<void>;
  
  // Toast actions
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  hideToast: (id: string) => void;
  clearToasts: () => void;
  
  // UI actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// ============================================
// Initial State & Reducer
// ============================================

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  toasts: [],
  sidebarOpen: true,
  theme: 'system',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: action.payload !== null,
        isLoading: false,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload) };
    case 'CLEAR_TOASTS':
      return { ...state, toasts: [] };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_SIDEBAR':
      return { ...state, sidebarOpen: action.payload };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}

// ============================================
// Context
// ============================================

const AppContext = createContext<AppContextValue | undefined>(undefined);

// ============================================
// Internal Provider (with session access)
// ============================================

function AppProviderInternal({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Sync session with state
  React.useEffect(() => {
    if (status === 'loading') {
      dispatch({ type: 'SET_LOADING', payload: true });
      return;
    }

    if (session?.user) {
      const user: User = {
        id: (session.user as any).id || '',
        name: session.user.name ?? null,
        email: session.user.email || '',
        image: session.user.image ?? null,
        role: (session.user as any).role ?? null,
        tenantId: (session.user as any).tenantId ?? null,
        brandColor: (session.user as any).brandColor ?? null,
      };
      dispatch({ type: 'SET_USER', payload: user });
    } else {
      dispatch({ type: 'SET_USER', payload: null });
    }
  }, [session, status]);

  // Load theme from localStorage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedTheme = localStorage.getItem('theme') as AppState['theme'] | null;
    if (savedTheme) {
      dispatch({ type: 'SET_THEME', payload: savedTheme });
    }
  }, []);

  // Apply theme
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (state.theme === 'dark' || (state.theme === 'system' && systemDark)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', state.theme);
  }, [state.theme]);

  // Memoized actions
  const refreshUser = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    await update();
  }, [update]);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 5000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type, duration } });

    if (duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE_TOAST', payload: id });
      }, duration);
    }
  }, []);

  const hideToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: id });
  }, []);

  const clearToasts = useCallback(() => {
    dispatch({ type: 'CLEAR_TOASTS' });
  }, []);

  const toggleSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_SIDEBAR' });
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_SIDEBAR', payload: open });
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  // Memoized context value
  const contextValue = useMemo<AppContextValue>(
    () => ({
      ...state,
      refreshUser,
      showToast,
      hideToast,
      clearToasts,
      toggleSidebar,
      setSidebarOpen,
      setTheme,
    }),
    [state, refreshUser, showToast, hideToast, clearToasts, toggleSidebar, setSidebarOpen, setTheme]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
      <ToastContainer toasts={state.toasts} onDismiss={hideToast} />
    </AppContext.Provider>
  );
}

// ============================================
// Toast Container Component
// ============================================

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right
            ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
            ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
            ${toast.type === 'warning' ? 'bg-yellow-500 text-white' : ''}
            ${toast.type === 'info' ? 'bg-blue-500 text-white' : ''}
          `}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 hover:bg-white/20 rounded"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================
// Main Provider Export
// ============================================

interface AppProviderProps {
  children: ReactNode;
  session?: Session | null;
}

export function AppProvider({ children, session }: AppProviderProps) {
  return (
    <SessionProvider session={session}>
      <AppProviderInternal>{children}</AppProviderInternal>
    </SessionProvider>
  );
}

// ============================================
// Hook Exports
// ============================================

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function useAuth() {
  const { user, isAuthenticated, isLoading, refreshUser } = useApp();
  return { user, isAuthenticated, isLoading, refreshUser };
}

export function useToast() {
  const { showToast, hideToast, clearToasts, toasts } = useApp();
  return { showToast, hideToast, clearToasts, toasts };
}

export function useUI() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen, theme, setTheme } = useApp();
  return { sidebarOpen, toggleSidebar, setSidebarOpen, theme, setTheme };
}
