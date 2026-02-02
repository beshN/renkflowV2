'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart,
  BarChart3,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from 'lucide-react';
import { 
  getProfitLossReport, 
  getBalanceSheet, 
  getCashFlowReport,
  getTaxSummary 
} from '@/app/actions/accounting.actions';
import { 
  ProfitLossReport, 
  BalanceSheet, 
  CashFlowReport,
  TAX_TYPE_LABELS 
} from '@/lib/types/accounting';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/lib/context/ToastContext';

interface AccountingDashboardProps {
  period?: string;
}

export function AccountingDashboard({ period }: AccountingDashboardProps) {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [profitLoss, setProfitLoss] = useState<ProfitLossReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowReport | null>(null);
  const [taxSummary, setTaxSummary] = useState<{ vatPayable: number; vatReceivable: number; netVat: number; withholdingTax: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
      const currentPeriod = period || now.toISOString().slice(0, 7);

      const [pl, bs, cf, tax] = await Promise.all([
        getProfitLossReport(startOfMonth, endOfMonth),
        getBalanceSheet(),
        getCashFlowReport(startOfMonth, endOfMonth),
        getTaxSummary(currentPeriod),
      ]);

      setProfitLoss(pl);
      setBalanceSheet(bs);
      setCashFlow(cf);
      setTaxSummary(tax);
    } catch (error) {
      console.error('Error loading accounting data:', error);
      showToast('Muhasebe verileri yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <AccountingDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Net Kâr"
          value={profitLoss?.netProfit || 0}
          icon={<TrendingUp className="w-5 h-5" />}
          trend={12.5}
          color="green"
        />
        <SummaryCard
          title="Toplam Gelir"
          value={profitLoss?.revenue.netRevenue || 0}
          icon={<DollarSign className="w-5 h-5" />}
          trend={8.3}
          color="blue"
        />
        <SummaryCard
          title="İşletme Giderleri"
          value={profitLoss?.operatingExpenses.total || 0}
          icon={<TrendingDown className="w-5 h-5" />}
          trend={-5.2}
          color="red"
        />
        <SummaryCard
          title="Nakit Pozisyonu"
          value={balanceSheet?.assets.currentAssets.cash || 0}
          icon={<Wallet className="w-5 h-5" />}
          trend={3.1}
          color="purple"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit/Loss Breakdown */}
        {profitLoss && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                Kâr-Zarar Özeti
              </h3>
              <span className="text-sm text-slate-500">{profitLoss.period.period}</span>
            </div>

            <div className="space-y-4">
              <ProfitLossRow label="Brüt Gelir" value={profitLoss.revenue.grossRevenue} />
              <ProfitLossRow label="İskontolar" value={-profitLoss.revenue.discounts} negative />
              <ProfitLossRow label="Net Gelir" value={profitLoss.revenue.netRevenue} bold />
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2" />
              <ProfitLossRow label="Satışların Maliyeti" value={-profitLoss.costOfGoodsSold} negative />
              <ProfitLossRow label="Brüt Kâr" value={profitLoss.grossProfit} bold highlight />
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2" />
              <ProfitLossRow label="İşletme Giderleri" value={-profitLoss.operatingExpenses.total} negative />
              <ProfitLossRow label="Faaliyet Kârı" value={profitLoss.operatingProfit} bold />
              <div className="border-t border-slate-200 dark:border-slate-800 pt-2" />
              <ProfitLossRow label="Vergi Öncesi Kâr" value={profitLoss.profitBeforeTax} />
              <ProfitLossRow label="Kurumlar Vergisi (%20)" value={-profitLoss.taxExpense} negative />
              <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-3 mt-3">
                <ProfitLossRow 
                  label="NET KÂR" 
                  value={profitLoss.netProfit} 
                  bold 
                  highlight 
                  large
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Balance Sheet Summary */}
        {balanceSheet && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-600" />
                Bilanço Özeti
              </h3>
              <span className="text-sm text-slate-500">
                {new Date(balanceSheet.asOfDate).toLocaleDateString('tr-TR')}
              </span>
            </div>

            <div className="space-y-6">
              {/* Assets */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-3">VARLIKLAR</h4>
                <div className="space-y-2">
                  <BalanceSheetRow label="Nakit" value={balanceSheet.assets.currentAssets.cash} />
                  <BalanceSheetRow label="Alacaklar" value={balanceSheet.assets.currentAssets.accountsReceivable} />
                  <BalanceSheetRow label="Stoklar" value={balanceSheet.assets.currentAssets.inventory} />
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                    <BalanceSheetRow 
                      label="Dönen Varlıklar" 
                      value={balanceSheet.assets.currentAssets.total} 
                      bold 
                    />
                  </div>
                </div>
              </div>

              {/* Liabilities */}
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-3">BORÇLAR</h4>
                <div className="space-y-2">
                  <BalanceSheetRow label="Borçlar" value={balanceSheet.liabilities.currentLiabilities.accountsPayable} />
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2">
                    <BalanceSheetRow 
                      label="Kısa Vadeli Borçlar" 
                      value={balanceSheet.liabilities.currentLiabilities.total} 
                      bold 
                    />
                  </div>
                </div>
              </div>

              {/* Equity */}
              <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-4">
                <h4 className="text-sm font-medium text-slate-500 mb-3">ÖZ SERMAYE</h4>
                <BalanceSheetRow 
                  label="Net Değer" 
                  value={balanceSheet.equity.totalEquity} 
                  bold 
                  highlight 
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Tax Summary */}
      {taxSummary && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800"
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            Vergi Özeti
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TaxCard title="KDV Ödenecek" value={taxSummary.vatPayable} color="red" />
            <TaxCard title="KDV İndirilecek" value={taxSummary.vatReceivable} color="green" />
            <TaxCard title="Net KDV" value={taxSummary.netVat} color={taxSummary.netVat >= 0 ? 'red' : 'green'} />
            <TaxCard title="Stopaj" value={taxSummary.withholdingTax} color="orange" />
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Helper Components
function SummaryCard({ 
  title, 
  value, 
  icon, 
  trend, 
  color 
}: { 
  title: string; 
  value: number; 
  icon: React.ReactNode; 
  trend: number;
  color: 'green' | 'blue' | 'red' | 'purple';
}) {
  const colorClasses = {
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
  };

  const TrendIcon = trend >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(value)}
          </p>
          <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <TrendIcon className="w-4 h-4" />
            <span>%{Math.abs(trend)}</span>
          </div>
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProfitLossRow({ 
  label, 
  value, 
  bold = false, 
  highlight = false, 
  negative = false,
  large = false 
}: { 
  label: string; 
  value: number; 
  bold?: boolean; 
  highlight?: boolean;
  negative?: boolean;
  large?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center ${large ? 'text-lg' : 'text-sm'}`}>
      <span className={`${bold ? 'font-semibold' : ''} ${highlight ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
        {label}
      </span>
      <span className={`font-mono ${bold ? 'font-semibold' : ''} ${negative ? 'text-red-600' : highlight ? 'text-green-600' : ''}`}>
        {negative ? '-' : ''}{formatCurrency(value)}
      </span>
    </div>
  );
}

function BalanceSheetRow({ 
  label, 
  value, 
  bold = false, 
  highlight = false 
}: { 
  label: string; 
  value: number; 
  bold?: boolean; 
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className={bold ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}>
        {label}
      </span>
      <span className={`font-mono ${bold ? 'font-semibold' : ''} ${highlight ? 'text-blue-600' : ''}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function TaxCard({ 
  title, 
  value, 
  color 
}: { 
  title: string; 
  value: number; 
  color: 'red' | 'green' | 'orange';
}) {
  const colorClasses = {
    red: 'text-red-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl">
      <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
      <p className={`text-lg font-bold mt-1 ${colorClasses[color]}`}>
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function AccountingDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3" />
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-6" />
            <div className="space-y-3">
              {[...Array(8)].map((_, j) => (
                <div key={j} className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
