'use client';

/**
 * Command Palette (Cmd+K)
 * Quick actions and search
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// Types
// ============================================

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  shortcut?: string;
  category: 'navigation' | 'action' | 'filter' | 'view';
  action: () => void;
}

// ============================================
// Command Palette Component
// ============================================

export const CommandPalette: React.FC = () => {
  const router = useRouter();
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    setViewMode,
    setSearch,
    resetFilters,
    addStatusFilter,
    toggleSidebar,
  } = useOrdersStore();

  const [search, setLocalSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Define commands
  const commands: Command[] = useMemo(() => [
    // Navigation
    {
      id: 'nav-orders',
      label: 'Siparişlere Git',
      icon: 'list_alt',
      shortcut: 'G O',
      category: 'navigation',
      action: () => router.push('/orders'),
    },
    {
      id: 'nav-new-order',
      label: 'Yeni Sipariş Oluştur',
      icon: 'add_circle',
      shortcut: 'Ctrl+N',
      category: 'navigation',
      action: () => router.push('/orders/new'),
    },
    {
      id: 'nav-dashboard',
      label: 'Dashboard\'a Git',
      icon: 'dashboard',
      shortcut: 'G D',
      category: 'navigation',
      action: () => router.push('/dashboard'),
    },
    {
      id: 'nav-customers',
      label: 'Müşterilere Git',
      icon: 'people',
      shortcut: 'G C',
      category: 'navigation',
      action: () => router.push('/customers'),
    },

    // View modes
    {
      id: 'view-grid',
      label: 'Grid Görünümü',
      description: 'Tablo formatında görüntüle',
      icon: 'grid_view',
      category: 'view',
      action: () => setViewMode('grid'),
    },
    {
      id: 'view-kanban',
      label: 'Kanban Görünümü',
      description: 'Duruma göre kartlar',
      icon: 'view_kanban',
      category: 'view',
      action: () => setViewMode('kanban'),
    },
    {
      id: 'view-calendar',
      label: 'Takvim Görünümü',
      description: 'Tarihe göre görüntüle',
      icon: 'calendar_month',
      category: 'view',
      action: () => setViewMode('calendar'),
    },
    {
      id: 'view-timeline',
      label: 'Timeline Görünümü',
      description: 'Gantt benzeri görünüm',
      icon: 'timeline',
      category: 'view',
      action: () => setViewMode('timeline'),
    },

    // Filters
    {
      id: 'filter-pending',
      label: 'Bekleyen Siparişleri Göster',
      icon: 'pending_actions',
      category: 'filter',
      action: () => {
        resetFilters();
        addStatusFilter('pending');
      },
    },
    {
      id: 'filter-production',
      label: 'Üretimdeki Siparişleri Göster',
      icon: 'precision_manufacturing',
      category: 'filter',
      action: () => {
        resetFilters();
        addStatusFilter('in_production');
      },
    },
    {
      id: 'filter-delivered',
      label: 'Teslim Edilen Siparişleri Göster',
      icon: 'check_circle',
      category: 'filter',
      action: () => {
        resetFilters();
        addStatusFilter('delivered');
      },
    },
    {
      id: 'filter-clear',
      label: 'Filtreleri Temizle',
      icon: 'filter_alt_off',
      shortcut: 'Ctrl+Shift+F',
      category: 'filter',
      action: () => resetFilters(),
    },

    // Actions
    {
      id: 'action-toggle-sidebar',
      label: 'Filtre Panelini Aç/Kapat',
      icon: 'side_navigation',
      shortcut: 'Ctrl+B',
      category: 'action',
      action: () => toggleSidebar(),
    },
    {
      id: 'action-export',
      label: 'Dışa Aktar',
      icon: 'download',
      shortcut: 'Ctrl+Shift+E',
      category: 'action',
      action: () => {
        // Trigger export dialog
      },
    },
    {
      id: 'action-print',
      label: 'Yazdır',
      icon: 'print',
      shortcut: 'Ctrl+P',
      category: 'action',
      action: () => window.print(),
    },
    {
      id: 'action-refresh',
      label: 'Yenile',
      icon: 'refresh',
      shortcut: 'Ctrl+R',
      category: 'action',
      action: () => window.location.reload(),
    },
  ], [router, setViewMode, resetFilters, addStatusFilter, toggleSidebar]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lower = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lower) ||
        cmd.description?.toLowerCase().includes(lower)
    );
  }, [commands, search]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {
      navigation: [],
      view: [],
      filter: [],
      action: [],
    };
    filteredCommands.forEach((cmd) => {
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isCommandPaletteOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
          setCommandPaletteOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setCommandPaletteOpen(false);
        break;
    }
  }, [isCommandPaletteOpen, filteredCommands, selectedIndex, setCommandPaletteOpen]);

  // Listen for keyboard events
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Reset search and selection when opening
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setLocalSearch('');
      setSelectedIndex(0);
    }
  }, [isCommandPaletteOpen]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Gezinme',
    view: 'Görünüm',
    filter: 'Filtreler',
    action: 'İşlemler',
  };

  if (!isCommandPaletteOpen) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setCommandPaletteOpen(false)}
      />

      {/* Palette */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="material-symbols-outlined text-gray-400">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Komut ara veya yaz..."
            className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded">
            ESC
          </kbd>
        </div>

        {/* Commands List */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
              <p>Sonuç bulunamadı</p>
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds]) => {
              if (cmds.length === 0) return null;

              return (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {categoryLabels[category]}
                  </div>
                  {cmds.map((cmd) => {
                    flatIndex++;
                    const isSelected = flatIndex === selectedIndex;

                    return (
                      <button
                        key={cmd.id}
                        onClick={() => {
                          cmd.action();
                          setCommandPaletteOpen(false);
                        }}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                        className={cn(
                          'flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors',
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        )}
                      >
                        <span className={cn(
                          'material-symbols-outlined text-xl',
                          isSelected ? 'text-blue-600' : 'text-gray-400'
                        )}>
                          {cmd.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {cmd.label}
                          </div>
                          {cmd.description && (
                            <div className="text-xs text-gray-500 truncate">
                              {cmd.description}
                            </div>
                          )}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 rounded">
                            {cmd.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑↓</kbd>
              gezin
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↵</kbd>
              seç
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">esc</kbd>
              kapat
            </span>
          </div>
          <span>⌘K ile aç</span>
        </div>
      </motion.div>
    </div>
  );
};

export default CommandPalette;
