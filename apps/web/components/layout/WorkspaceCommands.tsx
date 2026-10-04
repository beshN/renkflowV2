'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Command, Search, X, FileText, CornerDownLeft } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useOrders } from '@/lib/hooks/useOrders';
import { getVisibleNavGroups } from '@/lib/core/dashboard-nav';
import { hasPermission } from '@/lib/auth/permissions';
import { cn } from '@/lib/utils';

const CommandContext = createContext<{ openCommands: () => void }>({ openCommands: () => {} });
export const useWorkspaceCommands = () => useContext(CommandContext);

function CommandResults({ close }: { close: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { orders, isLoading, error } = useOrders();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const entries = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('tr-TR');
    const pages = getVisibleNavGroups(user?.role).flatMap(group => group.items
      .filter(item => !item.action && (!keyword || item.label.toLocaleLowerCase('tr-TR').includes(keyword)))
      .map(item => ({ id: item.id, title: item.label, subtitle: group.label, href: item.href, type: 'module' })));
    const matches = keyword && user && hasPermission(user.role, 'orders.view') ? orders
      .filter(order => [order.orderNumber, order.customerName, order.productName].some(value => value?.toLocaleLowerCase('tr-TR').includes(keyword)))
      .slice(0, 6).map(order => ({ id: order.id, title: order.orderNumber + ' · ' + order.customerName, subtitle: order.productName, href: '/orders/' + order.id, type: 'order' })) : [];
    return [...matches, ...pages].slice(0, 12);
  }, [query, user, orders]);

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
      <input autoFocus aria-label="Komut veya sipariş ara" placeholder="Sipariş, müşteri veya modül ara…" className="min-w-0 flex-1 bg-transparent text-base outline-none"
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
      <p className="px-3 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{query ? 'Arama sonuçları' : 'Çalışma alanına git'}</p>
      {entries.map((entry, index) => <button key={entry.id} id={`command-${entry.id}`} ref={node => { buttonRefs.current[index] = node; }} type="button" role="option" aria-selected={selected === index}
        onMouseMove={() => setActive(index)} onClick={() => navigate(entry.href)} className={cn('flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors', selected === index ? 'bg-accent text-foreground' : 'text-muted-foreground')}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">{entry.type === 'order' ? <FileText size={17} /> : <Command size={17} />}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{entry.title}</span><span className="block truncate text-xs text-muted-foreground">{entry.subtitle}</span></span>
        <ArrowUpRight size={16} className="shrink-0 opacity-50" />
      </button>)}
      {!entries.length && <div className="px-4 py-10 text-center text-sm text-muted-foreground">Bu aramayla eşleşen kayıt yok. Başka bir kelime deneyin.</div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-[11px] text-muted-foreground">
      <span role="status">{isLoading ? 'Siparişler yükleniyor…' : error ? 'Sipariş araması şu an kullanılamıyor.' : 'Modüller ve mevcut siparişlerde arama'}</span>
      <span className="flex items-center gap-1.5"><CornerDownLeft size={12} /> Aç <kbd className="rf-kbd ml-2">esc</kbd> Kapat</span>
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
