'use client';

/**
 * Keyboard Shortcuts Hook
 * Global keyboard shortcuts for the application
 */

import { useEffect, useCallback } from 'react';
import { useOrdersStore } from '@/lib/stores/orders.store';
import { useRouter } from 'next/navigation';

interface ShortcutHandler {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: () => void;
  description: string;
}

interface KeyboardShortcutOptions {
  onBulkDelete?: (ids: string[]) => void | Promise<void>;
  onExport?: () => void;
}

export const useKeyboardShortcuts = (options: KeyboardShortcutOptions = {}) => {
  const router = useRouter();
  const {
    setCommandPaletteOpen,
    toggleSidebar,
    setViewMode,
    clearSelection,
    selectedIds,
    bulkDelete,
  } = useOrdersStore();

  const shortcuts: ShortcutHandler[] = [
    // Command Palette
    {
      key: 'k',
      meta: true,
      action: () => setCommandPaletteOpen(true),
      description: 'Komut paletini aç',
    },
    {
      key: 'k',
      ctrl: true,
      action: () => setCommandPaletteOpen(true),
      description: 'Komut paletini aç',
    },

    // Navigation
    {
      key: 'n',
      ctrl: true,
      action: () => router.push('/orders/new'),
      description: 'Yeni sipariş oluştur',
    },

    // View modes
    {
      key: '1',
      alt: true,
      action: () => setViewMode('grid'),
      description: 'Grid görünümü',
    },
    {
      key: '2',
      alt: true,
      action: () => setViewMode('kanban'),
      description: 'Kanban görünümü',
    },
    {
      key: '3',
      alt: true,
      action: () => setViewMode('calendar'),
      description: 'Takvim görünümü',
    },
    {
      key: '4',
      alt: true,
      action: () => setViewMode('timeline'),
      description: 'Timeline görünümü',
    },

    // UI toggles
    {
      key: 'b',
      ctrl: true,
      action: () => toggleSidebar(),
      description: 'Filtre panelini aç/kapat',
    },

    // Selection
    {
      key: 'Escape',
      action: () => clearSelection(),
      description: 'Seçimi temizle',
    },

    // Delete
    {
      key: 'Delete',
      action: () => {
        if (selectedIds.size > 0) {
          if (options.onBulkDelete) {
            options.onBulkDelete(Array.from(selectedIds));
          } else {
            bulkDelete(Array.from(selectedIds));
          }
        }
      },
      description: 'Seçili siparişleri sil',
    },
    {
      key: 'Backspace',
      action: () => {
        if (selectedIds.size > 0) {
          if (options.onBulkDelete) {
            options.onBulkDelete(Array.from(selectedIds));
          } else {
            bulkDelete(Array.from(selectedIds));
          }
        }
      },
      description: 'Seçili siparişleri sil',
    },

    // Export
    {
      key: 'e',
      ctrl: true,
      shift: true,
      action: () => {
        if (options.onExport) {
          options.onExport();
        } else {
          console.log('Export triggered');
        }
      },
      description: 'Dışa aktar',
    },

    // Print
    {
      key: 'p',
      ctrl: true,
      action: () => {
        window.print();
      },
      description: 'Yazdır',
    },
  ];

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true'
    ) {
      // Allow Escape in inputs
      if (event.key !== 'Escape') {
        return;
      }
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey;
      const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.alt ? event.altKey : !event.altKey;
      const metaMatch = shortcut.meta ? event.metaKey : true;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && (shortcut.meta ? metaMatch : true)) {
        event.preventDefault();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return { shortcuts };
};

export default useKeyboardShortcuts;
