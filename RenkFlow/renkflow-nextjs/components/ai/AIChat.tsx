'use client';

/**
 * AI Chat Component
 * Conversational AI assistant interface
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  MessageSquare,
  Send,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  Bot,
  User,
  Loader2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Lightbulb,
  BarChart3,
  Calendar,
  Clock,
  ListTodo,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  isLoading?: boolean;
  suggestions?: string[];
  metadata?: {
    type?: 'query' | 'action' | 'suggestion';
    sources?: string[];
    confidence?: number;
  };
}

interface AIChatProps {
  onClose?: () => void;
  initialMessage?: string;
  context?: Record<string, unknown>;
}

// ============================================
// Quick Actions
// ============================================

const QUICK_ACTIONS = [
  { icon: <ListTodo size={14} />, label: 'Bugünkü görevler', query: 'Bugün ne yapmam gerekiyor?' },
  { icon: <Clock size={14} />, label: 'Geciken siparişler', query: 'Geciken siparişleri göster' },
  { icon: <BarChart3 size={14} />, label: 'Haftalık özet', query: 'Bu haftanın özetini ver' },
  { icon: <Calendar size={14} />, label: 'Yaklaşan teslimler', query: 'Önümüzdeki 3 günde teslim edilecek siparişler' },
];

// ============================================
// Message Component
// ============================================

function ChatMessage({
  message,
  onCopy,
  onFeedback,
  onRetry,
}: {
  message: Message;
  onCopy?: () => void;
  onFeedback?: (positive: boolean) => void;
  onRetry?: () => void;
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
        )}
      >
        {isUser ? <User size={16} /> : <Sparkles size={16} />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-[80%]', isUser && 'flex flex-col items-end')}>
        <div
          className={cn(
            'px-4 py-2.5 rounded-2xl',
            isUser
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-md'
          )}
        >
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Düşünüyorum...</span>
            </div>
          ) : (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {/* Suggestions */}
        {message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.suggestions.map((suggestion, i) => (
              <button
                key={i}
                className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        {!isUser && !message.isLoading && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={onCopy}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              title="Kopyala"
            >
              <Copy size={12} />
            </button>
            <button
              onClick={() => onFeedback?.(true)}
              className="p-1 text-slate-400 hover:text-green-600 rounded"
              title="Faydalı"
            >
              <ThumbsUp size={12} />
            </button>
            <button
              onClick={() => onFeedback?.(false)}
              className="p-1 text-slate-400 hover:text-red-600 rounded"
              title="Faydalı değil"
            >
              <ThumbsDown size={12} />
            </button>
            <button
              onClick={onRetry}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded"
              title="Tekrar dene"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs text-slate-400 mt-1">
          {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}

// ============================================
// Main AI Chat Component
// ============================================

export function AIChat({ onClose, initialMessage, context }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Merhaba! Ben RenkFlow AI asistanınızım. Size nasıl yardımcı olabilirim?\n\nSiparişler, üretim, raporlar veya herhangi bir konuda soru sorabilirsiniz.',
      timestamp: new Date(),
      suggestions: ['Bugünkü siparişler', 'Geciken işler', 'Haftalık rapor'],
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle initial message
  useEffect(() => {
    if (initialMessage) {
      handleSend(initialMessage);
    }
  }, [initialMessage]);

  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add loading message
    const loadingMessage: Message = {
      id: `loading_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);

    try {
      // Build conversation history for AI context
      const history = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .filter((m) => !m.isLoading)
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          history,
          context: context || {},
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      // Replace loading message with actual response
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isLoading);
        return [
          ...filtered,
          {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: data.response || 'Üzgünüm, yanıt oluşturulamadı.',
            timestamp: new Date(),
            suggestions: data.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
            metadata: { type: 'query', confidence: data.confidence },
          },
        ];
      });
    } catch (error) {
      console.error('[AIChat] Error:', error);
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isLoading);
        return [
          ...filtered,
          {
            id: `error_${Date.now()}`,
            role: 'assistant',
            content: 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, context]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  if (isMinimized) {
    return (
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
      >
        <MessageSquare size={24} />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">RenkFlow AI</h3>
            <p className="text-xs text-white/80">Her zaman hazır</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2 p-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={i}
            onClick={() => handleSend(action.query)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            message={message}
            onCopy={() => handleCopy(message.content)}
            onFeedback={(positive) => console.log('Feedback:', positive)}
            onRetry={() => handleSend(messages[messages.length - 2]?.content)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 py-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bir şey sorun..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-2 rounded-lg transition-colors',
              input.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
            )}
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-400 text-center mt-2">
          AI önerileri tavsiye niteliğindedir
        </p>
      </div>
    </motion.div>
  );
}

// ============================================
// Mock Response Generator
// ============================================

function generateMockResponse(query: string): {
  content: string;
  suggestions?: string[];
  metadata?: Message['metadata'];
} {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('gecik') || lowerQuery.includes('overdue')) {
    return {
      content: '📊 Şu anda 3 adet gecikmiş sipariş bulunuyor:\n\n• #1234 - ABC Matbaa (2 gün gecikme)\n• #1235 - XYZ Reklam (1 gün gecikme)\n• #1236 - Mega Print (3 saat gecikme)\n\nBu siparişlere öncelik verilmesini öneririm.',
      suggestions: ['Detayları göster', 'Müşterilere bildirim gönder', 'Üretimi hızlandır'],
      metadata: { type: 'query', confidence: 0.92 },
    };
  }

  if (lowerQuery.includes('bugün') || lowerQuery.includes('görev')) {
    return {
      content: '✅ Bugün için planlanmış işleriniz:\n\n1. 5 sipariş üretimde devam ediyor\n2. 2 sipariş kalite kontrolde\n3. 3 sipariş teslime hazır\n\nÖncelikli: #1240 siparişi 14:00\'te teslim edilmeli.',
      suggestions: ['Üretimdeki siparişler', 'Teslim planı'],
      metadata: { type: 'query', confidence: 0.88 },
    };
  }

  if (lowerQuery.includes('hafta') || lowerQuery.includes('özet')) {
    return {
      content: '📈 Bu Hafta Özeti:\n\n• Tamamlanan: 28 sipariş\n• Devam Eden: 15 sipariş\n• Yeni Gelen: 12 sipariş\n\n💰 Toplam Ciro: ₺145,280\n📊 Verimlilik: %87 (geçen haftaya göre +5%)',
      suggestions: ['Detaylı rapor', 'Karşılaştırma'],
      metadata: { type: 'query', confidence: 0.95 },
    };
  }

  if (lowerQuery.includes('teslim')) {
    return {
      content: '📦 Yaklaşan Teslimler:\n\nBugün:\n• #1240 - 14:00 (ABC Matbaa)\n• #1241 - 17:00 (XYZ Ltd.)\n\nYarın:\n• #1242 - 10:00 (Mega Corp)\n• #1243 - 15:00 (Delta Inc.)\n\nTüm teslimatlar için kurye ayarlandı.',
      suggestions: ['Kurye detayları', 'Teslim rotası'],
      metadata: { type: 'query', confidence: 0.90 },
    };
  }

  return {
    content: 'Sorunuzu anladım. Şu konularda size yardımcı olabilirim:\n\n• Sipariş durumu sorgulama\n• Üretim planlaması\n• Raporlar ve analizler\n• Görev yönetimi\n\nDaha spesifik bir soru sorarsanız daha iyi yardımcı olabilirim.',
    suggestions: ['Sipariş durumu', 'Günlük rapor', 'Üretim planı'],
    metadata: { type: 'query', confidence: 0.7 },
  };
}

// ============================================
// Floating AI Button
// ============================================

export function FloatingAIButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <AnimatePresence>
        {isOpen && <AIChat onClose={() => setIsOpen(false)} />}
      </AnimatePresence>

      {!isOpen && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow z-40"
        >
          <Sparkles size={24} />
        </motion.button>
      )}
    </>
  );
}
