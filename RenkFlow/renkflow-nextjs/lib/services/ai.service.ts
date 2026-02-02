/**
 * AI Assistant Service
 * Claude/OpenAI integration for intelligent task management
 */

import type {
  AIMessage,
  AIConversation,
  AIQueryResult,
  AISuggestion,
  AICapability,
} from '@/lib/types/enterprise';

// ============================================
// Configuration
// ============================================

interface AIConfig {
  provider: 'claude' | 'openai' | 'groq';
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

const DEFAULT_CONFIG: Partial<AIConfig> = {
  maxTokens: 4096,
  temperature: 0.7,
};

// ============================================
// AI Service Class
// ============================================

export class AIService {
  private config: AIConfig;
  private conversationHistory: AIMessage[] = [];

  constructor(config: Partial<AIConfig> = {}) {
    this.config = {
      provider: config.provider || 'groq',
      apiKey: config.apiKey || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || '',
      model: config.model || (config.provider === 'groq' ? 'llama-3.3-70b-versatile' : config.provider === 'openai' ? 'gpt-4-turbo' : 'claude-3-sonnet-20240229'),
      maxTokens: config.maxTokens || DEFAULT_CONFIG.maxTokens!,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature!,
    };
  }

  // ============================================
  // Natural Language Query
  // ============================================

  async query(
    userQuery: string,
    context: WorkspaceContext
  ): Promise<AIQueryResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const messages: AIMessage[] = [
      ...this.conversationHistory.slice(-10), // Keep last 10 messages for context
      {
        id: generateId(),
        role: 'user',
        content: userQuery,
        timestamp: new Date().toISOString(),
      },
    ];

    try {
      const response = await this.callAPI(systemPrompt, messages);
      
      // Parse response and extract structured data
      const result = this.parseQueryResponse(response, context);

      // Add to conversation history
      this.conversationHistory.push({
        id: generateId(),
        role: 'user',
        content: userQuery,
        timestamp: new Date().toISOString(),
      });
      this.conversationHistory.push({
        id: generateId(),
        role: 'assistant',
        content: result.answer,
        timestamp: new Date().toISOString(),
        metadata: {
          capability: 'query',
          sources: result.sources.map((s) => s.id),
          confidence: result.confidence,
        },
      });

      return result;
    } catch (error) {
      console.error('[AI Service] Query failed:', error);
      throw error;
    }
  }

  // ============================================
  // Task Breakdown Generation
  // ============================================

  async generateSubtasks(
    taskDescription: string,
    context: WorkspaceContext
  ): Promise<AISuggestion[]> {
    const prompt = `
Görev açıklamasına dayanarak mantıklı alt görevler oluştur.

Görev: ${taskDescription}

Üretim/matbaa bağlamını dikkate al. Her alt görev için:
1. Başlık
2. Tahmini süre (saat)
3. Öncelik (yüksek/orta/düşük)
4. Bağımlılıklar (varsa)

JSON formatında yanıtla:
{
  "subtasks": [
    {
      "title": "string",
      "estimatedHours": number,
      "priority": "high" | "medium" | "low",
      "dependencies": ["string"] // önceki alt görev başlıkları
    }
  ]
}
`;

    const response = await this.callAPI(
      'Sen bir üretim planlama asistanısın. Görevleri mantıklı alt görevlere ayır.',
      [{ id: generateId(), role: 'user', content: prompt, timestamp: new Date().toISOString() }]
    );

    try {
      const parsed = JSON.parse(this.extractJSON(response));
      return parsed.subtasks.map((st: any, index: number) => ({
        id: `suggestion_${Date.now()}_${index}`,
        type: 'task_breakdown',
        title: st.title,
        description: `Tahmini: ${st.estimatedHours} saat, Öncelik: ${st.priority}`,
        preview: st,
        confidence: 0.85,
        reasoning: 'Görev açıklaması analiz edildi ve üretim süreçlerine göre ayrıldı.',
      }));
    } catch (e) {
      console.error('[AI Service] Failed to parse subtasks:', e);
      return [];
    }
  }

  // ============================================
  // Daily Standup Generation
  // ============================================

  async generateStandup(
    userId: string,
    context: WorkspaceContext
  ): Promise<string> {
    const recentActivity = context.recentTasks || [];
    const upcomingDeadlines = context.upcomingDeadlines || [];

    const prompt = `
Kullanıcının son aktivitelerine dayanarak günlük standup özeti oluştur.

Son aktiviteler:
${recentActivity.map((t: any) => `- ${t.title}: ${t.status}`).join('\n')}

Yaklaşan teslim tarihleri:
${upcomingDeadlines.map((t: any) => `- ${t.title}: ${t.dueDate}`).join('\n')}

Kısa ve öz bir standup formatında yanıtla:
- Dün yapılanlar
- Bugün planlar
- Engeller (varsa)
`;

    const response = await this.callAPI(
      'Sen bir proje yönetimi asistanısın. Günlük standup raporları oluştur.',
      [{ id: generateId(), role: 'user', content: prompt, timestamp: new Date().toISOString() }]
    );

    return response;
  }

