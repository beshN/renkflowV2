'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { useAuth } from '@/lib/context/AuthContext';
import { useToast } from '@/lib/context/ToastContext';
import { canAccessFinance, hasPermission } from '@/lib/auth/permissions';
import { formatCurrency } from '@/lib/utils';
import { 
  ArrowLeft,
  Plus,
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';

import { 
  getEmployeeWithBalance, 
  listLedgerEntries, 
  addLedgerEntry,
  updateEmployee,
} from '@/app/actions/finance.employees.actions';
import { 
  Employee, 
  EmployeeLedgerEntry, 
  CreateLedgerEntryInput,
  LedgerEntryKind,
  LEDGER_KIND_LABELS,
} from '@/lib/types/finance';

const KIND_COLORS: Record<LedgerEntryKind, string> = {
  salary: 'bg-green-100 text-green-700',
  advance: 'bg-orange-100 text-orange-700',
  deduction: 'bg-blue-100 text-blue-700',
  payment: 'bg-purple-100 text-purple-700',
};

const KIND_ICONS: Record<LedgerEntryKind, typeof DollarSign> = {
  salary: DollarSign,
  advance: TrendingUp,
  deduction: TrendingDown,
  payment: Wallet,
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const employeeId = params.id as string;
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [employee, setEmployee] = useState<(Employee & { balance: number; totalSalary: number; totalAdvance: number }) | null>(null);
  const [entries, setEntries] = useState<EmployeeLedgerEntry[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [formData, setFormData] = useState<CreateLedgerEntryInput>({
    employeeId: employeeId,
    kind: 'salary',
    amount: 0,
    currency: 'TRY',
    entryDate: new Date().toISOString().split('T')[0],
    note: '',
  });

  const canCreate = user && hasPermission(user.role as any, 'finance.ledger.create');

  useEffect(() => {
    if (!user) return;
    
    if (!canAccessFinance(user.role as any)) {
      showToast('Finans modülüne erişim yetkiniz bulunmuyor', 'error');
      return;
    }

    loadData();
  }, [user, employeeId]);

  useEffect(() => {
    if (employee) {
      loadEntries();
    }
  }, [selectedMonth]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [empData, entriesData] = await Promise.all([
        getEmployeeWithBalance(employeeId),
        listLedgerEntries(employeeId),
      ]);
      setEmployee(empData);
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading employee:', error);
      showToast('Çalışan bilgileri yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadEntries = async () => {
    try {
      const [year, month] = selectedMonth.split('-');
      const startDate = `${year}-${month}-01`;
      const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
      
      const data = await listLedgerEntries(employeeId, { startDate, endDate });
      setEntries(data);
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const handleAddEntry = async () => {
    if (!formData.amount || formData.amount <= 0) {
      showToast('Tutar pozitif olmalı', 'error');
      return;
    }

    try {
      setIsAdding(true);
      const newEntry = await addLedgerEntry({
        ...formData,
        employeeId,
      });
      setEntries(prev => [newEntry, ...prev]);
      setIsAddModalOpen(false);
      setFormData({
        employeeId,
        kind: 'salary',
        amount: 0,
        currency: 'TRY',
        entryDate: new Date().toISOString().split('T')[0],
        note: '',
      });
      // Reload employee to update balance
      const empData = await getEmployeeWithBalance(employeeId);
      setEmployee(empData);
      showToast('Kayıt eklendi', 'success');
    } catch (error) {
      console.error('Error adding entry:', error);
      showToast('Kayıt eklenirken hata oluştu', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  // Generate month options for filter
  const monthOptions = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    monthOptions.push({ value, label });
  }

  if (!user || !canAccessFinance(user.role as any)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Finans modülüne erişim yetkiniz bulunmuyor</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Çalışan bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar title={employee.fullName} showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Breadcrumb */}
        <Link href="/finance/employees" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} />
          Personel Listesi
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee Info Card */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-6 sticky top-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl mb-4">
                  {employee.fullName.charAt(0).toUpperCase()}
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {employee.fullName}
                </h2>
                {employee.title && (
                  <p className="text-slate-500 flex items-center gap-1 mt-1">
                    <Briefcase size={14} />
                    {employee.title}
                  </p>
                )}
                <span className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  employee.active 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  {employee.active ? 'Aktif' : 'Pasif'}
                </span>
              </div>

              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                {employee.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">{employee.email}</span>
                  </div>
                )}
                {employee.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-300">{employee.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar size={16} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">
                    {new Date(employee.createdAt).toLocaleDateString('tr-TR')} tarihinde eklendi
                  </span>
                </div>
              </div>

              {/* Balance Summary */}
              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Toplam Maaş</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(employee.totalSalary, 'TRY')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Toplam Avans</span>
                  <span className="font-semibold text-orange-600">
                    {formatCurrency(employee.totalAdvance, 'TRY')}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Bakiye</span>
                  <span className={`font-bold text-lg ${
                    employee.balance > 0 ? 'text-orange-600' : employee.balance < 0 ? 'text-green-600' : 'text-slate-600'
                  }`}>
                    {employee.balance > 0 ? '+' : ''}{formatCurrency(employee.balance, 'TRY')}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {employee.balance > 0 
                    ? 'Çalışan şirkete borçlu (avans)' 
                    : employee.balance < 0 
                    ? 'Şirket çalışana borçlu'
                    : 'Bakiye sıfır'}
                </p>
              </div>
            </div>
          </div>

          {/* Ledger Entries */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="font-bold text-slate-900 dark:text-white">Bordro Kayıtları</h3>
                <div className="flex items-center gap-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {monthOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {canCreate && (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <Plus size={16} />
                      Kayıt Ekle
                    </button>
                  )}
                </div>
              </div>

              {/* Entries List */}
              <div className="p-4">
                {entries.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Wallet size={48} className="mx-auto mb-4 opacity-30" />
                    <p>Bu dönemde kayıt bulunmuyor</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entries.map((entry) => {
                      const Icon = KIND_ICONS[entry.kind];
                      return (
                        <div 
                          key={entry.id}
                          className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${KIND_COLORS[entry.kind]}`}>
                              <Icon size={20} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KIND_COLORS[entry.kind]}`}>
                                  {LEDGER_KIND_LABELS[entry.kind]}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {new Date(entry.entryDate).toLocaleDateString('tr-TR')}
                                </span>
                              </div>
                              {entry.note && (
                                <p className="text-sm text-slate-500 mt-1">{entry.note}</p>
                              )}
                            </div>
                          </div>
                          <span className={`font-bold ${
                            entry.kind === 'salary' || entry.kind === 'payment' 
                              ? 'text-green-600' 
                              : entry.kind === 'advance' 
                              ? 'text-orange-600' 
                              : 'text-blue-600'
                          }`}>
                            {entry.kind === 'deduction' ? '-' : '+'}{formatCurrency(entry.amount, entry.currency)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Entry Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bordro Kaydı Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kayıt Türü *
              </label>
              <select
                value={formData.kind}
                onChange={(e) => setFormData(prev => ({ ...prev, kind: e.target.value as LedgerEntryKind }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="salary">Maaş</option>
                <option value="advance">Avans</option>
                <option value="deduction">Kesinti</option>
                <option value="payment">Ödeme</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tutar *
              </label>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tarih *
              </label>
              <input
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, entryDate: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Not
              </label>
              <textarea
                value={formData.note || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Açıklama ekleyin..."
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleAddEntry}
              disabled={isAdding || !formData.amount}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAdding ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
