'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';

// ============================================
// Types
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  feedback?: 'positive' | 'negative' | null;
  isError?: boolean;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  query: string;
}

// ============================================
// Constants
// ============================================

const quickActions: QuickAction[] = [
  { id: 'overdue', label: 'Geciken Siparişler', icon: '⏰', query: 'Bu ay geciken siparişler neler?' },
  { id: 'revenue', label: 'Gelir Özeti', icon: '💰', query: 'Bu ay toplam ne kadar gelir elde ettik?' },
  { id: 'production', label: 'Üretim Durumu', icon: '🏭', query: 'Üretimdeki siparişlerin durumu nedir?' },
  { id: 'top', label: 'En İyi Müşteriler', icon: '👑', query: 'En çok sipariş veren müşteriler kimler?' },
  { id: 'kanban', label: 'Kanban Durumu', icon: '📋', query: 'Kanban panosundaki sipariş dağılımı nasıl?' },
  { id: 'help', label: 'Ne Yapabilirsin?', icon: '❓', query: 'Neler yapabilirsin? Bana yeteneklerini anlat.' },
];

const MAX_INPUT_LENGTH = 1000;
const MAX_HISTORY = 20;
const STORAGE_KEY = 'renkflow_ai_chat';
const API_TIMEOUT = 30000;

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

function loadMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const stored: StoredMessage[] = JSON.parse(raw);
    return stored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  try {
    const toStore: StoredMessage[] = messages.slice(-50).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp.toISOString(),
      suggestions: m.suggestions,
      isError: m.isError,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {}
}

// ============================================
// Main Component
// ============================================

export function AIChatbot() {
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

  // Keep messagesRef in sync (avoids stale closures)
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length > 0) setMessages(saved);
  }, []);

  // Save messages to localStorage on change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [messages]);

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
    router.push(path);
  }, [router]);

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
      
      const assistantMessage: Message = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: data.response || 'Üzgünüm, yanıt oluşturulamadı.',
        timestamp: new Date(),
        suggestions: data.suggestions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      clearTimeout(timeoutId);

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
      setIsLoading(false);
      abortRef.current = null;
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
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  if (!user) return null;

  return (
    <>
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
            className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-blue-600 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
            aria-label="AI Asistanı Aç"
          >
            <Sparkles className="w-6 h-6" />
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
              "fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 w-[calc(100vw-2rem)] max-w-[420px] max-h-[calc(100dvh-8rem)] md:max-h-[calc(100dvh-3rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col",
              isMinimized && "md:w-[300px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">RenkFlow AI</h3>
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
                {messages.length === 0 && (
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="text-center mb-4">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                        <Sparkles className="w-7 h-7 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Size nasıl yardımcı olabilirim?
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
                          <span className="group-hover:scale-110 transition-transform">{action.icon}</span>
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
                            : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
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

                        {/* Suggestions */}
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
                      <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center">
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
