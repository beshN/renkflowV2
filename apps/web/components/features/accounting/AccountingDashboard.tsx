'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Gauge,
  PieChart,
  Scale,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react';
import {
  getAccountingWorkspace,
  upsertAccountingBudget,
  setPeriodCloseStatus,
  importBankStatementLines,
  autoMatchBankStatementLines,
  setBankStatementLineMatch,
} from '@/app/actions/accounting.actions';
import type { AccountingCapabilities, AccountingWorkspace, AgingReport } from '@/lib/types/accounting';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { cn } from '@/lib/utils';
import { BankStatementUpload } from './BankStatementUpload';
import { LedgerPanel } from './LedgerPanel';
import { VatReturnPanel } from './VatReturnPanel';

export type AccountingTab =
  | 'overview'
  | 'profit-loss'
  | 'balance-sheet'
  | 'cash-flow'
  | 'taxes'
  | 'benchmark'
  | 'control-tower'
  | 'ledger';

interface AccountingDashboardProps {
  period?: string;
  activeTab?: AccountingTab;
}

type BenchmarkRow = {
  id: keyof AccountingCapabilities;
  feature: string;
  category: string;
  leaderExamples: string;
  description: string;
};

type BudgetDraft = {
  plannedRevenue: string;
  plannedCostOfGoodsSold: string;
  plannedOperatingExpenses: string;
  plannedTaxExpense: string;
  plannedCapex: string;
};

const BENCHMARK_ROWS: BenchmarkRow[] = [
  {
    id: 'chartOfAccounts',
    feature: 'Hesap Planı (çok seviyeli)',
    category: 'Çekirdek Finans',
    leaderExamples: 'NetSuite, QuickBooks',
    description: 'Hesap kodu bazlı yönetim, finansal raporların omurgası.',
  },
  {
    id: 'generalLedger',
    feature: 'Yevmiye/Büyük Defter',
    category: 'Muhasebe Defterleri',
    leaderExamples: 'Xero, NetSuite',
    description: 'Çift taraflı kayıt ve denge kontrolü.',
  },
  {
    id: 'bankReconciliation',
    feature: 'Banka Mutabakatı',
    category: 'Nakit Kontrol',
    leaderExamples: 'QuickBooks, Xero',
    description: 'Ekstre satırlarının tahsilat/gider kayıtlarıyla eşleştirilmesi.',
  },
  {
    id: 'receivableAging',
    feature: 'Alacak Yaşlandırma (A/R)',
    category: 'Tahsilat Yönetimi',
    leaderExamples: 'QuickBooks, Xero',
    description: 'Gecikmiş müşteri alacaklarının yaş bazlı takibi.',
  },
  {
    id: 'payableAging',
    feature: 'Borç Yaşlandırma (A/P)',
    category: 'Ödeme Yönetimi',
    leaderExamples: 'NetSuite, Sage',
    description: 'Tedarikçi borçlarının vade bazlı görünümü.',
  },
  {
    id: 'cashFlowReporting',
    feature: 'Nakit Akış Raporlama',
    category: 'Likidite',
    leaderExamples: 'Xero, NetSuite',
    description: 'İşletme-yatırım-finansman nakit akışı görünümü.',
  },
  {
    id: 'taxManagement',
    feature: 'Vergi Yönetimi (KDV/Stopaj)',
    category: 'Vergi',
    leaderExamples: 'QuickBooks, Xero',
    description: 'Dönemsel vergi yükümlülüğü ve net vergi pozisyonu.',
  },
  {
    id: 'fixedAssetDepreciation',
    feature: 'Sabit Kıymet/Amortisman',
    category: 'Varlık Yönetimi',
    leaderExamples: 'NetSuite, Sage Intacct',
    description: 'Varlık ömrü ve dönemsel amortisman etkisi.',
  },
  {
    id: 'budgeting',
    feature: 'Bütçe ve Varyans Yönetimi',
    category: 'Planlama',
    leaderExamples: 'NetSuite, QuickBooks Advanced',
    description: 'Planlanan bütçenin gerçekleşen finansallar ile otomatik kıyası.',
  },
  {
    id: 'forecasting',
    feature: 'Nakit Tahminleme',
    category: 'Tahminleme',
    leaderExamples: 'Xero Analytics, NetSuite',
    description: 'Aylık projeksiyon ile ileri dönem likidite görünümü.',
  },
  {
    id: 'complianceMonitoring',
    feature: 'Uyum ve Risk Skoru',
    category: 'Risk Yönetimi',
    leaderExamples: 'Oracle ERP, SAP',
    description: 'Muhasebe kontrollerinin puanlanması ve risklerin önceliklendirilmesi.',
  },
  {
    id: 'periodLocking',
    feature: 'Dönem Kilitleme',
    category: 'Kontrol',
    leaderExamples: 'NetSuite, SAP',
    description: 'Muhasebe dönemini soft/hard close ile değişikliklere kapatma.',
  },
  {
    id: 'periodClose',
    feature: 'Dönem Kapanış Checklist',
    category: 'Kontrol',
    leaderExamples: 'NetSuite, Oracle ERP',
    description: 'Kapanış adımlarının denetim izi ile tamamlanması.',
  },
  {
    id: 'kpiDashboard',
    feature: 'Finans KPI Dashboard',
    category: 'Yönetim Kararları',
    leaderExamples: 'QuickBooks Advanced, NetSuite',
    description: 'Likidite, marj, alacak gün sayısı gibi operasyonel metrikler.',
  },
];

