'use client';

import { assistantFormSummary } from '@/lib/ai/assistant-form-drafts';
import { modelUnavailableMessage } from '@/lib/ai/policy';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  RotateCcw,
  ArrowDown,
  Clock, FileText, Factory, Package, ChartNoAxesCombined, CircleHelp, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';
import { useAssistantInsights } from '@/lib/hooks/useAssistantInsights';
import { safeAssistantHref, type AssistantAction } from '@/lib/ai/assistant-contract';
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
      const isInternal = href.startsWith('/');
      parts.push(
        <button
          key={`a-${match.index}`}
          onClick={() => isInternal && onNavigate ? onNavigate(href) : window.open(href, '_blank')}
          className="text-blue-500 hover:underline hover:text-blue-600 cursor-pointer inline"
        >
          {match[5]}
        </button>
      );
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

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-blue-500"
          animate={{ y: [0, -4, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

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
  const [isMinimized, setIsMinimized] = useState(false);
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
    if (isOpen && !isMinimized) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

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

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

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

    // Abort previous request if still pending
    abortRef.current?.abort();
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
  }, [isLoading, pathname, user?.name]);

  const handleSend = useCallback((content?: string) => {
    sendMessage(content || input);
  }, [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
    setMessages([]);
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  if (!user) return null;
  const formSummary = pendingAction ? assistantFormSummary(pendingAction.action.kind, pendingAction.action.note) : null;
  const adviceKey=storageKey+':'+pathname+':'+insights.map(i=>i.id+i.detail).join('|');
  // "Nothing to report" is not advice: the banner appears only when there is something to act on.
  // These screens show the same signals as cards and counts; a sentence on top only repeats them.
  const VISUAL_SCREENS=['/dashboard','/orders','/factory','/factory/wall'];

  return (
    <>
      {!isOpen && adviceSlot && insights.length>0 && insights[0].id!=='clear' && dismissedAdvice!==adviceKey && !VISUAL_SCREENS.includes(pathname) && createPortal(<div className="mx-auto w-full max-w-[1600px] px-4 pt-4 md:px-7 print:hidden"><aside aria-label="Asistanın otomatik önerisi" className="rf-advice flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-xs shadow-[var(--rf-shadow-soft)]">
        <span className="rf-icon-chip !h-6 !w-6 !rounded-md" aria-hidden><Sparkles size={13}/></span>
        <p className="min-w-0 flex-1 leading-5"><span className="font-semibold">Asistan önerisi · </span><span className="text-muted-foreground">{brief || insights[0].detail}</span></p>
        <button onClick={()=>setIsOpen(true)} className="hidden shrink-0 font-medium text-primary hover:underline sm:inline">{insights[0].title} →</button>
        <button aria-label="Öneriyi gizle" onClick={()=>setDismissedAdvice(adviceKey)} className="rf-icon-button !h-7 !w-7 shrink-0"><X size={14}/></button>
      </aside></div>,adviceSlot)}
      {pendingAction && <BusinessDialog title={pendingAction.action.title} open onClose={()=>setPendingAction(null)} busy={actionBusy} error={actionError}>
        <p className="text-sm mb-4">{pendingAction.action.kind==='orderNote'?'Aşağıdaki not sipariş geçmişine eklenecek.':['warehouseDraft','attendanceDraft'].includes(pendingAction.action.kind)?'Kayıt formu hazırlanacak. Sonraki ekranda bilgileri inceleyip kaydedebilirsiniz.':'Sipariş taslağı hazırlanacak. Ölçü, fiyat ve ürün kalemlerini sonraki ekranda kontrol edip onaylayacaksınız.'}</p>
        {formSummary ? <dl className="space-y-2 rounded-lg border p-3 text-sm">{formSummary.map(row => <div key={row.label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{row.label}</dt><dd className="text-right font-medium">{row.value}</dd></div>)}</dl> : <pre className="whitespace-pre-wrap rounded border p-3 text-xs max-h-64 overflow-auto">{pendingAction.action.note || JSON.stringify(pendingAction.action.draft,null,2)}</pre>}
        <div className="flex justify-end gap-2 mt-4"><button className="rf-secondary-button" disabled={actionBusy} onClick={()=>setPendingAction(null)}>Vazgeç</button><button className="rf-primary-button" disabled={actionBusy} onClick={()=>void applyAction()}>{actionBusy?'Hazırlanıyor…':formSummary?'Kayıt formunu aç':'Onayla ve uygula'}</button></div>
      </BusinessDialog>}
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className={cn("rf-logo fixed right-4 md:right-6 z-50 w-11 h-11 !rounded-full shadow-lg shadow-black/10 transition-transform duration-150 hover:scale-105 active:scale-95 print:hidden", pathname === "/new-order" ? "bottom-40 md:bottom-24" : "bottom-24 md:bottom-6")}
            aria-label="AI Asistanı Aç"
          >
            <Sparkles className="w-6 h-6" />
            {insights.some(i=>i.priority==='high') && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-500 border-2 border-white" aria-label="Operasyon önerisi var"/>}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1,
              height: isMinimized ? 'auto' : '600px'
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-[420px] max-h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-3rem)] bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl shadow-black/10 overflow-hidden flex flex-col",
              isMinimized && "md:w-[300px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[hsl(var(--rf-ink))] text-[hsl(var(--rf-ink-foreground))]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">RenkFlow AI</h3>{model && <p className="text-[10px] text-muted-foreground" title={model.id}>{model.label}</p>}
                  <div className="flex items-center gap-1">
                    <p className="text-xs text-white/70">Belge ve operasyon yardımcısı</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Sohbeti temizle"
                    title="Sohbeti temizle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label={isMinimized ? 'Genişlet' : 'Küçült'}
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Welcome + Quick Actions */}
                {insights.length>0 && <div className="p-3 border-b text-xs space-y-2" aria-label="Otomatik operasyon önerileri">
                  <p className="font-semibold">Sizin için kontrol ettim</p>
                  {brief && <p className="leading-5 text-muted-foreground">{brief}</p>}
                  {insights.slice(0,2).map(insight=><button key={insight.id} onClick={()=>handleNavigate(insight.href)} className="block w-full rounded border p-2 text-left"><strong>{insight.title}</strong><span className="block mt-1 text-muted-foreground">{insight.detail}</span><span className="block mt-1 text-primary">{insight.action} →</span></button>)}
                </div>}
                {messages.length === 0 && !chatOff && (
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="text-center mb-4">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Kayıtlara dayanan analiz, ürün danışmanlığı ve sonraki adımlar.
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">
                      Hızlı erişim:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleSend(action.query)}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left group"
                        >
                          <action.icon size={15} className="shrink-0 text-muted-foreground" aria-hidden/>
                          <span className="truncate text-xs">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div
                  ref={messagesContainerRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-4 space-y-4 relative scroll-smooth"
                >
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn(
                        "flex gap-2.5",
                        message.role === 'user' ? "flex-row-reverse" : ""
                      )}
                    >
                      {/* Avatar */}
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                        message.role === 'user' 
                          ? "bg-blue-600 text-white" 
                          : message.isError
                            ? "bg-red-500 text-white"
                            : "bg-[hsl(var(--rf-ink))] text-[hsl(var(--rf-ink-foreground))]"
                      )}>
                        {message.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>

                      {/* Message Content */}
                      <div className={cn(
                        "flex flex-col",
                        message.role === 'user' ? "items-end" : "items-start",
                        "max-w-[85%]"
                      )}>
                        <div className={cn(
                          "rounded-2xl px-3.5 py-2.5",
                          message.role === 'user'
                            ? "bg-blue-600 text-white rounded-br-md"
                            : message.isError
                              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-bl-md border border-red-200 dark:border-red-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md"
                        )}>
                          {message.role === 'user' ? (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          ) : (
                            <div className="space-y-0.5">{renderMarkdown(message.content, handleNavigate)}</div>
                          )}
                        </div>

                        {message.role==='assistant'&&!message.isError&&!!message.sources?.length&&<details className="mt-2 text-[10px] text-muted-foreground"><summary className="cursor-pointer">İncelenen kayıt kaynakları</summary><p className="mt-1 leading-5">{message.modelLabel && <p className="mt-2 text-[10px] text-muted-foreground">{message.modelLabel} ile yanıtlandı</p>}
                        {message.sources.map(s=>SOURCE_LABELS[s]).join(' · ')}</p></details>}

                        {/* Suggestions */}
                        {message.actions?.map((action,index)=><button key={index} className="rf-secondary-button mt-2 text-xs" disabled={actionBusy} onClick={()=>{if(action.kind==='navigate'){const href=safeAssistantHref(action.href);if(href)handleNavigate(href);}else {setActionError('');const key=message.id+':'+index;let commandId=actionIds.current.get(key);if(!commandId){commandId=crypto.randomUUID();actionIds.current.set(key,commandId);}setPendingAction({action,commandId});}}}>{action.title}</button>)}
                        {message.role === 'assistant' && message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {message.suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSend(suggestion)}
                                disabled={isLoading}
                                className="text-xs px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 border border-blue-200 dark:border-blue-800"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Actions (copy, feedback, retry) */}
                        {message.role === 'assistant' && !message.isError && (
                          <div className="flex items-center gap-0.5 mt-1">
                            <button
                              onClick={() => handleCopy(message.id, message.content)}
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                              title="Kopyala"
                            >
                              {copiedId === message.id ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <button
                              onClick={() => handleFeedback(message.id, 'positive')}
                              className={cn(
                                "p-1 rounded transition-colors",
                                message.feedback === 'positive'
                                  ? "text-green-500"
                                  : "text-slate-400 hover:text-green-500"
                              )}
                              title="Faydalı"
                            >
                              <ThumbsUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleFeedback(message.id, 'negative')}
                              className={cn(
                                "p-1 rounded transition-colors",
                                message.feedback === 'negative'
                                  ? "text-red-500"
                                  : "text-slate-400 hover:text-red-500"
                              )}
                              title="Faydalı değil"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                            <span className="text-[10px] text-slate-400 ml-1">
                              {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        {/* Error retry */}
                        {message.isError && (
                          <button
                            onClick={handleRetry}
                            disabled={isLoading}
                            className="mt-1.5 flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Tekrar dene
                          </button>
                        )}

                        {/* User message timestamp */}
                        {message.role === 'user' && (
                          <span className="text-[10px] text-slate-400 mt-1">
                            {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  
                  {/* Typing Indicator */}
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-[hsl(var(--rf-ink))] text-[hsl(var(--rf-ink-foreground))] flex items-center justify-center">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3">
                        <TypingIndicator />
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Scroll to bottom button */}
                <AnimatePresence>
                  {showScrollBtn && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={scrollToBottom}
                      className="absolute bottom-[90px] left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 transition-colors z-10"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* Input */}
                {chatOff ? (
                  <p role="note" className="p-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    {modelUnavailableMessage(modelUnavailableReason)} Yukarıdaki uyarılar kayıtlarınızdan doğrudan hesaplanır.
                    {['owner','admin'].includes(user.role) && <button type="button" onClick={()=>handleNavigate('/settings#asistan')} className="mt-2 block font-medium text-primary underline underline-offset-4">Asistan ayarlarını aç</button>}
                  </p>
                ) : (
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex gap-2 items-end">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
                      onKeyDown={handleKeyDown}
                      placeholder="Bir soru sorun..."
                      rows={1}
                      className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white resize-none max-h-[120px] leading-relaxed"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className={cn(
                        "p-2.5 rounded-xl transition-all shrink-0",
                        input.trim() && !isLoading
                          ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                      )}
                      aria-label="Gönder"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5 px-1">
                    <p className="text-[10px] text-slate-400">
                      Shift+Enter ile yeni satır
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {input.length}/{MAX_INPUT_LENGTH}
                    </p>
                  </div>
                </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
