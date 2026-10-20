'use client';

import { assistantFormSummary } from '@/lib/ai/assistant-form-drafts';
import { modelUnavailableMessage } from '@/lib/ai/policy';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Sparkles, 
  Minimize2,
  Maximize2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  RotateCcw,
  ArrowDown,
  ArrowUp, ArrowUpRight, Loader2, Clock, FileText, Factory, Package, ChartNoAxesCombined, CircleHelp, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';
import { useAssistantInsights } from '@/lib/hooks/useAssistantInsights';
import { safeAssistantHref, type AssistantAction } from '@/lib/ai/assistant-contract';
import { requestJson } from '@/lib/shared/network';
import { CommandResultView, type AssistantCommandCard } from './AssistantCommand';
import { BusinessDialog } from '@/components/shared/ui/BusinessDialog';

// ============================================
// Types
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelLabel?: string;
  suggestions?: string[];
  feedback?: 'positive' | 'negative' | null;
  isError?: boolean;
  actions?: AssistantAction[];
  sources?: string[];
  command?: AssistantCommandCard;
}

interface QuickAction {
  id: string;
  label: string;
  icon: LucideIcon;
  query: string;
}

// ============================================
// Constants
// ============================================

const quickActions: QuickAction[] = [
  { id: 'overdue', label: 'Teslimat riskleri', icon: Clock, query: 'Geciken siparişleri ve sıradaki somut adımları özetle.' },
  { id: 'sales', label: 'Teklif takibi', icon: FileText, query: 'Açık teklifleri durum ve geçerliliklerine göre özetle; takip önceliklerini belirt.' },
  { id: 'production', label: 'Üretim ve kapasite', icon: Factory, query: 'Üretimdeki darboğazları ve teslimata etkilerini mevcut kayıtlara göre açıkla.' },
  { id: 'stock', label: 'Stok öncelikleri', icon: Package, query: 'Kritik stokları ve üretim için kontrol etmem gereken malzemeleri göster.' },
  { id: 'revenue', label: 'Finansal görünüm', icon: ChartNoAxesCombined, query: 'Bu ayın sipariş değerini ve tahsilatını para birimlerini ayırarak açıkla.' },
  { id: 'help', label: 'Ürün danışmanı', icon: CircleHelp, query: 'Renk ürünlerini kullanım alanı ve mekanizma açısından karşılaştır; teknik bilgilerin kaynağını belirt.' },
];
const SOURCE_LABELS:Record<string,string>={orders:'Siparişler',jobs:'Üretim işleri',operations:'Operasyonlar',stock:'Stok',materials:'Malzemeler',quotations:'Teklifler','quote-detail':'Teklif detayı','order-detail':'Sipariş detayı',customers:'Müşteriler',purchases:'Satın alma',suppliers:'Tedarikçiler',shipments:'Sevkiyat',recipes:'Reçeteler',financialOrders:'Sipariş değerleri',payments:'Tahsilatlar',metrics:'Sipariş özeti',warehouses:'Depolar',locations:'Raflar',counts:'Sayımlar',notifications:'Bildirimler'};

const MAX_INPUT_LENGTH = 1000;
const MAX_HISTORY = 20;
const STORAGE_KEY = 'renkflow_ai_chat';
const API_TIMEOUT = 55000;

// ============================================
// Markdown Renderer
// ============================================

