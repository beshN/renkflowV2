'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
import { canAccessFinance, hasPermission, UserRole } from '@/lib/auth/permissions';
import { 
  ArrowLeft,
  Users,
  Plus,
  Search,
  ChevronRight,
  User,
  Mail,
  Phone,
  Briefcase,
} from 'lucide-react';

import { listEmployees, createEmployee } from '@/app/actions/finance.employees.actions';
import { Employee, CreateEmployeeInput } from '@/lib/types/finance';

export default function FinanceEmployeesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<CreateEmployeeInput>({
    fullName: '',
    title: '',
    email: '',
    phone: '',
  });

  const canCreate = user && hasPermission(user.role as UserRole, 'finance.employees.create');

  useEffect(() => {
    if (!user) return;
    
    if (!canAccessFinance(user.role as UserRole)) {
      showToast('Finans modülüne erişim yetkiniz bulunmuyor', 'error');
      return;
    }

    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await listEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast('Çalışanlar yüklenirken hata oluştu', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formData.fullName.trim()) {
      showToast('İsim zorunludur', 'error');
      return;
    }

    try {
      setIsCreating(true);
      const newEmployee = await createEmployee(formData);
      setEmployees(prev => [...prev, newEmployee]);
      setIsCreateModalOpen(false);
      setFormData({ fullName: '', title: '', email: '', phone: '' });
      showToast('Çalışan eklendi', 'success');
    } catch (error) {
      console.error('Error creating employee:', error);
      showToast('Çalışan eklenirken hata oluştu', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const filteredEmployees = employees.filter(emp => {
    return (
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  if (!user || !canAccessFinance(user.role as UserRole)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-500">Finans modülüne erişim yetkiniz bulunmuyor</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-950/50 min-h-screen">
      <Navbar title="Personel Bordro" showSearch={false} />
      
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {/* Breadcrumb & Actions */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/finance" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
            <ArrowLeft size={16} />
            Finans
          </Link>
          
          {canCreate && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium shadow-lg shadow-blue-500/20 transition-all"
            >
              <Plus size={18} />
              Yeni Çalışan
            </button>
          )}
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm mb-6">
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="İsim, unvan veya email ile ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Employees Grid */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Users size={48} className="mb-4 opacity-30" />
              <p>Çalışan bulunamadı</p>
              {canCreate && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 text-blue-600 hover:underline"
                >
                  İlk çalışanı ekle
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {filteredEmployees.map((employee) => (
                <Link
                  key={employee.id}
                  href={`/finance/employees/${employee.id}`}
                  className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {employee.fullName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {employee.fullName}
                      </h3>
                      {employee.title && (
                        <p className="text-sm text-slate-500 truncate flex items-center gap-1">
                          <Briefcase size={12} />
                          {employee.title}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={20} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                    {employee.email && (
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <Mail size={12} />
                        {employee.email}
                      </p>
                    )}
                    {employee.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <Phone size={12} />
                        {employee.phone}
                      </p>
                    )}
                  </div>
                  <div className="mt-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      employee.active 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {employee.active ? 'Aktif' : 'Pasif'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Employee Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Çalışan Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ad Soyad *
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="Örn: Ahmet Yılmaz"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Unvan
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Örn: Üretim Müdürü"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="ornek@sirket.com"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Telefon
              </label>
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="0555 555 55 55"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating || !formData.fullName.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Ekleniyor...' : 'Ekle'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