function trendClass(value: number): string {
  return value >= 0 ? 'text-green-600' : 'text-red-600';
}

function toMonthLabel(period: string): string {
  const [yearRaw, monthRaw] = period.split('-');
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, 1);
  return date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

function toBudgetDraft(workspace: AccountingWorkspace): BudgetDraft {
  return {
    plannedRevenue: String(workspace.budget.plannedRevenue || 0),
    plannedCostOfGoodsSold: String(workspace.budget.plannedCostOfGoodsSold || 0),
    plannedOperatingExpenses: String(workspace.budget.plannedOperatingExpenses || 0),
    plannedTaxExpense: String(workspace.budget.plannedTaxExpense || 0),
    plannedCapex: String(workspace.budget.plannedCapex || 0),
  };
}

function parseBudgetField(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function parseSignedAmountField(value: string): number {
  const normalized = value.replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

function EmptyPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{message}</p>
    </div>
  );
}

function AgingBar({
  label,
  value,
  total,
  colorClass,
}: {
  label: string;
  value: number;
  total: number;
  colorClass: string;
}) {
  const ratio = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{formatCurrency(value)}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', colorClass)} style={{ width: `${ratio}%` }} />
      </div>
    </div>
  );
}

function AgingDetails({ title, data }: { title: string; data: AgingReport }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-900 dark:text-white">{title}</h4>
        <span className="text-xs text-slate-500">
          {new Date(data.asOfDate).toLocaleDateString('tr-TR')}
        </span>
      </div>
      <AgingBar label="Güncel" value={data.current} total={data.total} colorClass="bg-emerald-500" />
      <AgingBar label="1-30 Gün" value={data.oneToThirty} total={data.total} colorClass="bg-sky-500" />
      <AgingBar label="31-60 Gün" value={data.thirtyOneToSixty} total={data.total} colorClass="bg-amber-500" />
      <AgingBar label="61-90 Gün" value={data.sixtyOneToNinety} total={data.total} colorClass="bg-orange-500" />
      <AgingBar label="90+ Gün" value={data.overNinety} total={data.total} colorClass="bg-rose-500" />
      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-600 dark:text-slate-300">Toplam</span>
        <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(data.total)}</span>
      </div>
    </div>
  );
}