function renderMarkdown(text: string, onNavigate?: (path: string) => void): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const Tag = listType;
      elements.push(
        <Tag key={`list-${elements.length}`} className={cn(
          'my-1 space-y-0.5',
          listType === 'ul' ? 'list-disc pl-4' : 'list-decimal pl-4'
        )}>
          {listItems.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{renderInline(item, onNavigate)}</li>
          ))}
        </Tag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Unordered list
    const ulMatch = trimmed.match(/^[-•*]\s+(.+)/);
    if (ulMatch) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(ulMatch[1]);
      continue;
    }

    // Ordered list
    const olMatch = trimmed.match(/^(\d+)[.)\-]\s+(.+)/);
    if (olMatch) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(olMatch[2]);
      continue;
    }

    flushList();

    // Empty line
    if (!trimmed) {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      continue;
    }

    // Heading
    if (trimmed.startsWith('### ')) {
      elements.push(<h4 key={`h-${i}`} className="font-semibold text-sm mt-2 mb-1">{renderInline(trimmed.slice(4), onNavigate)}</h4>);
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={`h-${i}`} className="font-bold text-sm mt-2 mb-1">{renderInline(trimmed.slice(3), onNavigate)}</h3>);
      continue;
    }

    // Regular paragraph
    elements.push(<p key={`p-${i}`} className="text-sm leading-relaxed">{renderInline(trimmed, onNavigate)}</p>);
  }

  flushList();
  return elements;
}

