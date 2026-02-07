'use client';

/**
 * FilterPresets - Professional saved filter configurations
 * 
 * Features:
 * - Save current filter state as preset
 * - Quick apply saved presets
 * - Share presets with team
 * - Default system presets
 * - Local storage persistence
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrdersStore, OrderFilters } from '@/lib/stores/orders.store';
import { cn } from '@/lib/utils';
import {
  Bookmark,
  BookmarkCheck,
  Plus,
  Trash2,
  Share2,
  Clock,
  Package,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Star,
  StarOff,
  MoreVertical,
  Edit2,
  Copy,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  filters: Partial<OrderFilters>;
  isSystem?: boolean;
  isFavorite?: boolean;
  createdAt: string;
  usageCount: number;
}

interface FilterPresetsProps {
  variant?: 'dropdown' | 'sidebar' | 'inline';
  onPresetApply?: (preset: FilterPreset) => void;
}

// ============================================
// Default System Presets
// ============================================

const systemPresets: FilterPreset[] = [
  {
    id: 'system-pending',
    name: 'Bekleyen Siparişler',
    description: 'Onay bekleyen tüm siparişler',
    icon: 'clock',
    filters: { status: ['pending'] },
    isSystem: true,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'system-production',
    name: 'Üretimdekiler',
    description: 'Aktif üretim sürecindeki siparişler',
    icon: 'package',
    filters: { status: ['in_production'] },
    isSystem: true,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'system-overdue',
    name: 'Geciken Siparişler',
    description: 'Teslim tarihi geçmiş siparişler',
    icon: 'alert',
    filters: { 
      status: ['pending', 'in_production'],
      // Note: Overdue logic would be handled in the filter application
    },
    isSystem: true,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'system-today',
    name: 'Bugünkü Siparişler',
    description: 'Bugün oluşturulan siparişler',
    icon: 'calendar',
    filters: { 
      dateRange: { preset: 'today', from: null, to: null }
    },
    isSystem: true,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'system-high-value',
    name: 'Yüksek Değerli',
    description: '10.000₺ üzeri siparişler',
    icon: 'trending',
    filters: { amountRange: { min: 10000, max: null } },
    isSystem: true,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
];

// ============================================
// Preset Icon Component
// ============================================

const PresetIcon: React.FC<{ icon?: string; className?: string }> = ({ icon, className }) => {
  const iconMap: Record<string, React.ReactNode> = {
    clock: <Clock className={className} />,
    package: <Package className={className} />,
    alert: <AlertTriangle className={className} />,
    calendar: <Clock className={className} />,
    trending: <CheckCircle2 className={className} />,
    filter: <Filter className={className} />,
    bookmark: <Bookmark className={className} />,
  };

  return <>{iconMap[icon || 'filter'] || <Filter className={className} />}</>;
};

// ============================================
// Storage Utils
// ============================================

const STORAGE_KEY = 'renkflow_filter_presets';

const loadPresets = (): FilterPreset[] => {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const savePresets = (presets: FilterPreset[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save presets:', e);
  }
};

// ============================================
// Create Preset Modal
// ============================================

const CreatePresetModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description?: string) => void;
  currentFilters: OrderFilters;
}> = ({ isOpen, onClose, onSave, currentFilters }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), description.trim() || undefined);
      setName('');
      setDescription('');
      onClose();
    }
  };

  if (!isOpen) return null;

  const activeFiltersCount = Object.values(currentFilters).filter(v => 
    v !== undefined && v !== null && v !== '' && 
    !(Array.isArray(v) && v.length === 0)
  ).length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
          className="w-full max-w-md glass-panel shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Filtre Kaydet
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              {activeFiltersCount} aktif filtre kaydedilecek
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preset Adı *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Acil Siparişler"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Açıklama (Opsiyonel)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Bu preset ne için kullanılıyor?"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                Kaydet
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============================================
// Preset Card Component
// ============================================

const PresetCard: React.FC<{
  preset: FilterPreset;
  isActive: boolean;
  onApply: () => void;
  onDelete?: () => void;
  onToggleFavorite?: () => void;
  onDuplicate?: () => void;
}> = ({ preset, isActive, onApply, onDelete, onToggleFavorite, onDuplicate }) => {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        'group relative p-3 rounded-xl border transition-all cursor-pointer backdrop-blur-sm',
        isActive
          ? 'bg-blue-50/60 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/50'
          : 'bg-white/40 dark:bg-gray-800/40 border-gray-200/50 dark:border-gray-700/50 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:border-gray-300 dark:hover:border-gray-600'
      )}
      onClick={onApply}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isActive
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
        )}>
          <PresetIcon icon={preset.icon} className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'font-medium text-sm truncate',
              isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
            )}>
              {preset.name}
            </span>
            {preset.isSystem && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 rounded">
                SİSTEM
              </span>
            )}
            {preset.isFavorite && (
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            )}
          </div>
          {preset.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {preset.description}
            </p>
          )}
        </div>

        {/* Actions Menu */}
        {!preset.isSystem && (
          <div className="relative">
            <button
              onClick={(e: React.MouseEvent<HTMLElement>) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-all"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10"
                  onClick={(e: React.MouseEvent<HTMLElement>) => e.stopPropagation()}
                >
                  <button
                    onClick={() => { onToggleFavorite?.(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {preset.isFavorite ? <StarOff className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                    {preset.isFavorite ? 'Favoriden Çıkar' : 'Favorilere Ekle'}
                  </button>
                  <button
                    onClick={() => { onDuplicate?.(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <Copy className="w-4 h-4" />
                    Kopyala
                  </button>
                  <button
                    onClick={() => { onDelete?.(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    Sil
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Usage indicator */}
      {preset.usageCount > 0 && (
        <div className="mt-2 text-[10px] text-gray-400">
          {preset.usageCount} kez kullanıldı
        </div>
      )}
    </motion.div>
  );
};

// ============================================
// Main Component
// ============================================

export function FilterPresets({ variant = 'sidebar', onPresetApply }: FilterPresetsProps) {
  const { filters, setFilters, resetFilters } = useOrdersStore();
  const [userPresets, setUserPresets] = useState<FilterPreset[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // Load presets from storage
  useEffect(() => {
    setUserPresets(loadPresets());
  }, []);

  // All presets (system + user)
  const allPresets = useMemo(() => {
    const favorites = [...systemPresets, ...userPresets].filter(p => p.isFavorite);
    const nonFavorites = [...systemPresets, ...userPresets].filter(p => !p.isFavorite);
    return [...favorites, ...nonFavorites];
  }, [userPresets]);

  // Apply preset
  const applyPreset = (preset: FilterPreset) => {
    setFilters(preset.filters as OrderFilters);
    setActivePresetId(preset.id);
    
    // Update usage count
    if (!preset.isSystem) {
      const updated = userPresets.map(p => 
        p.id === preset.id ? { ...p, usageCount: p.usageCount + 1 } : p
      );
      setUserPresets(updated);
      savePresets(updated);
    }

    onPresetApply?.(preset);
  };

  // Save new preset
  const saveNewPreset = (name: string, description?: string) => {
    const newPreset: FilterPreset = {
      id: `user-${Date.now()}`,
      name,
      description,
      icon: 'bookmark',
      filters: { ...filters },
      isSystem: false,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    const updated = [...userPresets, newPreset];
    setUserPresets(updated);
    savePresets(updated);
    setActivePresetId(newPreset.id);
  };

  // Delete preset
  const deletePreset = (id: string) => {
    const updated = userPresets.filter(p => p.id !== id);
    setUserPresets(updated);
    savePresets(updated);
    if (activePresetId === id) setActivePresetId(null);
  };

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    const updated = userPresets.map(p =>
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    );
    setUserPresets(updated);
    savePresets(updated);
  };

  // Duplicate preset
  const duplicatePreset = (preset: FilterPreset) => {
    const newPreset: FilterPreset = {
      ...preset,
      id: `user-${Date.now()}`,
      name: `${preset.name} (Kopya)`,
      isSystem: false,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    const updated = [...userPresets, newPreset];
    setUserPresets(updated);
    savePresets(updated);
  };

  // Clear filters
  const clearFilters = () => {
    resetFilters();
    setActivePresetId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Bookmark className="w-4 h-4" />
          Filtre Presetleri
        </h3>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          title="Yeni Preset Oluştur"
        >
          <Plus className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Active Filter Indicator */}
      {activePresetId && (
        <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <span className="text-xs text-blue-600 dark:text-blue-400">
            Aktif: {allPresets.find(p => p.id === activePresetId)?.name}
          </span>
          <button
            onClick={clearFilters}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Temizle
          </button>
        </div>
      )}

      {/* Presets List */}
      <div className="space-y-2">
        <AnimatePresence>
          {allPresets.map((preset) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={activePresetId === preset.id}
              onApply={() => applyPreset(preset)}
              onDelete={preset.isSystem ? undefined : () => deletePreset(preset.id)}
              onToggleFavorite={preset.isSystem ? undefined : () => toggleFavorite(preset.id)}
              onDuplicate={() => duplicatePreset(preset)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Create Modal */}
      <CreatePresetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={saveNewPreset}
        currentFilters={filters}
      />
    </div>
  );
}

export default FilterPresets;
