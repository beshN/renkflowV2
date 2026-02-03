'use client';

/**
 * Advanced Filtering Sidebar
 * Date range, multi-select, amount slider, saved presets
 */

import React, { useState, useMemo } from 'react';
import { useOrdersStore, DatePreset, OrderFilters } from '@/lib/stores/orders.store';
import { OrderStatus } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { FilterPresets } from './FilterPresets';
import { 
  Filter, 
  X, 
  Search, 
  Bookmark, 
  Trash2, 
  Check, 
  Plus, 
  Calendar, 
  ListChecks, 
  DollarSign, 
  Users, 
  Package, 
  ChevronDown,
  RotateCcw
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface FilterSidebarProps {
  customers: string[];
  products: string[];
}

// ============================================
// Date Presets
// ============================================

const datePresets: { value: DatePreset; label: string; getRange: () => { from: Date; to: Date } }[] = [
  {
    value: 'today',
    label: 'Bugün',
    getRange: () => ({ from: new Date(), to: new Date() }),
  },
  {
    value: 'yesterday',
    label: 'Dün',
    getRange: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }),
  },
  {
    value: 'this_week',
    label: 'Bu Hafta',
    getRange: () => ({ from: startOfWeek(new Date(), { locale: tr }), to: endOfWeek(new Date(), { locale: tr }) }),
  },
  {
    value: 'last_week',
    label: 'Geçen Hafta',
    getRange: () => ({
      from: startOfWeek(subDays(new Date(), 7), { locale: tr }),
      to: endOfWeek(subDays(new Date(), 7), { locale: tr }),
    }),
  },
  {
    value: 'this_month',
    label: 'Bu Ay',
    getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }),
  },
  {
    value: 'last_month',
    label: 'Geçen Ay',
    getRange: () => ({
      from: startOfMonth(subDays(new Date(), 30)),
      to: endOfMonth(subDays(new Date(), 30)),
    }),
  },
];

// ============================================
// Status Options
// ============================================

const statusOptions: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Beklemede', color: 'bg-yellow-500' },
  { value: 'in_production', label: 'Üretimde', color: 'bg-blue-500' },
  { value: 'delivered', label: 'Teslim Edildi', color: 'bg-green-500' },
];

// ============================================
// Filter Chip
// ============================================

const FilterChip: React.FC<{
  label: string;
  onRemove: () => void;
}> = ({ label, onRemove }) => (
  <motion.span
    initial={{ scale: 0.8, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0.8, opacity: 0 }}
    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full"
  >
    {label}
    <button
      onClick={onRemove}
      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
    >
      <X size={12} />
    </button>
  </motion.span>
);

// ============================================
// Collapsible Section
// ============================================

