'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  User,
  Loader2,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  query: string;
}

const quickActions: QuickAction[] = [
  { 
    id: 'overdue', 
    label: 'Geciken Siparişler', 
    icon: '⏰', 
    query: 'Bu ay geciken siparişler neler?' 
  },
  { 
    id: 'revenue', 
    label: 'Gelir Özeti', 
    icon: '💰', 
    query: 'Bu ay toplam ne kadar gelir elde ettik?' 
  },
  { 
    id: 'production', 
    label: 'Üretim Durumu', 
    icon: '🏭', 
    query: 'Üretimdeki siparişlerin durumu nedir?' 
  },
  { 
    id: 'top', 
    label: 'En İyi Müşteriler', 
    icon: '👑', 
    query: 'En çok sipariş veren müşteriler kimler?' 
  },
];

export function AIChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (content: string = input) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call real AI API
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          context: {
            // Can pass user context here
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'AI yanıt vermedi');
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Üzgünüm, yanıt oluşturulamadı.',
        timestamp: new Date(),
        suggestions: data.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('[AI Chatbot] Error:', error);
      
      // Fallback to mock response for development
      const fallbackContent = getMockResponse(content);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: process.env.NODE_ENV === 'development' 
          ? fallbackContent 
          : 'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.',
        timestamp: new Date(),
        suggestions: ['Tekrar dene', 'Başka bir soru sor'],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const getMockResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('gecik') || lowerQuery.includes('overdue')) {
      return 'Bu ay 3 sipariş gecikti:\n\n• #2024-001 - ABC Ltd. (5 gün gecikme)\n• #2024-015 - XYZ A.Ş. (2 gün gecikme)\n• #2024-023 - 123 Ticaret (1 gün gecikme)\n\nGecikme nedenleri genellikle tedarik süresi veya üretim yoğunluğu ile ilgili.';
    }
    
    if (lowerQuery.includes('gelir') || lowerQuery.includes('revenue')) {
      return 'Bu ayki finansal özet:\n\n💰 Toplam Gelir: ₺847.500\n📈 Geçen Aya Göre: +12.5%\n💵 Tahsil Edilen: ₺620.000 (73%)\n⏳ Bekleyen: ₺227.500 (27%)\n\nEn yüksek gelir getiren kategori: Mobilya (45%)';
    }
    
    if (lowerQuery.includes('üretim') || lowerQuery.includes('production')) {
      return 'Üretim durumu:\n\n🏭 Aktif Siparişler: 24\n✅ Bugün Tamamlanan: 3\n🔧 Beklemede: 8\n📦 Paketleme: 5\n🚚 Teslimata Hazır: 8\n\nOrtalama üretim süresi: 4.2 gün';
    }
    
    if (lowerQuery.includes('müşteri') || lowerQuery.includes('customer')) {
      return 'En iyi müşteriler (bu ay):\n\n1. 🥇 ABC Ltd. - ₺245.000 (8 sipariş)\n2. 🥈 XYZ A.Ş. - ₺189.000 (6 sipariş)\n3. 🥉 123 Ticaret - ₺156.000 (5 sipariş)\n\nToplam aktif müşteri: 47';
    }
    
    return 'Sorunuzu anladım. Daha detaylı bilgi için lütfen spesifik bir konu belirtin:\n\n• Sipariş durumları\n• Finansal raporlar\n• Üretim takibi\n• Personel performansı\n• Stok durumu';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: QuickAction) => {
    handleSend(action.query);
  };

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
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl shadow-blue-500/30 flex items-center justify-center hover:shadow-blue-500/50 transition-shadow"
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
              "fixed bottom-6 right-6 z-50 w-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col",
              isMinimized && "w-[300px]"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">RenkAI Asistan</h3>
                  <p className="text-xs text-white/70">Yapay Zeka Destekli</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
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
                {/* Quick Actions */}
                {messages.length === 0 && (
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                      Hızlı erişim:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickActions.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-left"
                        >
                          <span>{action.icon}</span>
                          <span className="truncate">{action.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[400px]">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                        <Sparkles className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-2">
                        Merhaba! 👋
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Size nasıl yardımcı olabilirim?
                      </p>
                    </div>
                  )}
                  
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-3",
                        message.role === 'user' ? "flex-row-reverse" : ""
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                        message.role === 'user' 
                          ? "bg-blue-600 text-white" 
                          : "bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                      )}>
                        {message.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={cn(
                        "flex-1 max-w-[280px] rounded-2xl px-4 py-2 text-sm",
                        message.role === 'user'
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none"
                      )}>
                        <pre className="whitespace-pre-wrap font-sans">{message.content}</pre>
                        
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.suggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleSend(suggestion)}
                                className="text-xs px-2 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        <span className="text-xs opacity-50 mt-2 block">
                          {message.timestamp.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white flex items-center justify-center">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        <span className="text-sm text-slate-500">Düşünüyor...</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Bir soru sorun..."
                      className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      aria-label="Gönder"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 text-center">
                    AI yanıtları bilgi amaçlıdır. Önemli kararlar için verileri kontrol edin.
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
