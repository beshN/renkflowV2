'use client';

import { useCallback, useMemo, useState } from 'react';
import { Order, OrderStatus } from '@/lib/types';
import { useOrdersStore, FilterPreset, OrderFilters, DatePreset } from '@/lib/stores/orders.store';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Calendar, 
  Tag, 
  User, 
  Package, 
  Banknote,
  X,
  ChevronDown,
  Save,
  Trash2,
  Filter,
  SlidersHorizontal
} from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/Badge';

interface SmartFilterPanelProps {
  uniqueCustomers: string[];
  uniqueProducts: string[];
}

const STATUS_OPTIONS: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Beklemede', color: 'bg-amber-500' },
  { value: 'in_production', label: 'Üretimde', color: 'bg-blue-500' },
  { value: 'delivered', label: 'Teslim Edildi', color: 'bg-emerald-500' },
];

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: 'yesterday', label: 'Dün' },
  { value: 'this_week', label: 'Bu Hafta' },
  { value: 'last_week', label: 'Geçen Hafta' },
  { value: 'this_month', label: 'Bu Ay' },
  { value: 'last_month', label: 'Geçen Ay' },
  { value: 'custom', label: 'Özel Aralık' },
];

export function SmartFilterPanel({ uniqueCustomers, uniqueProducts }: SmartFilterPanelProps) {
  const {
    filters,
    setFilters,
    resetFilters,
    filterPresets,
    saveFilterPreset,
    loadFilterPreset,
    deleteFilterPreset,
    activePresetId,
  } = useOrdersStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Get preset date range
  const getPresetDateRange = (preset: DatePreset): { from: Date; to: Date } => {
    const today = new Date();
    switch (preset) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday':
        const yesterday = subDays(today, 1);
        return { from: yesterday, to: yesterday };
      case 'this_week':
        return { from: startOfWeek(today, { locale: tr }), to: endOfWeek(today, { locale: tr }) };
      case 'last_week':
        const lastWeek = subDays(today, 7);
        return { from: startOfWeek(lastWeek, { locale: tr }), to: endOfWeek(lastWeek, { locale: tr }) };
      case 'this_month':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'last_month':
        const lastMonth = subDays(startOfMonth(today), 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      default:
        return { from: today, to: today };
    }
  };

  // Handle date preset selection
  const handleDatePresetChange = (preset: DatePreset) => {
    if (preset === 'custom') {
      setFilters({
        dateRange: { preset, from: null, to: null },
      });
    } else {
      const { from, to } = getPresetDateRange(preset);
      setFilters({
        dateRange: { preset, from, to },
      });
    }
  };

  // Handle status toggle
  const toggleStatus = (status: OrderStatus) => {
    const currentStatuses = filters.status;
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    setFilters({ status: newStatuses });
  };

  // Handle save preset
  const handleSavePreset = () => {
    if (presetName.trim()) {
      saveFilterPreset(presetName.trim());
      setPresetName('');
      setShowSaveDialog(false);
    }
  };

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.status.length > 0) count++;
    if (filters.customers.length > 0) count++;
    if (filters.products.length > 0) count++;
    if (filters.amountRange.min || filters.amountRange.max) count++;
    if (filters.dateRange.preset !== 'custom' || filters.dateRange.from) count++;
    return count;
  }, [filters]);

  return (
    <div className="glass-panel rounded-xl overflow-hidden shadow-sm">
      {/* Header - Quick Search & Toggle */}
      <div className="p-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Müşteri, ürün veya sipariş no ara..."
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            className="pl-10 h-10 bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm"
          />
          {filters.search && (
            <button
              onClick={() => setFilters({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'gap-2',
            activeFiltersCount > 0 && 'border-blue-500 text-blue-600'
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtreler
          {activeFiltersCount > 0 && (
            <Badge className="ml-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30">
              {activeFiltersCount}
            </Badge>
          )}
          <ChevronDown
            className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')}
          />
        </Button>

        {/* Saved Presets Dropdown */}
        {filterPresets.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Kaydedilmiş
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2" align="end">
              <div className="space-y-1">
                {filterPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className={cn(
                      'flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer',
                      activePresetId === preset.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <span onClick={() => loadFilterPreset(preset.id)} className="flex-1">
                      {preset.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFilterPreset(preset.id);
                      }}
                      className="p-1 hover:bg-red-100 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-slate-500">
            <X className="w-4 h-4 mr-1" />
            Temizle
          </Button>
        )}
      </div>

      {/* Expanded Filter Panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-200 dark:border-slate-800"
          >
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Durum
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((status) => (
                    <button
                      key={status.value}
                      onClick={() => toggleStatus(status.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-all',
                        filters.status.includes(status.value)
                          ? 'ring-2 ring-offset-1 dark:ring-offset-slate-900'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      )}
                      style={
                        filters.status.includes(status.value)
                          ? { backgroundColor: `${status.color}20`, color: status.color.replace('bg-', '') }
                          : undefined
                      }
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full inline-block mr-1', status.color)} />
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Tarih Aralığı
                </label>
                <select
                  value={filters.dateRange.preset}
                  onChange={(e) => handleDatePresetChange(e.target.value as DatePreset)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {DATE_PRESETS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </select>
                {filters.dateRange.preset === 'custom' && (
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          {filters.dateRange.from
                            ? format(filters.dateRange.from, 'dd MMM', { locale: tr })
                            : 'Başlangıç'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={filters.dateRange.from || undefined}
                          onSelect={(date: Date | undefined) =>
                            setFilters({
                              dateRange: { ...filters.dateRange, from: date || null },
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="flex-1 text-xs">
                          {filters.dateRange.to
                            ? format(filters.dateRange.to, 'dd MMM', { locale: tr })
                            : 'Bitiş'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={filters.dateRange.to || undefined}
                          onSelect={(date: Date | undefined) =>
                            setFilters({
                              dateRange: { ...filters.dateRange, to: date || null },
                            })
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>

              {/* Amount Range Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Banknote className="w-3 h-3" />
                  Tutar Aralığı
                </label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={filters.amountRange.min || ''}
                    onChange={(e) =>
                      setFilters({
                        amountRange: {
                          ...filters.amountRange,
                          min: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    className="h-9"
                  />
                  <span className="text-slate-400">-</span>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={filters.amountRange.max || ''}
                    onChange={(e) =>
                      setFilters({
                        amountRange: {
                          ...filters.amountRange,
                          max: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    className="h-9"
                  />
                </div>
              </div>

              {/* Customer Filter */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Müşteri
                </label>
                <select
                  multiple
                  value={filters.customers}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                    setFilters({ customers: selected });
                  }}
                  className="w-full h-20 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                >
                  {uniqueCustomers.map((customer) => (
                    <option key={customer} value={customer}>
                      {customer}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Save Preset Button */}
            <div className="px-4 pb-4 flex justify-end">
              {!showSaveDialog ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveDialog(true)}
                  className="gap-2"
                >
                  <Save className="w-4 h-4" />
                  Filtreyi Kaydet
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Filtre adı..."
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="h-9 w-48"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSavePreset}>
                    Kaydet
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>
                    İptal
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
