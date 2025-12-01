'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useLocalStorage } from '@/lib/hooks/useLocalStorage';
import { CompanySettings } from '@/lib/types';

interface SettingsContextType {
  settings: CompanySettings;
  updateSettings: (newSettings: CompanySettings) => void;
}

const defaultSettings: CompanySettings = {
  companyName: 'RenkFlow Mobilya',
  taxNumber: '1234567890',
  address: 'İstanbul, Türkiye',
  phone: '+90 555 123 45 67',
  email: 'info@renkflow.com',
  currency: '₺',
  language: 'tr',
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useLocalStorage<CompanySettings>('company_settings', defaultSettings);

  const updateSettings = (newSettings: CompanySettings) => {
    setSettings(newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
