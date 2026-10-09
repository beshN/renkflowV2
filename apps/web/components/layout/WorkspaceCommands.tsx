'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SEARCH_MIN_LENGTH } from '@/lib/features/search/types';
import { foldText } from '@/lib/shared/text/fold';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Command, Search, X, FileText, CornerDownLeft, Zap, FilePlus2, ClipboardList, Scissors, CalendarDays, ScanLine, LayoutGrid, Columns3, Factory, PackagePlus, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrders } from '@/lib/hooks/useOrders';
import { useMemberAccess } from '@/lib/hooks/useMemberAccess';
import { getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { hasPermission } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';

type Action = { id: string; title: string; keywords: string; href: string; icon: LucideIcon; roles?: string[] };
/** Things to do, not only places to go: typed as a verb ("yeni teklif", "sayım", "kesim"). */
const ACTIONS: Action[] = [
  { id: 'a-quote', title: 'Yeni teklif', keywords: 'yeni teklif fiyat pergola yapılandır', href: '/quotations/new', icon: FilePlus2, roles: ['owner', 'admin', 'office'] },
  { id: 'a-order', title: 'Yeni sipariş', keywords: 'yeni sipariş oluştur', href: '/new-order', icon: PackagePlus, roles: ['owner', 'admin', 'office'] },
  { id: 'a-count', title: 'Stok sayımı', keywords: 'stok sayım sayımı çubuk açılış', href: '/inventory/opening-count', icon: ClipboardList, roles: ['owner', 'admin', 'office'] },
  { id: 'a-cut', title: 'Kesim planı', keywords: 'kesim plan çubuk fire', href: '/production?tab=cutting', icon: Scissors, roles: ['owner', 'admin', 'office'] },
  { id: 'a-board', title: 'Sipariş panosu', keywords: 'pano kanban sürükle aşama', href: '/orders?mode=board', icon: Columns3, roles: ['owner', 'admin', 'office', 'accountant'] },
  { id: 'a-cal', title: 'Takvim', keywords: 'takvim teslim montaj hafta plan', href: '/calendar', icon: CalendarDays, roles: ['owner', 'admin', 'office', 'accountant'] },
  { id: 'a-scan', title: 'Barkod / QR tara', keywords: 'tara barkod qr okut', href: '/warehouse/scan', icon: ScanLine },
  { id: 'a-factory', title: 'Fabrika modu', keywords: 'fabrika usta atölye iş başla bitti', href: '/factory', icon: Factory, roles: ['owner', 'admin', 'office', 'worker'] },
  { id: 'a-wall', title: 'Duvar ekranı', keywords: 'duvar tv ekran atölye', href: '/factory/wall', icon: LayoutGrid, roles: ['owner', 'admin', 'office'] },
];

const CommandContext = createContext<{ openCommands: () => void }>({ openCommands: () => {} });
export const useWorkspaceCommands = () => useContext(CommandContext);

function CommandResults({ close }: { close: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const memberAccess = useMemberAccess();
  const { orders, isLoading, error } = useOrders();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const entries = useMemo((): Array<{ id: string; title: string; subtitle?: string | null; href: string; type: string; icon?: LucideIcon }> => {
    const keyword = query.trim().toLocaleLowerCase('tr-TR');
    const pages = getVisibleNavGroups(user?.role, memberAccess).flatMap(group => group.items
      .filter(item => !item.action && (!keyword || item.label.toLocaleLowerCase('tr-TR').includes(keyword)))
      .map(item => ({ id: item.id, title: item.label, subtitle: group.label, href: item.href, type: 'module' })));
    const matches = keyword && user && hasPermission(user.role, 'orders.view') ? orders
      .filter(order => [order.orderNumber, order.customerName, order.productName].some(value => value?.toLocaleLowerCase('tr-TR').includes(keyword)))
      .slice(0, 6).map(order => ({ id: order.id, title: order.orderNumber + ' · ' + order.customerName, subtitle: order.productName, href: '/orders/' + order.id, type: 'order' })) : [];
    // Customers, quotations and stock are searched on the search page (server side, per role).
    const all = foldText(query).length >= SEARCH_MIN_LENGTH ? [{ id: 'search-all', title: `“${query.trim()}” için tüm sonuçlar`, subtitle: 'Sipariş, müşteri, teklif ve stokta ara', href: '/search?q=' + encodeURIComponent(query.trim()), type: 'search' }] : [];
    const actions = ACTIONS.filter((a) => (!a.roles || (user && a.roles.includes(user.role))) && (!keyword || foldText(a.keywords + ' ' + a.title).includes(foldText(keyword))))
      .map((a) => ({ id: a.id, title: a.title, subtitle: 'Eylem', href: a.href, type: 'action', icon: a.icon }));
    return [...(keyword ? [] : actions), ...matches, ...(keyword ? actions : []), ...all, ...pages].slice(0, 14);
  }, [query, user, orders, memberAccess]);

  const selected = Math.min(active, Math.max(0, entries.length - 1));
  function navigate(href: string) { close(); router.push(href); }
  function move(index: number) {
    const next = Math.max(0, Math.min(index, entries.length - 1));
    setActive(next);
    buttonRefs.current[next]?.scrollIntoView({ block: 'nearest' });
  }

  return <>
    <div className="flex items-center gap-3 border-b border-border px-5 py-4">
      <Search size={20} className="shrink-0 text-muted-foreground" />
      <input autoFocus aria-label="Komut veya sipariş ara" placeholder="Sipariş no, müşteri, “yeni teklif”…" className="min-w-0 flex-1 bg-transparent text-base outline-none"
        value={query} onChange={event => { setQuery(event.target.value); setActive(0); }}
        role="combobox" aria-expanded="true" aria-controls="workspace-results" aria-activedescendant={entries.length ? `command-${entries[selected].id}` : undefined}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); move(selected + 1); }
          if (event.key === 'ArrowUp') { event.preventDefault(); move(selected - 1); }
          if (event.key === 'Enter' && entries[selected]) { event.preventDefault(); navigate(entries[selected].href); }
        }} />
      <Dialog.Close aria-label="Komut aramasını kapat" className="rf-icon-button"><X size={18} /></Dialog.Close>
    </div>
    <div className="max-h-[min(55dvh,440px)] overflow-y-auto p-2" id="workspace-results" role="listbox" aria-label="Arama sonuçları">
      <p className="flex items-center gap-1.5 px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{query ? <><Search size={11} aria-hidden /> Sonuçlar</> : <><Zap size={11} aria-hidden /> Eylemler ve modüller</>}</p>
      {entries.map((entry, index) => <button key={entry.id} id={`command-${entry.id}`} ref={node => { buttonRefs.current[index] = node; }} type="button" role="option" aria-selected={selected === index}
        onMouseMove={() => setActive(index)} onClick={() => navigate(entry.href)} className={cn('flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors', selected === index ? 'bg-accent text-foreground' : 'text-muted-foreground')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">{entry.icon ? <entry.icon size={17} className="text-primary" /> : entry.type === 'order' ? <FileText size={17} /> : entry.type === 'search' ? <Search size={17} /> : <Command size={17} />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{entry.title}</span><span className="block truncate text-xs text-muted-foreground">{entry.subtitle}</span></span>
        <ArrowUpRight size={16} className="shrink-0 opacity-50" />
      </button>)}
      {!entries.length && <div className="grid place-items-center gap-2 px-4 py-10 text-sm text-muted-foreground"><Search size={24} aria-hidden className="opacity-50" />Eşleşme yok</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><span role="status">{isLoading ? <><span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" /><span className="sr-only">Siparişler alınıyor</span></> : error ? 'Sipariş araması kapalı' : null}</span><kbd className="rf-kbd">/</kbd><kbd className="rf-kbd">⌘K</kbd></span>
      <span className="flex items-center gap-1.5"><CornerDownLeft size={12} aria-hidden /> Aç <kbd className="rf-kbd ml-2">esc</kbd> Kapat</span>
    </div>
  </>;
}

export function WorkspaceCommands({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);
  const context = useMemo(() => ({ openCommands: () => { previousFocus.current = document.activeElement as HTMLElement; setOpen(true); } }), []);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        previousFocus.current = document.activeElement as HTMLElement;
        setOpen(value => !value);
        return;
      }
      // "/" opens the palette from anywhere except while typing in a field.
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        previousFocus.current = document.activeElement as HTMLElement;
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return <CommandContext.Provider value={context}>
    {children}
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-[3px]" />
        <Dialog.Content className="rf-command-dialog fixed left-1/2 top-[12dvh] z-[81] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl outline-none"
          onCloseAutoFocus={event => { event.preventDefault(); previousFocus.current?.focus(); }}>
          <Dialog.Title className="sr-only">Çalışma alanında arama</Dialog.Title>
          <Dialog.Description className="sr-only">Modül veya sipariş seçin. Yukarı ve aşağı ok tuşlarıyla gezin, Enter ile açın.</Dialog.Description>
          {open && <CommandResults close={() => setOpen(false)} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  </CommandContext.Provider>;
}
