/**
 * RenkFlow AI Service
 * Merkezi AI servis katmanı — Z.ai / GLM-Flash entegrasyonu
 * ZAI_API_KEY yalnızca server-side env var olarak kullanılır
 */

import 'server-only';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIQueryResult {
  answer: string;
  confidence: number;
  suggestions?: string[];
  toolsUsed?: string[];
}

export interface WorkspaceContext {
  totalOrders?: number;
  activeOrders?: number;
  overdueOrders?: number;
  todayDeliveries?: number;
  currentPath?: string;
  userName?: string;
  recentTasks?: unknown[];
  upcomingDeadlines?: unknown[];
}

const ZAI_API_BASE = 'https://api.z.ai/v1';
const DEFAULT_MODEL = 'glm-5.3-flash'; // GLM-5.3-Flash

class ZaiAIService {
  private conversationHistory: AIMessage[] = [];

  private getApiKey(): string {
    const key = process.env.ZAI_API_KEY;
    if (!key) {
      throw new Error('ZAI_API_KEY ortam değişkeni tanımlanmamış. Sunucu yapılandırmasını kontrol edin.');
    }
    return key;
  }

  setConversationHistory(history: AIMessage[]) {
    this.conversationHistory = history.slice(-20);
  }

  getConversationHistory(): AIMessage[] {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }

  private buildSystemPrompt(ctx: WorkspaceContext): string {
    return `Sen RenkFlow'un şirket asistanısın. RenkFlow, Renk Alüminyum'un üretim ve sipariş yönetim platformudur.

Görevin:
- Sipariş, üretim, stok, müşteri ve sevkiyat verilerini doğru ve net biçimde sunmak
- Türkçe ve anlaşılır cevaplar vermek
- Güvenlik: Hiçbir zaman doğrudan SQL üretme veya veritabanını doğrudan değiştirme
- Yalnızca sağlanan uygulama araçlarını (tools) kullan
- Belirsiz durumlarda kullanıcıya sor, tahmin yürütme

Mevcut bağlam:
- Kullanıcı: ${ctx.userName || 'Bilinmiyor'}
- Aktif ekran: ${ctx.currentPath || '/dashboard'}
- Toplam sipariş: ${ctx.totalOrders || 0}
- Aktif sipariş: ${ctx.activeOrders || 0}
- Geciken sipariş: ${ctx.overdueOrders || 0}
- Bugün teslimat: ${ctx.todayDeliveries || 0}

Cevaplarında kısa ve net ol. Önemli sayıları kalın yaz. Liste varsa madde işaretiyle göster.`;
  }

  async query(userMessage: string, ctx: WorkspaceContext = {}): Promise<AIQueryResult> {
    const apiKey = this.getApiKey();

    const systemPrompt = this.buildSystemPrompt(ctx);

    const messages: AIMessage[] = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory,
      { role: 'user', content: userMessage },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(`${ZAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages,
          max_tokens: 1024,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Bilinmeyen hata');
        throw new Error(`Z.ai API hatası (${response.status}): ${errText.slice(0, 200)}`);
      }

      const data = await response.json();
      const content = String(data.choices?.[0]?.message?.content || 'Yanıt alınamadı.');

      // Geçmişe ekle
      const nextHistory: AIMessage[] = [
        ...this.conversationHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content },
      ];
      this.conversationHistory = nextHistory.slice(-20);

      return {
        answer: content,
        confidence: 0.9,
        suggestions: this.generateSuggestions(userMessage),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async queryWithContext(
    userMessage: string,
    ctx: WorkspaceContext,
    toolResults: Record<string, unknown>,
  ): Promise<AIQueryResult> {
    const contextSuffix = Object.keys(toolResults).length > 0
      ? `\n\nSistemden alınan gerçek veri:\n${JSON.stringify(toolResults, null, 2)}`
      : '';

    return this.query(userMessage + contextSuffix, ctx);
  }

  async analyzeDocument(
    documentBase64: string,
    mimeType: string,
    prompt: string,
  ): Promise<{ extractedData: Record<string, unknown>; rawText: string }> {
    const apiKey = this.getApiKey();

    const messages = [
      {
        role: 'system',
        content: `Sen bir belge analiz uzmanısın. Verilen belgeyi dikkatle okuyarak istenen bilgileri çıkar. 
Çıktını her zaman geçerli JSON formatında ver. Emin olmadığın alanları null bırak, asla tahmin yürütme.`,
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${documentBase64}`,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(`${ZAI_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          messages,
          max_tokens: 2048,
          temperature: 0.1, // Düşük temperature — daha deterministik çıkarım
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Z.ai API hatası (${response.status})`);
      }

      const data = await response.json();
      const rawText = data.choices?.[0]?.message?.content || '';

      // JSON çıkarmaya çalış
      let extractedData: Record<string, unknown> = {};
      const jsonMatch = rawText.match(/```json\n?([\s\S]*?)\n?```/) || rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch {
          // JSON parse başarısız — raw text döndür
        }
      }

      return { extractedData, rawText };
    } finally {
      clearTimeout(timeout);
    }
  }

  private generateSuggestions(query: string): string[] {
    const lower = query.toLowerCase();
    if (lower.includes('sipariş')) {
      return ['Bu siparişin detaylarını göster', 'Geciken siparişleri listele', 'Yeni sipariş oluştur'];
    }
    if (lower.includes('stok') || lower.includes('envanter')) {
      return ['Kritik stokları göster', 'Stok hareketi geçmişi', 'Satın alma talebi oluştur'];
    }
    if (lower.includes('üretim')) {
      return ['Aktif üretim emirleri', 'Kanban panosunu aç', 'Malzeme ihtiyacı hesapla'];
    }
    return ['Siparişleri göster', 'Stok durumu', 'Üretim raporları'];
  }
}

// Singleton instance
let _aiService: ZaiAIService | null = null;

export function getAIService(): ZaiAIService {
  if (!_aiService) {
    _aiService = new ZaiAIService();
  }
  return _aiService;
}

export { ZaiAIService, ZaiAIService as AIService };