export function AccountingDashboard({ period, activeTab = 'overview' }: AccountingDashboardProps) {
  const { showToast } = useToast();
  const {user}=useAuth();
  const sequence=useRef(0);
  const [loadError,setLoadError]=useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [workspace, setWorkspace] = useState<AccountingWorkspace | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<BudgetDraft>({
    plannedRevenue: '0',
    plannedCostOfGoodsSold: '0',
    plannedOperatingExpenses: '0',
    plannedTaxExpense: '0',
    plannedCapex: '0',
  });
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isUpdatingClose, setIsUpdatingClose] = useState(false);
  const [isSavingBankLine, setIsSavingBankLine] = useState(false);
  const [isAutoMatching, setIsAutoMatching] = useState(false);
  const [activeLineActionId, setActiveLineActionId] = useState<string | null>(null);
  const [bankLineDraft, setBankLineDraft] = useState({
    statementDate: new Date().toISOString().slice(0, 10),
    description: '',
    amount: '',
    reference: '',
  });

  const normalizedPeriod = useMemo(() => {
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      return period;
    }
    return new Date().toISOString().slice(0, 7);
  }, [period]);

  const loadWorkspace = useCallback(async () => {
    const requestId=++sequence.current;setLoadError('');
    try {
      setIsLoading(true);
      const result = await getAccountingWorkspace(normalizedPeriod);
      if(requestId!==sequence.current)return;
      setWorkspace(result);
      setBudgetDraft(toBudgetDraft(result));
    } catch (error) {
      if(requestId!==sequence.current)return;
      setWorkspace(null);setLoadError('Muhasebe verileri alınamadı.');
      console.error('Error loading accounting workspace:', error);
      showToast('Muhasebe çalışma alanı yüklenirken hata oluştu', 'error');
    } finally {
      if(requestId===sequence.current)setIsLoading(false);
    }
  }, [normalizedPeriod, showToast,user?.id,user?.tenantId]);

  useEffect(() => {
    setWorkspace(null);void loadWorkspace();
    return()=>{sequence.current++;};
  }, [loadWorkspace]);

  const saveBudget = async () => {
    if (!workspace) return;
    try {
      setIsSavingBudget(true);
      const response = await upsertAccountingBudget({
        period: workspace.period,
        plannedRevenue: parseBudgetField(budgetDraft.plannedRevenue),
        plannedCostOfGoodsSold: parseBudgetField(budgetDraft.plannedCostOfGoodsSold),
        plannedOperatingExpenses: parseBudgetField(budgetDraft.plannedOperatingExpenses),
        plannedTaxExpense: parseBudgetField(budgetDraft.plannedTaxExpense),
        plannedCapex: parseBudgetField(budgetDraft.plannedCapex),
      });
      if (!response.success) {
        showToast(response.error || 'Bütçe kaydedilemedi', 'error');
        return;
      }
      showToast('Bütçe güncellendi', 'success');
      await loadWorkspace();
    } catch (error) {
      console.error('Save budget error:', error);
      showToast('Bütçe kaydedilirken hata oluştu', 'error');
    } finally {
      setIsSavingBudget(false);
    }
  };

  const updateCloseStatus = async (status: 'open' | 'soft_closed' | 'hard_closed') => {
    if (!workspace) return;
    try {
      setIsUpdatingClose(true);
      const response = await setPeriodCloseStatus({
        period: workspace.period,
        status,
      });
      if (!response.success) {
        showToast(response.error || 'Dönem durumu güncellenemedi', 'error');
        return;
      }
      showToast('Dönem durumu güncellendi', 'success');
      await loadWorkspace();
    } catch (error) {
      console.error('Update close status error:', error);
      showToast('Dönem durumu güncellenirken hata oluştu', 'error');
    } finally {
      setIsUpdatingClose(false);
    }
  };

  const saveBankLine = async () => {
    if (!workspace) return;

    const amount = parseSignedAmountField(bankLineDraft.amount);
    if (!bankLineDraft.description.trim()) {
      showToast('Açıklama girin', 'error');
      return;
    }
    if (Math.abs(amount) < 0.01) {
      showToast('Tutar 0 olamaz', 'error');
      return;
    }

    try {
      setIsSavingBankLine(true);
      const response = await importBankStatementLines({
        lines: [
          {
            statementDate: bankLineDraft.statementDate,
            description: bankLineDraft.description.trim(),
            amount,
            reference: bankLineDraft.reference.trim() || undefined,
          },
        ],
      });
      if (!response.success) {
        showToast(response.error || 'Banka satırı eklenemedi', 'error');
        return;
      }
      showToast(`Banka hareketi kaydedildi (${response.importedCount})`, 'success');
      setBankLineDraft((prev) => ({ ...prev, description: '', amount: '', reference: '' }));
      await loadWorkspace();
    } catch (error) {
      console.error('Save bank line error:', error);
      showToast('Banka satırı kaydedilirken hata oluştu', 'error');
    } finally {
      setIsSavingBankLine(false);
    }
  };

  const runAutoMatch = async () => {
    if (!workspace) return;
    try {
      setIsAutoMatching(true);
      const response = await autoMatchBankStatementLines(workspace.period);
      if (!response.success) {
        showToast(response.error || 'Otomatik eşleştirme başarısız', 'error');
        return;
      }
      showToast(`${response.matchedCount} satır otomatik eşleştirildi`, 'success');
      await loadWorkspace();
    } catch (error) {
      console.error('Auto match error:', error);
      showToast('Otomatik eşleştirme sırasında hata oluştu', 'error');
    } finally {
      setIsAutoMatching(false);
    }
  };

  const matchLine = async (lineId: string, matchType: 'payment' | 'expense', matchId: string) => {
    try {
      setActiveLineActionId(lineId);
      const response = await setBankStatementLineMatch({
        lineId,
        matchType,
        matchId,
      });
      if (!response.success) {
        showToast(response.error || 'Satır eşleştirilemedi', 'error');
        return;
      }
      showToast('Satır eşleştirildi', 'success');
      await loadWorkspace();
    } catch (error) {
      console.error('Match line error:', error);
      showToast('Satır eşleştirilirken hata oluştu', 'error');
    } finally {
      setActiveLineActionId(null);
    }
  };

  const ignoreLine = async (lineId: string) => {
    try {
      setActiveLineActionId(lineId);
      const response = await setBankStatementLineMatch({
        lineId,
        matchType: 'ignored',
      });
      if (!response.success) {
        showToast(response.error || 'Satır güncellenemedi', 'error');
        return;
      }
      showToast('Satır yok sayıldı', 'success');
      await loadWorkspace();
    } catch (error) {
      console.error('Ignore line error:', error);
      showToast('Satır güncellenirken hata oluştu', 'error');
    } finally {
      setActiveLineActionId(null);
    }
  };

  if (isLoading) {
    return <AccountingDashboardSkeleton />;
  }

  if (!workspace) {
    return <div role="alert" className="rf-panel space-y-3 p-5"><p>{loadError || "Muhasebe verisi alınamadı."}</p><button className="rf-secondary-button" onClick={()=>void loadWorkspace()}>Tekrar dene</button></div>;
  }

  const completionRate = Math.round(
    (BENCHMARK_ROWS.filter((row) => workspace.capabilities[row.id]).length / BENCHMARK_ROWS.length) * 100
  );

  const summaryCards = [
    {
      title: 'Net Kâr',
      value: workspace.profitLoss?.netProfit || 0,
      trend: workspace.periodComparison.netProfitChangePct,
      icon: <TrendingUp className="w-5 h-5" />,
      colorClass: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      title: 'Toplam Gelir',
      value: workspace.profitLoss?.revenue.netRevenue || 0,
      trend: workspace.periodComparison.revenueChangePct,
      icon: <BarChart3 className="w-5 h-5" />,
      colorClass: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20',
    },
    {
      title: 'İşletme Giderleri',
      value: workspace.profitLoss?.operatingExpenses.total || 0,
      trend: workspace.periodComparison.expenseChangePct,
      icon: <TrendingDown className="w-5 h-5" />,
      colorClass: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20',
    },
    {
      title: 'Nakit Pozisyonu',
      value: workspace.balanceSheet?.assets.currentAssets.cash || 0,
      trend: workspace.periodComparison.cashChangePct,
      icon: <Wallet className="w-5 h-5" />,
      colorClass: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20',
    },
  ];


  return (
    <div className="space-y-6">
      {activeTab === 'ledger' && <LedgerPanel period={normalizedPeriod} />}

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map((card) => {
              const TrendIcon = card.trend >= 0 ? ArrowUpRight : ArrowDownRight;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-500">{card.title}</p>
                      <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                        {formatCurrency(card.value)}
                      </p>
                      <div className={cn('mt-2 text-sm flex items-center gap-1', trendClass(card.trend))}>
                        <TrendIcon className="w-4 h-4" />
                        <span>%{Math.abs(card.trend).toFixed(1)}</span>
                      </div>
                    </div>
                    <div className={cn('p-3 rounded-xl', card.colorClass)}>{card.icon}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
                <Gauge className="w-5 h-5 text-sky-600" />
                Finans KPI Panosu ({toMonthLabel(workspace.period)})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <KpiCard title="Brüt Marj" value={`${workspace.kpis.grossMarginPct.toFixed(1)}%`} />
                <KpiCard title="Faaliyet Marjı" value={`${workspace.kpis.operatingMarginPct.toFixed(1)}%`} />
                <KpiCard title="Cari Oran" value={workspace.kpis.currentRatio.toFixed(2)} />
                <KpiCard title="Alacak Gün Sayısı" value={`${workspace.kpis.receivableDays.toFixed(1)} gün`} />
                <KpiCard title="Borç Karşılama" value={`${workspace.kpis.payablesCoverageRatio.toFixed(2)}x`} />
                <KpiCard title="Nakit Runway" value={`${workspace.kpis.cashRunwayMonths.toFixed(1)} ay`} />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                Dönem Kapanış
              </h3>
              <div className="text-sm text-slate-500 mb-3">
                Tamamlanma: <span className="font-semibold text-slate-900 dark:text-white">
                  {Math.round(
                    (workspace.closeChecklist.filter((item) => item.status === 'done').length /
                      Math.max(workspace.closeChecklist.length, 1)) *
                      100
                  )}
                  %
                </span>
              </div>
              <div className="space-y-3">
                {workspace.closeChecklist.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex items-center gap-2">
                      {item.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : item.status === 'warning' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Clock3 className="w-4 h-4 text-slate-400" />
                      )}
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
                    </div>
                    {item.note && <p className="text-xs text-slate-500 mt-1 ml-6">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {workspace.alerts.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-6 border border-amber-200 dark:border-amber-800/60">
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" />
                Risk Uyarıları
              </h3>
              <div className="space-y-2">
                {workspace.alerts.map((alert) => (
                  <p key={alert} className="text-sm text-amber-900/80 dark:text-amber-100/90">
                    • {alert}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Bütçe Varyansı</h4>
              <div className="space-y-2 text-sm">
                {workspace.budgetVsActual.rows.slice(0, 4).map((row) => {
                  const favorable =
                    row.betterWhen === 'higher' ? row.variance >= 0 : row.variance <= 0;
                  return (
                    <div key={row.key} className="flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                      <span className={cn('font-semibold', favorable ? 'text-emerald-600' : 'text-rose-600')}>
                        {row.variance >= 0 ? '+' : ''}
                        {row.variancePct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
              {!workspace.budgetVsActual.hasBudget && (
                <p className="text-xs text-amber-600 mt-3">Dönem bütçesi tanımlı değil.</p>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">6 Aylık Nakit Tahmini</h4>
              <div className="space-y-2">
                {workspace.cashForecast.points.slice(0, 3).map((point) => (
                  <div key={point.period} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{toMonthLabel(point.period)}</span>
                    <span className={cn('font-semibold', trendClass(point.projectedNet))}>
                      {formatCurrency(point.projectedEndingCash)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Uyum Skoru</h4>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">{workspace.compliance.score}</span>
                <span className="text-sm text-slate-500">/100</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 p-2 text-center">
                  <p className="font-semibold text-rose-600">{workspace.compliance.criticalCount}</p>
                  <p className="text-slate-500">Kritik</p>
                </div>
                <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 p-2 text-center">
                  <p className="font-semibold text-amber-600">{workspace.compliance.warningCount}</p>
                  <p className="text-slate-500">Uyarı</p>
                </div>
                <div className="rounded-lg bg-sky-50 dark:bg-sky-900/20 p-2 text-center">
                  <p className="font-semibold text-sky-600">{workspace.compliance.infoCount}</p>
                  <p className="text-slate-500">Bilgi</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'profit-loss' && (
        <>
          {workspace.profitLoss ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-sky-600" />
                  Detaylı Kâr-Zarar
                </h3>
                <div className="space-y-3 text-sm">
                  <ProfitLossRow label="Brüt Gelir" value={workspace.profitLoss.revenue.grossRevenue} />
                  <ProfitLossRow label="Satışların Maliyeti" value={-workspace.profitLoss.costOfGoodsSold} negative />
                  <ProfitLossRow label="Brüt Kâr" value={workspace.profitLoss.grossProfit} bold />
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-2" />
                  <ProfitLossRow label="İşletme Giderleri" value={-workspace.profitLoss.operatingExpenses.total} negative />
                  <ProfitLossRow label="Faaliyet Kârı" value={workspace.profitLoss.operatingProfit} />
                  <ProfitLossRow label="Vergi Gideri" value={-workspace.profitLoss.taxExpense} negative />
                  <div className="border-t-2 border-slate-300 dark:border-slate-700 pt-3">
                    <ProfitLossRow label="NET KÂR" value={workspace.profitLoss.netProfit} bold highlight />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-violet-600" />
                  Önceki Döneme Göre
                </h4>
                <div className="space-y-3 text-sm">
                  <ComparisonRow label="Gelir" value={workspace.periodComparison.revenueChangePct} />
                  <ComparisonRow label="Gider" value={workspace.periodComparison.expenseChangePct} inverse />
                  <ComparisonRow label="Net Kâr" value={workspace.periodComparison.netProfitChangePct} />
                  <ComparisonRow label="Nakit" value={workspace.periodComparison.cashChangePct} />
                </div>
                {workspace.notes.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    {workspace.notes.slice(0, 3).map((note) => (
                      <p key={note} className="text-xs text-slate-500">
                        • {note}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyPanel title="Kâr-Zarar Raporu" message="Bu dönem için rapor üretilemedi." />
          )}
        </>
      )}

      {activeTab === 'balance-sheet' && (
        <>
          {workspace.balanceSheet ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-sky-600" />
                    Varlıklar
                  </h4>
                  <BalanceRow label="Nakit" value={workspace.balanceSheet.assets.currentAssets.cash} />
                  <BalanceRow label="Alacaklar" value={workspace.balanceSheet.assets.currentAssets.accountsReceivable} />
                  <BalanceRow label="Stoklar" value={workspace.balanceSheet.assets.currentAssets.inventory} />
                  <BalanceRow label="Toplam Varlık" value={workspace.balanceSheet.assets.totalAssets} bold />
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-rose-600" />
                    Yükümlülükler
                  </h4>
                  <BalanceRow label="Kısa Vadeli Borçlar" value={workspace.balanceSheet.liabilities.currentLiabilities.total} />
                  <BalanceRow label="Toplam Borç" value={workspace.balanceSheet.liabilities.totalLiabilities} bold />
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                  <h4 className="font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    Öz Sermaye
                  </h4>
                  <BalanceRow label="Cari Dönem Kârı" value={workspace.balanceSheet.equity.currentYearProfit} />
                  <BalanceRow label="Toplam Öz Sermaye" value={workspace.balanceSheet.equity.totalEquity} bold />
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <AgingDetails title="Alacak Yaşlandırma (A/R)" data={workspace.receivablesAging} />
                <AgingDetails title="Borç Yaşlandırma (A/P)" data={workspace.payablesAging} />
              </div>
            </div>
          ) : (
            <EmptyPanel title="Bilanço" message="Bilanço raporu üretilemedi." />
          )}
        </>
      )}

      {activeTab === 'cash-flow' && (
        <>
          {workspace.cashFlow ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-sky-600" />
                  Nakit Akış Özeti
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <CashFlowCard
                    title="İşletme Faaliyetleri"
                    value={workspace.cashFlow.operatingActivities.netOperatingCashFlow}
                  />
                  <CashFlowCard
                    title="Yatırım Faaliyetleri"
                    value={workspace.cashFlow.investingActivities.netInvestingCashFlow}
                  />
                  <CashFlowCard
                    title="Finansman Faaliyetleri"
                    value={workspace.cashFlow.financingActivities.netFinancingCashFlow}
                  />
                </div>
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-sm text-slate-500">Net Nakit Değişimi</span>
                  <span className={cn('font-semibold', trendClass(workspace.cashFlow.netChangeInCash))}>
                    {formatCurrency(workspace.cashFlow.netChangeInCash)}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
                <h4 className="font-semibold text-slate-900 dark:text-white mb-4">Likidite Sinyalleri</h4>
                <div className="space-y-3 text-sm">
                  <MetricLine label="Cari Oran" value={workspace.kpis.currentRatio.toFixed(2)} />
                  <MetricLine label="Nakit Runway" value={`${workspace.kpis.cashRunwayMonths.toFixed(1)} ay`} />
                  <MetricLine label="Borç Karşılama" value={`${workspace.kpis.payablesCoverageRatio.toFixed(2)}x`} />
                </div>
              </div>
            </div>
          ) : (
            <EmptyPanel title="Nakit Akış" message="Nakit akış raporu üretilemedi." />
          )}
        </>
      )}

      {activeTab === 'taxes' && <VatReturnPanel period={normalizedPeriod} />}

      {activeTab === 'control-tower' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Dönem Durumu</h4>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-2 py-1 rounded-full text-xs font-semibold',
                    workspace.periodCloseState.status === 'hard_closed'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      : workspace.periodCloseState.status === 'soft_closed'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  )}
                >
                  {workspace.periodCloseState.status === 'hard_closed'
                    ? 'Hard Close'
                    : workspace.periodCloseState.status === 'soft_closed'
                      ? 'Soft Close'
                      : 'Open'}
                </span>
                {workspace.periodCloseState.locked && (
                  <span className="text-xs text-rose-600">Kilitli</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Dönem: {toMonthLabel(workspace.periodCloseState.period)}
              </p>
              {workspace.periodCloseState.closedAt && (
                <p className="text-xs text-slate-500 mt-1">
                  Kapanış: {new Date(workspace.periodCloseState.closedAt).toLocaleDateString('tr-TR')}
                  {workspace.periodCloseState.closedByName ? ` · ${workspace.periodCloseState.closedByName}` : ''}
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => updateCloseStatus('open')}
                  disabled={isUpdatingClose || !["owner","admin"].includes(user?.role || "")}
                  className="text-xs px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => updateCloseStatus('soft_closed')}
                  disabled={isUpdatingClose || !["owner","admin"].includes(user?.role || "")}
                  className="text-xs px-2 py-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20 disabled:opacity-50"
                >
                  Soft Close
                </button>
                <button
                  type="button"
                  onClick={() => updateCloseStatus('hard_closed')}
                  disabled={isUpdatingClose || !["owner","admin"].includes(user?.role || "")}
                  className="text-xs px-2 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-900/20 disabled:opacity-50"
                >
                  Hard Close
                </button>
              </div>
            </div>

            <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Uyum ve Risk Kontrolleri</h4>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold text-slate-900 dark:text-white">
                  {workspace.compliance.score}
                </span>
                <span className="text-sm text-slate-500">/100</span>
              </div>
              <div className="space-y-2">
                {workspace.compliance.issues.length === 0 && (
                  <p className="text-sm text-emerald-600">Açık uyum problemi görünmüyor.</p>
                )}
                {workspace.compliance.issues.map((issue) => (
                  <div key={issue.code} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{issue.title}</p>
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          issue.severity === 'critical'
                            ? 'text-rose-600'
                            : issue.severity === 'warning'
                              ? 'text-amber-600'
                              : 'text-sky-600'
                        )}
                      >
                        {issue.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{issue.detail}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Öneri: {issue.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Banka Mutabakat Özeti</h4>
              <div className="space-y-2 text-sm">
                <MetricLine
                  label="Eşleşme Oranı"
                  value={`%${workspace.bankReconciliation.matchRatePct.toFixed(1)}`}
                />
                <MetricLine
                  label="Eşleşen Satır"
                  value={`${workspace.bankReconciliation.matchedLineCount}/${workspace.bankReconciliation.importedLineCount}`}
                />
                <MetricLine
                  label="Eşleşmeyen"
                  value={`${workspace.bankReconciliation.unmatchedLineCount} (${formatCurrency(
                    workspace.bankReconciliation.unmatchedAmount
                  )})`}
                />
                <MetricLine
                  label="Ekstre Net"
                  value={formatCurrency(workspace.bankReconciliation.statementNet)}
                />
                <MetricLine
                  label="Defter Net"
                  value={formatCurrency(workspace.bankReconciliation.booksNet)}
                />
                <MetricLine
                  label="Fark"
                  value={formatCurrency(workspace.bankReconciliation.difference)}
                />
              </div>
              <button
                type="button"
                onClick={runAutoMatch}
                disabled={isAutoMatching || workspace.periodCloseState.locked}
                className="mt-4 w-full px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                {isAutoMatching ? 'Eşleştiriliyor...' : 'Otomatik Eşleştir'}
              </button>
              {workspace.periodCloseState.locked && (
                <p className="text-xs text-rose-600 mt-2">Hard close açıkken mutabakat güncellenemez.</p>
              )}
            </div>

            <div className="xl:col-span-2 bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Banka Hareketleri</h4>
              <BankStatementUpload disabled={workspace.periodCloseState.locked} onImported={async (message) => { showToast(message, 'success'); await loadWorkspace(); }} />
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-4">
                <input
                  type="date"
                  value={bankLineDraft.statementDate}
                  onChange={(event) =>
                    setBankLineDraft((prev) => ({ ...prev, statementDate: event.target.value }))
                  }
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="text"
                  value={bankLineDraft.description}
                  onChange={(event) =>
                    setBankLineDraft((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder="Açıklama"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="text"
                  value={bankLineDraft.amount}
                  onChange={(event) =>
                    setBankLineDraft((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  placeholder="Tutar (+/-)"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={saveBankLine}
                  disabled={isSavingBankLine || workspace.periodCloseState.locked}
                  className="px-2 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 disabled:opacity-50"
                >
                  {isSavingBankLine ? 'Kaydediliyor...' : 'Satır Ekle'}
                </button>
              </div>

              <div className="space-y-2">
                {workspace.bankReconciliation.items.length === 0 && (
                  <p className="text-sm text-slate-500">Eşleşmeyen banka satırı bulunmuyor.</p>
                )}
                {workspace.bankReconciliation.items.map((line) => (
                  <div key={line.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {line.description}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(line.statementDate).toLocaleDateString('tr-TR')}
                          {line.reference ? ` · ${line.reference}` : ''}
                        </p>
                        {line.suggestedLabel && (
                          <p className="text-xs text-sky-600 mt-1">Öneri: {line.suggestedLabel}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className={cn('text-sm font-semibold', trendClass(line.amount))}>
                          {formatCurrency(line.amount)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">{line.status.toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() =>
                          line.suggestedMatchType && line.suggestedMatchId
                            ? matchLine(line.id, line.suggestedMatchType, line.suggestedMatchId)
                            : undefined
                        }
                        disabled={
                          !line.suggestedMatchType ||
                          !line.suggestedMatchId ||
                          activeLineActionId === line.id ||
                          workspace.periodCloseState.locked
                        }
                        className="px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 text-xs hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20 disabled:opacity-40"
                      >
                        {activeLineActionId === line.id ? 'İşleniyor...' : 'Öneriyi Eşleştir'}
                      </button>
                      <button
                        type="button"
                        onClick={() => ignoreLine(line.id)}
                        disabled={activeLineActionId === line.id || workspace.periodCloseState.locked}
                        className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-xs hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-40"
                      >
                        Yok Say
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Bütçe vs Gerçekleşen</h4>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <input
                  type="number"
                  value={budgetDraft.plannedRevenue}
                  onChange={(event) =>
                    setBudgetDraft((prev) => ({ ...prev, plannedRevenue: event.target.value }))
                  }
                  placeholder="Bütçe Gelir"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="number"
                  value={budgetDraft.plannedCostOfGoodsSold}
                  onChange={(event) =>
                    setBudgetDraft((prev) => ({ ...prev, plannedCostOfGoodsSold: event.target.value }))
                  }
                  placeholder="Bütçe COGS"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="number"
                  value={budgetDraft.plannedOperatingExpenses}
                  onChange={(event) =>
                    setBudgetDraft((prev) => ({ ...prev, plannedOperatingExpenses: event.target.value }))
                  }
                  placeholder="Bütçe OPEX"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="number"
                  value={budgetDraft.plannedTaxExpense}
                  onChange={(event) =>
                    setBudgetDraft((prev) => ({ ...prev, plannedTaxExpense: event.target.value }))
                  }
                  placeholder="Bütçe Vergi"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <input
                  type="number"
                  value={budgetDraft.plannedCapex}
                  onChange={(event) =>
                    setBudgetDraft((prev) => ({ ...prev, plannedCapex: event.target.value }))
                  }
                  placeholder="Bütçe CAPEX"
                  className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={saveBudget}
                  disabled={isSavingBudget}
                  className="px-2 py-2 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-500 disabled:opacity-50"
                >
                  {isSavingBudget ? 'Kaydediliyor...' : 'Bütçeyi Kaydet'}
                </button>
              </div>
              <div className="space-y-2">
                {workspace.budgetVsActual.rows.map((row) => {
                  const favorable =
                    row.betterWhen === 'higher' ? row.variance >= 0 : row.variance <= 0;
                  return (
                    <div key={row.key} className="grid grid-cols-4 gap-2 text-xs border-b border-slate-100 dark:border-slate-800 pb-2">
                      <p className="col-span-1 text-slate-600 dark:text-slate-400">{row.label}</p>
                      <p className="col-span-1 text-right text-slate-500">Bütçe {formatCurrency(row.planned)}</p>
                      <p className="col-span-1 text-right text-slate-500">Fiili {formatCurrency(row.actual)}</p>
                      <p className={cn('col-span-1 text-right font-semibold', favorable ? 'text-emerald-600' : 'text-rose-600')}>
                        {row.variance >= 0 ? '+' : ''}
                        {row.variancePct.toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Nakit Forecast (6 Ay)</h4>
              <div className="space-y-2">
                {workspace.cashForecast.points.map((point) => (
                  <div key={point.period} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{toMonthLabel(point.period)}</span>
                      <span className="text-slate-500">Güven %{point.confidencePct}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <span className="text-emerald-600">+{formatCurrency(point.projectedInflow)}</span>
                      <span className="text-rose-600">-{formatCurrency(point.projectedOutflow)}</span>
                      <span className={cn('font-semibold', trendClass(point.projectedNet))}>
                        {formatCurrency(point.projectedEndingCash)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'benchmark' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-600" />
                Profesyonel Yazılım Kıyas Matrisi
              </h3>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Uyum: %{completionRate}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Kıyas satırları NetSuite, QuickBooks ve Xero’nun finans modülü standardına göre hazırlandı.
            </p>
            <div className="mt-4 space-y-3">
              {BENCHMARK_ROWS.map((row) => {
                const done = workspace.capabilities[row.id];
                return (
                  <div
                    key={row.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{row.feature}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {row.category} · Lider örnekler: {row.leaderExamples}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{row.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600" />
                      )}
                      <span className={cn('text-sm font-medium', done ? 'text-emerald-600' : 'text-rose-600')}>
                        {done ? 'Aktif' : 'Eksik'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {workspace.notes.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800">
              <h4 className="font-semibold text-slate-900 dark:text-white mb-3">Teknik Notlar</h4>
              <div className="space-y-2">
                {workspace.notes.map((note) => (
                  <p key={note} className="text-sm text-slate-600 dark:text-slate-300">
                    • {note}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className="text-lg font-semibold text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}

function ProfitLossRow({
  label,
  value,
  bold = false,
  highlight = false,
  negative = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  highlight?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={cn('text-slate-600 dark:text-slate-400', bold && 'font-semibold text-slate-900 dark:text-white')}>
        {label}
      </span>
      <span className={cn('font-mono', bold && 'font-semibold', highlight && 'text-emerald-600', negative && 'text-rose-600')}>
        {negative ? '-' : ''}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

function ComparisonRow({ label, value, inverse = false }: { label: string; value: number; inverse?: boolean }) {
  const good = inverse ? value <= 0 : value >= 0;
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <span className="text-sm text-slate-600 dark:text-slate-400">{label}</span>
      <span className={cn('text-sm font-semibold', good ? 'text-emerald-600' : 'text-rose-600')}>
        {value >= 0 ? '+' : ''}
        {value.toFixed(1)}%
      </span>
    </div>
  );
}

function BalanceRow({ label, value, bold = false }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1 text-sm">
      <span className={cn('text-slate-600 dark:text-slate-400', bold && 'font-semibold text-slate-900 dark:text-white')}>{label}</span>
      <span className={cn('font-mono', bold && 'font-semibold')}>{formatCurrency(value)}</span>
    </div>
  );
}

function CashFlowCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={cn('text-lg font-semibold mt-1', trendClass(value))}>{formatCurrency(value)}</p>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function AccountingDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800"
          >
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-3" />
            <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800"
          >
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-6" />
            <div className="space-y-3">
              {[...Array(8)].map((__, rowIndex) => (
                <div key={rowIndex} className="h-4 bg-slate-200 dark:bg-slate-700 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
