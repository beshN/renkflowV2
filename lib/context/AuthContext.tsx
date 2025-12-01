'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'worker';
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginAsAdmin: (password: string) => boolean;
  loginAsWorker: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_USER: User = {
  id: 'admin',
  name: 'Yönetici',
  email: 'admin@renkflow.com',
  role: 'admin',
  avatar: 'https://ui-avatars.com/api/?name=Yonetici&background=0D8ABC&color=fff',
};

const WORKER_USER: User = {
  id: 'worker',
  name: 'Fabrika Personeli',
  email: 'uretim@renkflow.com',
  role: 'worker',
  avatar: 'https://ui-avatars.com/api/?name=Uretim&background=10B981&color=fff',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Default Staff User
  const STAFF_USER: User = {
    id: 'staff',
    name: 'Personel',
    email: 'staff@renkflow.com',
    role: 'worker',
    avatar: 'https://ui-avatars.com/api/?name=Personel&background=10B981&color=fff',
  };

  useEffect(() => {
    // Check localStorage for persisted session
    const storedRole = localStorage.getItem('renkflow-role');
    
    if (storedRole === 'admin') {
      setUser(ADMIN_USER);
    } else {
      // Default to Staff if not explicitly admin
      setUser(STAFF_USER);
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginAsAdmin = (password: string): boolean => {
    if (password === '123') {
      setUser(ADMIN_USER);
      localStorage.setItem('renkflow-role', 'admin');
      return true;
    }
    return false;
  };

  // Removed loginAsWorker as it's now the default state

  const logout = () => {
    // "Logout" now means reverting to Staff mode
    setUser(STAFF_USER);
    localStorage.removeItem('renkflow-role');
    router.push('/orders'); // Redirect to main view
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginAsAdmin, loginAsWorker: () => {}, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