  // ============================================
  // Production Scheduling Suggestions
  // ============================================

  async suggestSchedule(
    orders: any[],
    resources: any[],
    constraints: SchedulingConstraints
  ): Promise<AISuggestion[]> {
    const prompt = `
Aşağıdaki siparişler ve kaynaklar için optimal üretim planı öner.

Siparişler:
${orders.map((o) => `- ${o.orderNumber}: ${o.productName}, Teslim: ${o.deliveryDate}, Miktar: ${o.quantity}`).join('\n')}

Kaynaklar:
${resources.map((r) => `- ${r.name}: Kapasite ${r.capacity} saat/gün, Verimlilik: %${r.efficiency}`).join('\n')}

Kısıtlamalar:
- Maksimum günlük çalışma: ${constraints.maxHoursPerDay} saat
- Öncelik kriterleri: ${constraints.priorityCriteria}

Her sipariş için başlangıç tarihi, kaynak ataması ve tahmini tamamlanma süresi öner.
JSON formatında yanıtla.
`;

    const response = await this.callAPI(
      'Sen bir üretim planlama uzmanısın. Optimal çizelgeleme önerileri sun.',
      [{ id: generateId(), role: 'user', content: prompt, timestamp: new Date().toISOString() }]
    );

    try {
      const parsed = JSON.parse(this.extractJSON(response));
      return parsed.schedule.map((item: any, index: number) => ({
        id: `schedule_${Date.now()}_${index}`,
        type: 'schedule',
        title: `${item.orderNumber} - ${item.resource}`,
        description: `Başlangıç: ${item.startDate}, Bitiş: ${item.endDate}`,
        preview: item,
        confidence: item.confidence || 0.75,
        reasoning: item.reasoning || 'Kaynak ve teslim tarihi analizi yapıldı.',
      }));
    } catch (e) {
      console.error('[AI Service] Failed to parse schedule:', e);
      return [];
    }
  }

  // ============================================
  // Anomaly Detection
  // ============================================

  async detectAnomalies(
    metrics: ProductionMetrics[],
    thresholds: AnomalyThresholds
  ): Promise<AnomalyResult[]> {
    const prompt = `
Aşağıdaki üretim metriklerinde anormallik tespit et.

Metrikler:
${metrics.map((m) => `${m.date}: Verimlilik: %${m.efficiency}, Kalite: %${m.quality}, Duruş: ${m.downtime} dk`).join('\n')}

Normal eşikler:
- Verimlilik: >${thresholds.minEfficiency}%
- Kalite: >${thresholds.minQuality}%
- Duruş: <${thresholds.maxDowntime} dk

Anormallikleri ve olası nedenlerini listele.
`;

    const response = await this.callAPI(
      'Sen bir üretim analisti olarak metriklerdeki anormallikleri tespit et.',
      [{ id: generateId(), role: 'user', content: prompt, timestamp: new Date().toISOString() }]
    );

    // Parse and return anomalies
    return this.parseAnomalies(response);
  }

  // ============================================
  // Content Summarization
  // ============================================

  async summarize(content: string, maxLength = 200): Promise<string> {
    const prompt = `
Aşağıdaki içeriği maksimum ${maxLength} karakter ile özetle:

${content}

Özet:
`;

    const response = await this.callAPI(
      'Sen bir özetleme uzmanısın. İçerikleri kısa ve öz şekilde özetle.',
      [{ id: generateId(), role: 'user', content: prompt, timestamp: new Date().toISOString() }]
    );

    return response.slice(0, maxLength);
  }

  // ============================================
  // Automation Rule Generation
  // ============================================

  async generateAutomationRule(
    description: string
  ): Promise<any> {
    const prompt = `
Kullanıcının isteğine göre bir otomasyon kuralı oluştur.

İstek: "${description}"

Kural JSON formatında olmalı:
{
  "name": "string",
  "trigger": {
    "type": "status_change" | "due_date_approaching" | "task_created" | "time_based",
    "config": {}
  },
  "conditions": [
    { "field": "string", "operator": "equals" | "contains" | "greater_than", "value": any }
  ],
  "actions": [
    { "type": "send_notification" | "update_field" | "create_subtask", "config": {}, "order": 0 }
  ]
}

Sadece JSON döndür, açıklama ekleme.
`;

    const response = await this.callAPI(
      'Sen bir otomasyon uzmanısın. Doğal dildeki istekleri otomasyon kurallarına dönüştür.',
      [{ id: generateId(), role: 'user', content: prompt, timestamp: new Date().toISOString() }]
    );

    try {
      return JSON.parse(this.extractJSON(response));
    } catch (e) {
      console.error('[AI Service] Failed to parse automation rule:', e);
      return null;
    }
  }

