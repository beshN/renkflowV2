'use client';

/**
 * View Switcher Component
 * Toggle between different view modes with smooth transitions
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useViewStore } from '@/lib/stores/view.store';
import type { ViewType } from '@/lib/types/enterprise';
import {
  List,
  Kanban,
  Calendar,
  GanttChart,
  LayoutDashboard,
  Map,
  ChevronDown,
  Plus,
  Save,
  Settings,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

// ============================================
// Types
// ============================================

interface ViewOption {
  type: ViewType;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  description?: string;
}

interface ViewSwitcherProps {
  availableViews?: ViewType[];
  showLabels?: boolean;
  showDropdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// ============================================
// View Options
// ============================================

const VIEW_OPTIONS: ViewOption[] = [
  {
    type: 'list',
    label: 'Liste',
    icon: <List size={18} />,
    shortcut: 'Alt+1',
    description: 'Tablo görünümü ile sıralama ve filtreleme',
  },
  {
    type: 'board',
    label: 'Pano',
    icon: <Kanban size={18} />,
    shortcut: 'Alt+2',
    description: 'Kanban tarzı sürükle-bırak panosu',
  },
  {
    type: 'calendar',
    label: 'Takvim',
    icon: <Calendar size={18} />,
    shortcut: 'Alt+3',
    description: 'Tarih bazlı takvim görünümü',
  },
  {
    type: 'gantt',
    label: 'Gantt',
    icon: <GanttChart size={18} />,
    shortcut: 'Alt+4',
    description: 'Zaman çizelgesi ve bağımlılıklar',
  },
  {
    type: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} />,
    shortcut: 'Alt+5',
    description: 'Özelleştirilebilir widget paneli',
  },
  {
    type: 'map',
    label: 'Harita',
    icon: <Map size={18} />,
    shortcut: 'Alt+6',
    description: 'Konum bazlı harita görünümü',
  },
];

// ============================================
// Main Component
// ============================================

export function ViewSwitcher({
  availableViews = ['list', 'board', 'calendar', 'gantt', 'dashboard'],
  showLabels = true,
  showDropdown = true,
  size = 'md',
  className,
}: ViewSwitcherProps) {
  const { currentView, setView, savedViews, saveCurrentView } = useViewStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredOptions = VIEW_OPTIONS.filter((opt) =>
    availableViews.includes(opt.type)
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey) {
        const index = parseInt(event.key) - 1;
        if (index >= 0 && index < filteredOptions.length) {
          event.preventDefault();
          setView(filteredOptions[index].type);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredOptions, setView]);

  const handleSaveView = () => {
    if (viewName.trim()) {
      saveCurrentView(viewName.trim());
      setViewName('');
      setSaveDialogOpen(false);
    }
  };

  const sizeClasses = {
    sm: 'h-8 text-xs',
    md: 'h-10 text-sm',
    lg: 'h-12 text-base',
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
  };

  return (
    <div className={cn('relative flex items-center gap-1', className)} ref={dropdownRef}>
      {/* View Tabs */}
      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
        {filteredOptions.map((option) => {
          const isActive = currentView === option.type;
          return (
            <button
              key={option.type}
              onClick={() => setView(option.type)}
              className={cn(
                'relative flex items-center gap-2 px-3 rounded-md transition-all',
                sizeClasses[size],
                isActive
                  ? 'text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              )}
              title={`${option.label} (${option.shortcut})`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeViewTab"
                  className="absolute inset-0 bg-blue-600 rounded-md"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {option.icon}
                {showLabels && <span className="font-medium">{option.label}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className={cn(
              'flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors',
              sizeClasses[size],
              'w-10'
            )}
          >
            <ChevronDown
              size={iconSizes[size]}
              className={cn('text-slate-500 transition-transform', dropdownOpen && 'rotate-180')}
            />
          </button>

          {/* Dropdown Content */}
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50"
            >
              {/* View Options with Descriptions */}
              <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                  Görünümler
                </p>
                {VIEW_OPTIONS.map((option) => {
                  const isActive = currentView === option.type;
                  const isAvailable = availableViews.includes(option.type);
                  return (
                    <button
                      key={option.type}
                      onClick={() => {
                        if (isAvailable) {
                          setView(option.type);
                          setDropdownOpen(false);
                        }
                      }}
                      disabled={!isAvailable}
                      className={cn(
                        'w-full flex items-start gap-3 p-2 rounded-lg transition-colors text-left',
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                        !isAvailable && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5',
                          isActive ? 'text-blue-600' : 'text-slate-500'
                        )}
                      >
                        {option.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              'font-medium',
                              isActive
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-slate-900 dark:text-white'
                            )}
                          >
                            {option.label}
                          </span>
                          <span className="text-xs text-slate-400">
                            {option.shortcut}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Saved Views */}
              {savedViews.length > 0 && (
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <p className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase">
                    Kayıtlı Görünümler
                  </p>
                  {savedViews.map((view, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setView(view.type);
                        setDropdownOpen(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-left"
                    >
                      <span className="text-slate-500">
                        {VIEW_OPTIONS.find((o) => o.type === view.type)?.icon}
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {view.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="p-2">
                <button
                  onClick={() => {
                    setSaveDialogOpen(true);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <Save size={16} />
                  <span>Görünümü Kaydet</span>
                </button>
                <button
                  onClick={() => setDropdownOpen(false)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                >
                  <Settings size={16} />
                  <span>Görünüm Ayarları</span>
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}

      {/* Save View Dialog */}
      {saveDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-slate-900 rounded-xl p-6 w-96 shadow-2xl"
          >
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Görünümü Kaydet
            </h3>
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Görünüm adı..."
              className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveView();
                if (e.key === 'Escape') setSaveDialogOpen(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setSaveDialogOpen(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                İptal
              </button>
              <button
                onClick={handleSaveView}
                disabled={!viewName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kaydet
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Compact View Switcher (for mobile/sidebar)
// ============================================

export function CompactViewSwitcher({
  availableViews = ['list', 'board', 'calendar', 'gantt'],
  className,
}: {
  availableViews?: ViewType[];
  className?: string;
}) {
  const { currentView, setView } = useViewStore();

  const filteredOptions = VIEW_OPTIONS.filter((opt) =>
    availableViews.includes(opt.type)
  );

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {filteredOptions.map((option) => {
        const isActive = currentView === option.type;
        return (
          <button
            key={option.type}
            onClick={() => setView(option.type)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isActive
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
            title={option.label}
          >
            {option.icon}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// View Indicator (shows current view)
// ============================================

export function ViewIndicator({ className }: { className?: string }) {
  const { currentView } = useViewStore();
  const option = VIEW_OPTIONS.find((o) => o.type === currentView);

  if (!option) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg',
        className
      )}
    >
      <span className="text-slate-500">{option.icon}</span>
      <span className="text-sm font-medium text-slate-900 dark:text-white">
        {option.label}
      </span>
    </div>
  );
}
