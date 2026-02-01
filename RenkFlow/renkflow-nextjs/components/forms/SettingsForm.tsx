'use client';

import { useState } from 'react';
import { CompanySettings } from '@/lib/types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Save, Trash2, Plus, GripVertical } from 'lucide-react';

interface SettingsFormProps {
  initialSettings: CompanySettings;
  onSave: (settings: CompanySettings) => void;
}

interface CustomStatus {
  id: string;
  name: string;
  color: string;
}

interface Department {
  id: string;
  name: string;
  color: string;
}

export function SettingsForm({ initialSettings, onSave }: SettingsFormProps) {
  const [activeTab, setActiveTab] = useState<'company' | 'statuses' | 'departments'>('company');
  const [settings, setSettings] = useState(initialSettings);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([
    { id: '1', name: 'Beklemede', color: '#EAB308' },
    { id: '2', name: 'Üretimde', color: '#3B82F6' },
    { id: '3', name: 'Teslim Edildi', color: '#10B981' },
  ]);
  const [departments, setDepartments] = useState<Department[]>([
    { id: '1', name: 'Kesim', color: '#EF4444' },
    { id: '2', name: 'Dikim', color: '#8B5CF6' },
    { id: '3', name: 'Paketleme', color: '#F59E0B' },
  ]);

  const [newStatus, setNewStatus] = useState({ name: '', color: '#3B82F6' });
  const [newDepartment, setNewDepartment] = useState({ name: '', color: '#3B82F6' });

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setSettings({ ...settings, [field]: value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(settings);
  };

  const addStatus = () => {
    if (newStatus.name.trim()) {
      setCustomStatuses([...customStatuses, { ...newStatus, id: Date.now().toString() }]);
      setNewStatus({ name: '', color: '#3B82F6' });
    }
  };

  const removeStatus = (id: string) => {
    setCustomStatuses(customStatuses.filter(s => s.id !== id));
  };

  const addDepartment = () => {
    if (newDepartment.name.trim()) {
      setDepartments([...departments, { ...newDepartment, id: Date.now().toString() }]);
      setNewDepartment({ name: '', color: '#3B82F6' });
    }
  };

  const removeDepartment = (id: string) => {
    setDepartments(departments.filter(d => d.id !== id));
  };

  const tabs = [
    { id: 'company', label: 'Şirket Bilgileri' },
    { id: 'statuses', label: 'Sipariş Durumları' },
    { id: 'departments', label: 'Bölümler' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex p-1 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl overflow-x-auto whitespace-nowrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
            }`}
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg shadow-sm"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Company Settings Tab */}
        {activeTab === 'company' && (
          <motion.form 
            key="company"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit} 
            className="space-y-6"
          >
            <div className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/20">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-blue-600 dark:text-blue-400">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Şirket Bilgileri
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Resmi fatura ve iletişim bilgilerinizi güncelleyin.
                  </p>
                </div>
              </div>
              
              <div className="grid gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Şirket Adı"
                    value={settings.companyName}
                    onChange={(e) => handleChange('companyName', e.target.value)}
                    placeholder="Örn: Renk Tekstil Ltd. Şti."
                  />
                  <Input
                    label="Vergi Numarası"
                    value={settings.taxNumber}
                    onChange={(e) => handleChange('taxNumber', e.target.value)}
                    placeholder="10 haneli vergi numarası"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Adres
                  </label>
                  <textarea
                    value={settings.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all text-sm resize-none"
                    placeholder="Tam şirket adresi"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    label="Telefon"
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="0212 555 00 00"
                  />
                  <Input
                    label="E-posta"
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="info@renktekstil.com"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" className="pl-4 pr-6">
                <Save size={18} className="mr-2" />
                Değişiklikleri Kaydet
              </Button>
            </div>
          </motion.form>
        )}

        {/* Statuses Tab */}
        {activeTab === 'statuses' && (
          <motion.div 
            key="statuses"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/20">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                Sipariş Durumları
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                İş akışınızda kullandığınız özel durumları tanımlayın.
              </p>
              
              <div className="space-y-3 mb-8">
                {customStatuses.map((status) => (
                  <div key={status.id} className="group flex items-center gap-4 p-3 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-sky-200 dark:hover:border-sky-800/50 transition-colors">
                    <GripVertical className="text-slate-300 dark:text-slate-600 cursor-move" size={20} />
                    <div className="h-8 w-8 rounded-lg shadow-sm" style={{ backgroundColor: status.color }}></div>
                    <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">{status.name}</span>
                    <button
                      onClick={() => removeStatus(status.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={newStatus.name}
                  onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                  placeholder="Yeni durum adı"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
                <div className="relative w-14 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                   <input
                    type="color"
                    value={newStatus.color}
                    onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                  />
                </div>
                <Button onClick={addStatus} variant="secondary">
                  <Plus size={18} className="mr-2" />
                  Ekle
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Departments Tab */}
        {activeTab === 'departments' && (
          <motion.div 
            key="departments"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <div className="glass-panel p-6 rounded-2xl border border-white/20 dark:border-white/5 shadow-xl shadow-slate-200/20 dark:shadow-black/20">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                Fabrika Bölümleri
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                 Üretim hattınızdaki birimleri yönetin.
              </p>
              
              <div className="space-y-3 mb-8">
                {departments.map((dept) => (
                  <div key={dept.id} className="group flex items-center gap-4 p-3 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl hover:border-violet-200 dark:hover:border-violet-800/50 transition-colors">
                    <GripVertical className="text-slate-300 dark:text-slate-600 cursor-move" size={20} />
                    <div className="h-8 w-8 rounded-lg shadow-sm" style={{ backgroundColor: dept.color }}></div>
                    <span className="flex-1 font-medium text-slate-700 dark:text-slate-200">{dept.name}</span>
                    <button
                      onClick={() => removeDepartment(dept.id)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <input
                  type="text"
                  value={newDepartment.name}
                  onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                  placeholder="Yeni bölüm adı"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                />
                 <div className="relative w-14 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                   <input
                    type="color"
                    value={newDepartment.color}
                    onChange={(e) => setNewDepartment({ ...newDepartment, color: e.target.value })}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 border-0 cursor-pointer"
                  />
                </div>
                <Button onClick={addDepartment} variant="secondary">
                  <Plus size={18} className="mr-2" />
                  Ekle
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
