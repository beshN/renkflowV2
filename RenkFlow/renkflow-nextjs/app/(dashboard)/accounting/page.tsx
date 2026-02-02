'use client';

import { useState } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { AccountingDashboard } from '@/components/accounting/AccountingDashboard';
import { 
  BarChart3, 
  PieChart, 
  FileText, 
  Calculator,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TabType = 'overview' | 'profit-loss' | 'balance-sheet' | 'cash-flow' | 'taxes';

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 7); // YYYY-MM format
  });

  const tabs = [
    { id: 'overview' as TabType, label: 'Genel Bakış', icon: BarChart3 },
    { id: 'profit-loss' as TabType, label: 'Kâr-Zarar', icon: TrendingUp },
    { id: 'balance-sheet' as TabType, label: 'Bilanço', icon: PieChart },
    { id: 'cash-flow' as TabType, label: 'Nakit Akışı', icon: Calendar },
    { id: 'taxes' as TabType, label: 'Vergiler', icon: Calculator },
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

        {/* Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <AccountingDashboard period={selectedPeriod} />
          )}
          
          {activeTab === 'profit-loss' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Detaylı Kâr-Zarar Tablosu
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selectedPeriod} dönemi
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-center py-8">
                Detaylı kâr-zarar raporu burada görüntülenecek...
              </p>
            </div>
          )}
          
          {activeTab === 'balance-sheet' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Detaylı Bilanço
                  </h2>
                  <p className="text-sm text-slate-500">
                    Varlıklar, borçlar ve öz sermaye
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-center py-8">
                Detaylı bilanço raporu burada görüntülenecek...
              </p>
            </div>
          )}
          
          {activeTab === 'cash-flow' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Nakit Akış Tablosu
                  </h2>
                  <p className="text-sm text-slate-500">
                    İşletme, yatırım ve finansman faaliyetleri
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-center py-8">
                Nakit akış raporu burada görüntülenecek...
              </p>
            </div>
          )}
          
          {activeTab === 'taxes' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Vergi Yönetimi
                  </h2>
                  <p className="text-sm text-slate-500">
                    KDV, stopaj ve beyanname takibi
                  </p>
                </div>
              </div>
              <p className="text-slate-500 text-center py-8">
                    Vergi yönetimi paneli burada görüntülenecek...
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
