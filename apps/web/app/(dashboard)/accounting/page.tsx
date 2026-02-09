'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { AccountingDashboard, type AccountingTab } from '@/components/accounting/AccountingDashboard';
import { 
  BarChart3, 
  PieChart, 
  Calculator,
  TrendingUp,
  Calendar,
  Scale,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<AccountingTab>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 7); // YYYY-MM format
  });

  const tabs = [
    { id: 'overview' as AccountingTab, label: 'Genel Bakış', icon: BarChart3 },
    { id: 'profit-loss' as AccountingTab, label: 'Kâr-Zarar', icon: TrendingUp },
    { id: 'balance-sheet' as AccountingTab, label: 'Bilanço', icon: PieChart },
    { id: 'cash-flow' as AccountingTab, label: 'Nakit Akışı', icon: Calendar },
    { id: 'taxes' as AccountingTab, label: 'Vergiler', icon: Calculator },
    { id: 'control-tower' as AccountingTab, label: 'Kontrol', icon: ShieldCheck },
    { id: 'benchmark' as AccountingTab, label: 'Kıyas', icon: Scale },
  ];

  return (
    <div className="flex-1 flex flex-col">
      <Navbar title="Muhasebe & Finans" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 pt-16 md:pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Muhasebe Yönetimi
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Finansal raporlar, vergi yönetimi ve hesap planı
            </p>
          </div>
          
          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-500">Dönem:</label>
            <input
              type="month"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                    : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          <AccountingDashboard period={selectedPeriod} activeTab={activeTab} />
        </div>
      </main>
    </div>
  );
}