const FilterSection: React.FC<{
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon: Icon, defaultOpen = true, children }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-gray-500" />
          <span className="font-medium text-sm text-gray-900 dark:text-white">{title}</span>
        </div>
        <ChevronDown 
          size={20} 
          className={cn(
            'text-gray-400 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// Multi-Select with Search
// ============================================

const MultiSelectSearch: React.FC<{
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}> = ({ options, selected, onChange, placeholder }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter((opt) =>
      opt.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

// ... inside MultiSelectSearch FC
// ...
  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"
      >
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {selected.length > 0 ? `${selected.length} seçildi` : placeholder}
        </span>
        <ChevronDown size={20} className="text-gray-400" />
      </div>

      <AnimatePresence>
// ...
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-hidden"
          >
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara..."
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="max-h-40 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">Sonuç bulunamadı</div>
              ) : (
                filteredOptions.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(option)}
                      onChange={() => toggleOption(option)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{option}</span>
                  </label>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// Amount Range Slider
// ============================================

const AmountRangeSlider: React.FC<{
  min: number;
  max: number;
  value: { min: number | null; max: number | null };
  onChange: (min: number | null, max: number | null) => void;
}> = ({ min, max, value, onChange }) => {
  const [localMin, setLocalMin] = useState(value.min ?? min);
  const [localMax, setLocalMax] = useState(value.max ?? max);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalMin(val);
    onChange(val === min ? null : val, localMax === max ? null : localMax);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setLocalMax(val);
    onChange(localMin === min ? null : localMin, val === max ? null : val);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Min</label>
          <input
            type="number"
            value={localMin}
            onChange={handleMinChange}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <span className="text-gray-400 mt-5">—</span>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Max</label>
          <input
            type="number"
            value={localMax}
            onChange={handleMaxChange}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={localMin}
        onChange={handleMinChange}
        className="w-full accent-blue-600"
      />
    </div>
  );
};

// ============================================
// Main Filter Sidebar
// ============================================

export const FilterSidebar: React.FC<FilterSidebarProps> = ({
  customers,
  products,
}) => {
  const {
    filters,
    filterPresets,
    activePresetId,
    setFilters,
    resetFilters,
    setDateRange,
    addStatusFilter,
    removeStatusFilter,
    setAmountRange,
    setSearch,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    isSidebarOpen,
    toggleSidebar,
  } = useOrdersStore();

  const [presetName, setPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count++;
    if (filters.dateRange.preset !== 'this_month') count++;
    if (filters.amountRange.min !== null || filters.amountRange.max !== null) count++;
    if (filters.customers.length > 0) count++;
    if (filters.products.length > 0) count++;
    return count;
  }, [filters]);

  // Get active filter chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (filters.search) {
      chips.push({
        key: 'search',
        label: `"${filters.search}"`,
        onRemove: () => setSearch(''),
      });
    }

    filters.status.forEach((status) => {
      const option = statusOptions.find((o) => o.value === status);
      chips.push({
        key: `status-${status}`,
        label: option?.label || status,
        onRemove: () => removeStatusFilter(status),
      });
    });

    if (filters.dateRange.preset !== 'this_month') {
      const preset = datePresets.find((p) => p.value === filters.dateRange.preset);
      chips.push({
        key: 'date',
        label: preset?.label || 'Özel Tarih',
        onRemove: () => setDateRange('this_month'),
      });
    }

    if (filters.amountRange.min !== null || filters.amountRange.max !== null) {
      chips.push({
        key: 'amount',
        label: `₺${filters.amountRange.min || 0} - ₺${filters.amountRange.max || '∞'}`,
        onRemove: () => setAmountRange(null, null),
      });
    }

    filters.customers.forEach((customer) => {
      chips.push({
        key: `customer-${customer}`,
        label: customer,
        onRemove: () => setFilters({ customers: filters.customers.filter((c) => c !== customer) }),
      });
    });

    filters.products.forEach((product) => {
      chips.push({
        key: `product-${product}`,
        label: product,
        onRemove: () => setFilters({ products: filters.products.filter((p) => p !== product) }),
      });
    });

    return chips;
  }, [filters, setSearch, removeStatusFilter, setDateRange, setAmountRange, setFilters]);

  const handleSavePreset = () => {
    if (presetName.trim()) {
      saveFilterPreset(presetName.trim());
      setPresetName('');
      setShowSavePreset(false);
    }
  };

  if (!isSidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="fixed left-0 top-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-lg p-2 shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 z-20"
      >
        <Filter size={24} />
        {activeFilterCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
            {activeFilterCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <motion.aside
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Filter size={20} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900 dark:text-white">Filtreler</h2>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
              title="Filtreleri Temizle"
            >
              <RotateCcw size={18} />
            </button>
          )}
          <button
            onClick={toggleSidebar}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Active Filter Chips */}
      {activeChips.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {activeChips.map((chip) => (
                <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sipariş, müşteri, ürün ara..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Saved Presets */}
        <FilterSection title="Kayıtlı Filtreler" icon={Bookmark} defaultOpen={filterPresets.length > 0}>
          <div className="space-y-2">
            {filterPresets.map((preset) => (
              <div
                key={preset.id}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors',
                  activePresetId === preset.id
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
                onClick={() => loadFilterPreset(preset.id)}
              >
                <span className="text-sm text-gray-900 dark:text-white">{preset.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFilterPreset(preset.id);
                  }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {showSavePreset ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Preset adı..."
                  className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  onClick={handleSavePreset}
                  className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setShowSavePreset(false)}
                  className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSavePreset(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
              >
                <Plus size={16} />
                Mevcut filtreleri kaydet
              </button>
            )}
          </div>
        </FilterSection>

        {/* Date Range */}
        <FilterSection title="Tarih Aralığı" icon={Calendar}>
          <div className="grid grid-cols-2 gap-2">
            {datePresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => {
                  const range = preset.getRange();
                  setDateRange(preset.value, range.from, range.to);
                }}
                className={cn(
                  'px-3 py-2 text-sm rounded-lg transition-colors',
                  filters.dateRange.preset === preset.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Başlangıç</label>
              <input
                type="date"
                value={filters.dateRange.from ? format(filters.dateRange.from, 'yyyy-MM-dd') : ''}
                onChange={(e) => setDateRange('custom', new Date(e.target.value), filters.dateRange.to || undefined)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Bitiş</label>
              <input
                type="date"
                value={filters.dateRange.to ? format(filters.dateRange.to, 'yyyy-MM-dd') : ''}
                onChange={(e) => setDateRange('custom', filters.dateRange.from || undefined, new Date(e.target.value))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </FilterSection>

        {/* Filter Presets */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <FilterPresets variant="sidebar" />
        </div>

        {/* Status */}
        <FilterSection title="Durum" icon={ListChecks}>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={filters.status.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      addStatusFilter(option.value);
                    } else {
                      removeStatusFilter(option.value);
                    }
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className={cn('w-3 h-3 rounded-full', option.color)} />
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </FilterSection>

        {/* Amount Range */}
        <FilterSection title="Tutar Aralığı" icon={DollarSign}>
          <AmountRangeSlider
            min={0}
            max={100000}
            value={filters.amountRange}
            onChange={setAmountRange}
          />
        </FilterSection>

        {/* Customers */}
        <FilterSection title="Müşteriler" icon={Users}>
          <MultiSelectSearch
            options={customers}
            selected={filters.customers}
            onChange={(selected) => setFilters({ customers: selected })}
            placeholder="Müşteri seç..."
          />
        </FilterSection>

        {/* Products */}
        <FilterSection title="Ürünler" icon={Package}>
          <MultiSelectSearch
            options={products}
            selected={filters.products}
            onChange={(selected) => setFilters({ products: selected })}
            placeholder="Ürün seç..."
          />
        </FilterSection>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={resetFilters}
          className="w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          Tüm Filtreleri Temizle
        </button>
      </div>
    </motion.aside>
  );
};

export default FilterSidebar;