  // ============================================
  // Private Methods
  // ============================================

  private async callAPI(
    systemPrompt: string,
    messages: AIMessage[]
  ): Promise<string> {
    // This is a mock implementation
    // In production, this would call the actual API

    if (!this.config.apiKey) {
      console.warn('[AI Service] No API key configured, returning mock response');
      return this.getMockResponse(messages[messages.length - 1]?.content || '');
    }

    if (this.config.provider === 'claude') {
      return await this.callClaude(systemPrompt, messages);
    } else if (this.config.provider === 'groq') {
      return await this.callGroq(systemPrompt, messages);
    } else {
      return await this.callOpenAI(systemPrompt, messages);
    }
  }

  private async callClaude(
    systemPrompt: string,
    messages: AIMessage[]
  ): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  private async callOpenAI(
    systemPrompt: string,
    messages: AIMessage[]
  ): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callGroq(
    systemPrompt: string,
    messages: AIMessage[]
  ): Promise<string> {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private getMockResponse(query: string): string {
    // Mock responses for testing without API key
    if (query.toLowerCase().includes('geciken')) {
      return 'Sistemde 3 geciken sipariş bulunuyor: #1234, #1235, #1236. Toplam gecikme 5 gün.';
    }
    if (query.toLowerCase().includes('bugün')) {
      return 'Bugün 8 aktif sipariş var. 3 tanesi teslim için hazır, 5 tanesi üretimde.';
    }
    return 'Sorunuzu anladım. Bu konuda size yardımcı olabilirim. Daha spesifik bilgi için lütfen detay verin.';
  }

  private buildSystemPrompt(context: WorkspaceContext): string {
    return `
Sen RenkFlow üretim yönetim sisteminin AI asistanısın. 
Türkçe yanıt ver. Kısa ve öz ol.

Mevcut bağlam:
- Toplam sipariş: ${context.totalOrders || 0}
- Aktif siparişler: ${context.activeOrders || 0}
- Geciken siparişler: ${context.overdueOrders || 0}
- Bugünkü teslimler: ${context.todayDeliveries || 0}

Kullanıcıya yardımcı ol, soruları yanıtla ve önerilerde bulun.
`;
  }

  private parseQueryResponse(
    response: string,
    context: WorkspaceContext
  ): AIQueryResult {
    // Generate contextual suggestions based on response content
    const suggestions = this.generateSuggestions(response);
    
    return {
      answer: response,
      sources: [],
      suggestions,
      confidence: 0.85,
    };
  }

  private generateSuggestions(response: string): string[] {
    const lowerResponse = response.toLowerCase();
    
    // Context-aware suggestions based on response content
    if (lowerResponse.includes('sipariş') || lowerResponse.includes('order')) {
      return ['Detayları gör', 'PDF olarak indir', 'Müşteriyi bilgilendir', 'Üretimi hızlandır'];
    }
    if (lowerResponse.includes('gecik') || lowerResponse.includes('delay')) {
      return ['Gecikme nedenlerini analiz et', 'Çözüm önerileri', 'Müşterilere bildirim gönder'];
    }
    if (lowerResponse.includes('gelir') || lowerResponse.includes('revenue') || lowerResponse.includes('finans')) {
      return ['Detaylı rapor oluştur', 'Geçen ay ile karşılaştır', 'Excel olarak indir'];
    }
    if (lowerResponse.includes('üretim') || lowerResponse.includes('production')) {
      return ['Kapasite optimizasyonu', 'Personel planlaması', 'Makine durumunu kontrol et'];
    }
    if (lowerResponse.includes('müşteri') || lowerResponse.includes('customer')) {
      return ['Müşteri geçmişini gör', 'Yeni teklif oluştur', 'CRM notları ekle'];
    }
    
    // Default suggestions
    return ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'];
  }

  private parseAnomalies(response: string): AnomalyResult[] {
    // Simple parsing - in production would be more sophisticated
    return [];
  }

  private extractJSON(text: string): string {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? match[0] : '{}';
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }
}

// ============================================
// Types
// ============================================

interface WorkspaceContext {
  totalOrders?: number;
  activeOrders?: number;
  overdueOrders?: number;
  todayDeliveries?: number;
  recentTasks?: any[];
  upcomingDeadlines?: any[];
}

interface SchedulingConstraints {
  maxHoursPerDay: number;
  priorityCriteria: string;
}

interface ProductionMetrics {
  date: string;
  efficiency: number;
  quality: number;
  downtime: number;
}

interface AnomalyThresholds {
  minEfficiency: number;
  minQuality: number;
  maxDowntime: number;
}

interface AnomalyResult {
  type: string;
  severity: 'low' | 'medium' | 'high';
  metric: string;
  value: number;
  threshold: number;
  possibleCauses: string[];
}

function generateId(): string {
  return `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Singleton Instance
// ============================================

let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}