function renderInline(text: string, onNavigate?: (path: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`, [link](url), or bare (/path) routes
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\)|\(\/[a-z][a-z0-9\-\/]*\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={`b-${match.index}`} className="font-semibold">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={`i-${match.index}`}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(<code key={`c-${match.index}`} className="px-1 py-0.5 bg-black/10 dark:bg-white/10 rounded text-xs font-mono">{match[4]}</code>);
    } else if (match[5] && match[6]) {
      // Markdown link [text](url)
      const href = match[6];
      const internal = href.startsWith('/') ? safeAssistantHref(href) : null;
      if (internal) parts.push(<button key={`a-${match.index}`} onClick={() => onNavigate?.(internal)} className="text-primary underline underline-offset-4">{match[5]}</button>);
      else if (/^https?:\/\//i.test(href)) parts.push(<a key={`a-${match.index}`} href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">{match[5]}</a>);
      else parts.push(match[5]);
    } else if (match[0].startsWith('(/')) {
      // Bare route like (/orders)
      const path = match[0].slice(1, -1); // remove parens
      parts.push(
        <button
          key={`r-${match.index}`}
          onClick={() => onNavigate?.(path)}
          className="text-blue-500 hover:underline hover:text-blue-600 cursor-pointer inline font-mono text-xs"
        >
          {path}
        </button>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// ============================================
// Typing Indicator
// ============================================

// ============================================
// Storage helpers
// ============================================

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestions?: string[];
  isError?: boolean;
  modelLabel?: string;
}

function loadMessages(storageKey: string): Message[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const stored: StoredMessage[] = JSON.parse(raw);
    return stored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[], storageKey: string) {
  try {
    const toStore: StoredMessage[] = messages.slice(-50).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
      suggestions: m.suggestions,
      isError: m.isError,
      modelLabel: m.modelLabel,
    }));
    localStorage.setItem(storageKey, JSON.stringify(toStore));
  } catch {}
}

// ============================================
// Main Component
// ============================================

export function AIChatbot() {
  const {insights,brief,modelEnabled,modelUnavailableReason,model} = useAssistantInsights();
  // Without a model key the chat cannot answer: say so instead of offering a box that only errors.
  const chatOff = modelEnabled === false;
  const [pendingAction,setPendingAction]=useState<{action:AssistantAction;commandId:string}|null>(null);
  const [actionBusy,setActionBusy]=useState(false);
  const [actionError,setActionError]=useState('');
  const [dismissedAdvice,setDismissedAdvice]=useState('');
  const [adviceSlot,setAdviceSlot]=useState<HTMLElement|null>(null);
  useEffect(()=>{setAdviceSlot(document.getElementById('assistant-context-slot'));},[]);
  const actionLock=useRef(false);
  const actionIds=useRef(new Map<string,string>());
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const storageKey = user?.id ? `${STORAGE_KEY}:${user.tenantId}:${user.id}:${user.role}` : '';
  const scopeRef=useRef(storageKey);
  scopeRef.current=storageKey;
  const [messagesScope, setMessagesScope] = useState('');

  // Keep messagesRef in sync (avoids stale closures)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load messages from localStorage on mount
  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current=null;
    setIsLoading(false);
    setPendingAction(null);
    setActionError('');
    actionIds.current.clear();
    setMessages(storageKey ? loadMessages(storageKey) : []);
    setMessagesScope(storageKey);
  }, [storageKey]);

  // Save messages to localStorage on change
  useEffect(() => {
    if (!storageKey || messagesScope !== storageKey) return;
    if (messages.length > 0) {
      saveMessages(messages, storageKey);
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [messages, storageKey, messagesScope]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Detect scroll position for "scroll to bottom" button
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const open = () => setIsOpen(true);
    window.addEventListener('renkflow-assistant-open', open);
    return () => window.removeEventListener('renkflow-assistant-open', open);
  }, []);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Navigate to internal page
  const handleNavigate = useCallback((path: string) => {
    const href=safeAssistantHref(path);if(href)router.push(href);
  }, [router]);

  const applyAction=async()=>{
    if(!pendingAction || actionLock.current)return;
    const requestedScope=storageKey;
    actionLock.current=true;setActionBusy(true);setActionError('');
    try{
      const res=await fetch('/api/ai/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pendingAction)});
      const body=await res.json();if(!res.ok)throw new Error(body.error || 'İşlem tamamlanamadı.');
      if(scopeRef.current!==requestedScope)return;
      setPendingAction(null);setMessages(prev=>[...prev,{id:crypto.randomUUID(),role:'assistant',content:body.message || 'İşlem tamamlandı.',timestamp:new Date()}]);
      const href=safeAssistantHref(body.href);if(href)router.push(href);
    }catch(e){if(scopeRef.current===requestedScope)setActionError(e instanceof Error?e.message:'İşlem tamamlanamadı.');}finally{actionLock.current=false;setActionBusy(false);}
  };

  // Greeting message
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }, []);

  const sendMessage = useCallback(async (content: string, customerId?: string) => {
    if (!content.trim() || isLoading || abortRef.current || chatOff || modelEnabled === undefined) return;

    const trimmed = content.trim();
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    const controller = new AbortController();
    abortRef.current = controller;

    // Client-side timeout
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      // Use ref to get latest messages (avoids stale closure)
      const currentMessages = messagesRef.current;
      const history = currentMessages
        .filter((m) => !m.isError)
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          ...(customerId ? { customerId } : {}),
          history,
          context: {
            currentPath: pathname,
            userName: user?.name || '',
            localTime: new Date().toISOString(),
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 401) {
          throw new Error('Oturumunuz sona ermiş. Sayfayı yenileyip tekrar giriş yapın.');
        }
        if (response.status === 429) {
          throw new Error('Çok fazla istek gönderdiniz. Lütfen birkaç saniye bekleyin.');
        }
        throw new Error(errorData?.error || `Sunucu hatası (${response.status})`);
      }

      const data = await response.json();
      if(controller.signal.aborted || abortRef.current!==controller)return;
      
      const assistantMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Üzgünüm, yanıt oluşturulamadı.',
        timestamp: new Date(),
        modelLabel: data.model?.verifiedResponse ? data.model.label : undefined,
        suggestions: data.suggestions,
        command: data.command ? { id: Date.now(), text: trimmed, result: data.command } : undefined,
        actions: data.actions,
        sources: Array.isArray(data.toolsUsed)?data.toolsUsed.filter((s:unknown):s is string=>typeof s==='string'&&!!SOURCE_LABELS[s]):[],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if(abortRef.current!==controller)return;

      // Don't show error if request was intentionally aborted
      if (error?.name === 'AbortError') {
        const timeoutMsg: Message = {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: 'Yanıt süresi doldu. Sunucu meşgul olabilir, lütfen tekrar deneyin.',
          timestamp: new Date(),
          suggestions: ['Tekrar dene'],
          isError: true,
        };
        setMessages((prev) => [...prev, timeoutMsg]);
      } else {
        console.error('[AI Chatbot] Error:', error);
        const errorMessage: Message = {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `Bir sorun oluştu: ${error.message || 'Bilinmeyen hata'}. Lütfen tekrar deneyin.`,
          timestamp: new Date(),
          suggestions: ['Tekrar dene'],
          isError: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      if(abortRef.current===controller){setIsLoading(false);abortRef.current = null;}
    }
  }, [isLoading, pathname, user?.name, chatOff, modelEnabled]);

  const [commandBusy, setCommandBusy] = useState<string | null>(null);
  const commandLock = useRef(false);
  const decideCommand = async (message: Message, action: 'approve' | 'reject') => {
    const result = message.command?.result;
    if (result?.type !== 'preview' || commandLock.current) return;
    commandLock.current = true; setCommandBusy(message.id);
    const scope = scopeRef.current;
    const r = await requestJson<{ result?: { href?: string } }>(`/api/v1/ai/suggestions/${result.suggestionId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, expectedVersion: result.version }) }, { timeoutMs: 30_000 });
    if (scope === scopeRef.current) setMessages(current => current.map(m => m.id !== message.id || !m.command ? m : { ...m, command: { ...m.command, error: r.ok ? undefined : r.error || 'Karar kaydedilemedi', done: r.ok ? { label: action === 'approve' ? 'Taslak oluşturuldu' : 'Vazgeçildi', href: r.data?.result?.href } : undefined } }));
    commandLock.current = false; setCommandBusy(null);
  };

  const handleSend = useCallback((content?: string) => {
    sendMessage(content || input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleCopy = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard API not available (e.g. non-HTTPS)
    }
  }, []);

  const handleFeedback = useCallback((id: string, type: 'positive' | 'negative') => {
    setMessages((prev) =>
      prev.map((m) => m.id === id ? { ...m, feedback: m.feedback === type ? null : type } : m)
    );
  }, []);

  const handleRetry = useCallback(() => {
    const current = messagesRef.current;
    const lastUserMsg = [...current].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    // Remove last assistant message first, then send
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'assistant') {
          return [...prev.slice(0, i), ...prev.slice(i + 1)];
        }
      }
      return prev;
    });

    // Use setTimeout to ensure state update is flushed before sending
    setTimeout(() => sendMessage(lastUserMsg.content), 50);
  }, [sendMessage]);

  const handleClearChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setMessages([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  if (!user) return null;
  const formSummary = pendingAction ? assistantFormSummary(pendingAction.action.kind, pendingAction.action.note) : null;
  const adviceKey=storageKey+':'+pathname+':'+insights.map(i=>i.id+i.detail).join('|');
  // "Nothing to report" is not advice: the banner appears only when there is something to act on.
  // These screens show the same signals as cards and counts; a sentence on top only repeats them.
  const VISUAL_SCREENS=['/dashboard','/orders','/factory','/factory/wall','/assistant'];

  return (
    <>
      {!isOpen && adviceSlot && insights.length > 0 && insights[0].id !== 'clear' && dismissedAdvice !== adviceKey && !VISUAL_SCREENS.includes(pathname) && createPortal(
        <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 md:px-7 print:hidden"><aside aria-label="Asistanın otomatik önerisi" className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-xs">
          <Sparkles size={15} className="shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 leading-5 text-muted-foreground">{brief || insights[0].detail}</p>
          <button onClick={() => setIsOpen(true)} className="shrink-0 font-medium text-foreground hover:underline">İncele</button>
          <button aria-label="Öneriyi gizle" onClick={() => setDismissedAdvice(adviceKey)} className="rf-icon-button !h-8 !w-8 shrink-0"><X size={14} /></button>
        </aside></div>, adviceSlot)}
      {pendingAction && <BusinessDialog title={pendingAction.action.title} open onClose={() => setPendingAction(null)} busy={actionBusy} error={actionError}>
        <p className="mb-4 text-sm">{pendingAction.action.kind === 'orderNote' ? 'Aşağıdaki not sipariş geçmişine eklenecek.' : ['warehouseDraft', 'attendanceDraft'].includes(pendingAction.action.kind) ? 'Kayıt formu hazırlanacak. Bilgileri sonraki ekranda inceleyip kaydedebilirsiniz.' : 'Sipariş taslağı hazırlanacak. Ürün, ölçü ve fiyatları sonraki ekranda kontrol edeceksiniz.'}</p>
        {formSummary ? <dl className="space-y-2 rounded-lg border border-border p-3 text-sm">{formSummary.map(row => <div key={row.label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{row.label}</dt><dd className="text-right font-medium">{row.value}</dd></div>)}</dl> : <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-border p-3 text-xs">{pendingAction.action.note || JSON.stringify(pendingAction.action.draft, null, 2)}</pre>}
        <div className="mt-4 flex justify-end gap-2"><button className="rf-secondary-button" disabled={actionBusy} onClick={() => setPendingAction(null)}>Vazgeç</button><button className="rf-primary-button" disabled={actionBusy} onClick={() => void applyAction()}>{actionBusy ? 'Hazırlanıyor…' : formSummary ? 'Kayıt formunu aç' : 'Onayla ve uygula'}</button></div>
      </BusinessDialog>}
      <AnimatePresence>
        {!isOpen && <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsOpen(true)}
          className={cn('fixed right-4 z-50 inline-flex h-12 items-center gap-2 rounded-xl border border-white/10 bg-[hsl(var(--rf-ink))] px-4 text-sm font-medium text-[hsl(var(--rf-ink-foreground))] shadow-lg transition-transform hover:-translate-y-0.5 md:right-6 print:hidden', pathname === '/new-order' ? 'bottom-40 md:bottom-24' : 'bottom-24 md:bottom-6')}
          aria-label="AI Asistanı Aç"><Sparkles size={17} aria-hidden /><span>Asistan</span>{insights.some(i => i.priority === 'high') && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="Operasyon önerisi var" />}</motion.button>}
      </AnimatePresence>
      <AnimatePresence>
        {isOpen && <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} transition={{ duration: 0.15 }}
          role="dialog" aria-labelledby="assistant-chat-title" onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
          className={cn('fixed bottom-24 right-3 z-50 flex max-h-[calc(100dvh-8rem)] w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_20px_80px_-20px_rgba(0,0,0,0.45)] md:bottom-6 md:right-6 md:max-h-[calc(100dvh-3rem)] print:hidden', isExpanded ? 'h-[820px] max-w-[820px]' : 'h-[700px] max-w-[460px]')}>
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary"><Sparkles size={19} aria-hidden /></div>
              <div className="min-w-0"><h2 id="assistant-chat-title" className="text-sm font-semibold tracking-tight">RenkFlow Asistan</h2>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', chatOff ? 'bg-amber-500' : modelEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/50')} aria-hidden />{chatOff ? 'Kayıt desteği · AI kapalı' : modelEnabled ? `${model?.label ?? 'AI'} · kullanıma hazır` : 'Bağlantı kontrol ediliyor'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {!!messages.length && <button onClick={handleClearChat} className="rf-icon-button !h-9 !w-9" aria-label="Sohbeti temizle" title="Yeni sohbet"><Trash2 size={15} /></button>}
              <button onClick={() => setIsExpanded(!isExpanded)} className="rf-icon-button !h-9 !w-9" aria-label={isExpanded ? 'Normal boyuta dön' : 'Sohbeti genişlet'} title={isExpanded ? 'Normal boyut' : 'Genişlet'}>{isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button>
              <button onClick={() => setIsOpen(false)} className="rf-icon-button !h-9 !w-9" aria-label="Kapat"><X size={18} /></button>
            </div>
          </header>
          <div ref={messagesContainerRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {!!insights.filter(i => i.id !== 'clear').length && <details className="mb-6 rounded-xl border border-border bg-muted/20 text-xs" open={messages.length === 0}>
              <summary className="cursor-pointer px-3.5 py-3 font-medium text-foreground">Gündeminizde · {insights.filter(i => i.id !== 'clear').length} konu<span className="ml-2 font-normal text-muted-foreground">Kayıt kontrolü</span></summary>
              <div className="space-y-2 border-t border-border p-3">{brief && <p className="mb-3 leading-6 text-muted-foreground">{brief}</p>}{insights.filter(i => i.id !== 'clear').slice(0, 2).map(insight => <button key={insight.id} onClick={() => handleNavigate(insight.href)} className="block w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted"><span className="block font-medium">{insight.title}</span><span className="mt-1 block leading-5 text-muted-foreground">{insight.detail}</span><span className="mt-2 inline-flex items-center gap-1 font-medium text-primary">{insight.action}<ArrowUpRight size={12} aria-hidden /></span></button>)}</div>
            </details>}
            {!messages.length && !chatOff && <div className="pb-2 pt-2">
              <p className="text-xs text-muted-foreground">{greeting}{user.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
              <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-tight">İşlerinizi birlikte<br />netleştirelim.</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">Siparişleriniz, üretim ve stok hakkında sorun. İşlem gerektiren adımları önce inceleyin.</p>
              <div className="mt-6 grid grid-cols-2 gap-2">{quickActions.filter(a => user.role !== 'worker' || ['production', 'stock', 'help'].includes(a.id)).map(action => <button key={action.id} onClick={() => setInput(action.query)} className="group flex min-h-16 items-center gap-2.5 rounded-xl border border-border p-3 text-left text-xs transition-colors hover:border-primary/30 hover:bg-muted/40"><action.icon size={16} className="shrink-0 text-muted-foreground" aria-hidden /><span className="flex-1 leading-5">{action.label}</span><ArrowUpRight size={12} className="shrink-0 text-muted-foreground/60" aria-hidden /></button>)}</div>
            </div>}
            <div className="space-y-6" role="log" aria-live="polite" aria-label="Sohbet mesajları" aria-relevant="additions">
              {messages.map(message => <div key={message.id} className={cn('flex flex-col', message.role === 'user' ? 'items-end' : 'items-start')}>
                {message.role === 'assistant' && <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Sparkles size={12} aria-hidden />Asistan</p>}
                <div className={cn('min-w-0 break-words text-sm leading-7', message.role === 'user' ? 'max-w-[88%] whitespace-pre-wrap rounded-xl rounded-tr-sm border border-border bg-muted/60 px-4 py-3' : message.isError ? 'w-full rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-destructive' : 'w-full text-foreground/90')}>
                  {message.role === 'user' ? message.content : message.command ? <><CommandResultView card={message.command} busy={commandBusy === message.id} onChoose={(customerId) => void sendMessage(message.command!.text, customerId)} onDecide={(action) => void decideCommand(message, action)} onExample={(text) => setInput(text)} />{message.command.error && <p className="mt-2 text-xs text-destructive" role="alert">{message.command.error}</p>}</> : renderMarkdown(message.content, handleNavigate)}
                </div>
                {message.role === 'assistant' && !message.isError && <>
                  {message.command?.result && <p className="mt-2 text-[10px] text-muted-foreground">{message.command.result.type === 'preview' && message.command.result.source === 'model' ? 'AI ile yorumlandı · hesap ve kayıt kontrolü yapıldı' : 'Komut ve kayıt kontrolü ile hazırlandı'}</p>}
                  {message.modelLabel && <p className="mt-2 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Check size={11} aria-hidden />{message.modelLabel} ile yanıtlandı</p>}
                  {!!message.sources?.length && <details className="mt-2 text-[11px] text-muted-foreground"><summary className="cursor-pointer">Başvurulan kayıtlar</summary><p className="mt-1 leading-5">{message.sources.map(s => SOURCE_LABELS[s]).join(' · ')}</p></details>}
                  {!!message.actions?.length && <div className="mt-3 flex flex-wrap gap-2">{message.actions.map((action, index) => <button key={index} className="rf-secondary-button !rounded-lg text-xs" disabled={actionBusy} onClick={() => {
                    if (action.kind === 'navigate') { const href = safeAssistantHref(action.href); if (href) handleNavigate(href); }
                    else { setActionError(''); const key = message.id + ':' + index; let commandId = actionIds.current.get(key); if (!commandId) { commandId = crypto.randomUUID(); actionIds.current.set(key, commandId); } setPendingAction({ action, commandId }); }
                  }}>{action.title}<ArrowUpRight size={12} aria-hidden /></button>)}</div>}
                  {!!message.suggestions?.length && <div className="mt-3 flex flex-wrap gap-1.5">{message.suggestions.map((suggestion, index) => <button key={index} disabled={isLoading} onClick={() => setInput(suggestion)} className="rounded-lg border border-border px-2.5 py-1.5 text-left text-xs leading-5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40">{suggestion}</button>)}</div>}
                  <div className="mt-2 flex items-center gap-1 text-muted-foreground/60">
                    <button onClick={() => handleCopy(message.id, message.content)} className="rf-icon-button !h-8 !w-8" aria-label="Yanıtı kopyala">{copiedId === message.id ? <Check size={13} /> : <Copy size={13} />}</button>
                    <button onClick={() => handleFeedback(message.id, 'positive')} aria-pressed={message.feedback === 'positive'} className={cn('rf-icon-button !h-8 !w-8', message.feedback === 'positive' && 'text-emerald-600')} aria-label="Faydalı"><ThumbsUp size={13} /></button>
                    <button onClick={() => handleFeedback(message.id, 'negative')} aria-pressed={message.feedback === 'negative'} className={cn('rf-icon-button !h-8 !w-8', message.feedback === 'negative' && 'text-destructive')} aria-label="Faydalı değil"><ThumbsDown size={13} /></button>
                    <time className="ml-auto text-[10px]" dateTime={message.timestamp.toISOString()}>{message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</time>
                  </div>
                </>}
                {message.isError && <button onClick={handleRetry} disabled={isLoading} className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"><RotateCcw size={13} />Tekrar dene</button>}
              </div>)}
              {isLoading && <div role="status" className="flex items-center gap-2 py-2 text-xs text-muted-foreground"><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden />Kayıtlar inceleniyor, yanıt hazırlanıyor…</div>}
              <div ref={messagesEndRef} />
            </div>
          </div>
          {showScrollBtn && <button onClick={scrollToBottom} className="absolute bottom-36 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-md" aria-label="Son mesaja git"><ArrowDown size={15} /></button>}
          {chatOff ? <div className="shrink-0 border-t border-border bg-muted/20 px-5 py-4 text-xs leading-6 text-muted-foreground" role="note">{modelUnavailableMessage(modelUnavailableReason)}
            {['owner', 'admin'].includes(user.role) && <button type="button" onClick={() => handleNavigate('/settings#asistan')} className="mt-2 block font-medium text-foreground underline underline-offset-4">Asistan ayarlarını aç</button>}
          </div> : <form className="shrink-0 border-t border-border bg-card p-4" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <div className="overflow-hidden rounded-xl border border-border bg-background focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
              <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))} onKeyDown={handleKeyDown} placeholder="Bir soru sorun veya yapmak istediğinizi yazın…" aria-label="Asistana mesaj" rows={2} disabled={modelEnabled === undefined} className="max-h-[120px] min-h-[64px] w-full resize-none bg-transparent px-3.5 pt-3 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 disabled:opacity-50" />
              <div className="flex items-center justify-between gap-2 px-3 pb-2.5"><span className="text-[10px] text-muted-foreground">İşlemler onayınızla uygulanır</span><button type="submit" disabled={!input.trim() || isLoading || modelEnabled === undefined} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Gönder"><ArrowUp size={17} /></button></div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>Enter gönder · Shift+Enter yeni satır</span><span>{input.length}/{MAX_INPUT_LENGTH}</span></div>
          </form>}
        </motion.section>}
      </AnimatePresence>
    </>
  );
}
