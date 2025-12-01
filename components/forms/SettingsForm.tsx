'use client';

import { useState } from 'react';
import { CompanySettings } from '@/lib/types';
import { Button } from '../ui/Button';

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

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-border-light dark:border-border-dark">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('company')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'company'
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
          >
            Şirket Bilgileri
          </button>
          <button
            onClick={() => setActiveTab('statuses')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'statuses'
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
          >
            Sipariş Durumları
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'departments'
                ? 'border-primary text-primary'
                : 'border-transparent text-subtle-light dark:text-subtle-dark hover:text-text-light dark:hover:text-text-dark'
            }`}
          >
            Bölümler
          </button>
        </div>
      </div>

      {/* Company Settings Tab */}
      {activeTab === 'company' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              Şirket Bilgileri
            </h3>
            
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                  Şirket Adı
                </label>
                <input
                  type="text"
                  value={settings.companyName}
                  onChange={(e) => handleChange('companyName', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                  Vergi Numarası
                </label>
                <input
                  type="text"
                  value={settings.taxNumber}
                  onChange={(e) => handleChange('taxNumber', e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                  Adres
                </label>
                <textarea
                  value={settings.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={settings.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary">
              Değişiklikleri Kaydet
            </Button>
          </div>
        </form>
      )}

      {/* Statuses Tab */}
      {activeTab === 'statuses' && (
        <div className="space-y-6">
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              Sipariş Durumları
            </h3>
            
            <div className="space-y-3 mb-6">
              {customStatuses.map((status) => (
                <div key={status.id} className="flex items-center gap-3 p-3 bg-background-light dark:bg-background-dark rounded-lg">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: status.color }}></div>
                  <span className="flex-1 text-text-light dark:text-text-dark">{status.name}</span>
                  <button
                    onClick={() => removeStatus(status.id)}
                    className="p-2 text-subtle-light dark:text-subtle-dark hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
              <input
                type="text"
                value={newStatus.name}
                onChange={(e) => setNewStatus({ ...newStatus, name: e.target.value })}
                placeholder="Yeni durum adı"
                className="flex-1 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
              />
              <input
                type="color"
                value={newStatus.color}
                onChange={(e) => setNewStatus({ ...newStatus, color: e.target.value })}
                className="w-16 h-10 rounded-lg border border-border-light dark:border-border-dark"
              />
              <Button onClick={addStatus} variant="primary">
                Ekle
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          <div className="bg-card-light dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
            <h3 className="text-lg font-semibold text-text-light dark:text-text-dark mb-4">
              Fabrika Bölümleri
            </h3>
            
            <div className="space-y-3 mb-6">
              {departments.map((dept) => (
                <div key={dept.id} className="flex items-center gap-3 p-3 bg-background-light dark:bg-background-dark rounded-lg">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: dept.color }}></div>
                  <span className="flex-1 text-text-light dark:text-text-dark">{dept.name}</span>
                  <button
                    onClick={() => removeDepartment(dept.id)}
                    className="p-2 text-subtle-light dark:text-subtle-dark hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
              <input
                type="text"
                value={newDepartment.name}
                onChange={(e) => setNewDepartment({ ...newDepartment, name: e.target.value })}
                placeholder="Yeni bölüm adı"
                className="flex-1 px-4 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark"
              />
              <input
                type="color"
                value={newDepartment.color}
                onChange={(e) => setNewDepartment({ ...newDepartment, color: e.target.value })}
                className="w-16 h-10 rounded-lg border border-border-light dark:border-border-dark"
              />
              <Button onClick={addDepartment} variant="primary">
                Ekle
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
