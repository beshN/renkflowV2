/**
 * AI Assistant Service
 * Gemini-first integration for intelligent task management
 */

import type {
  AIMessage,
  AIQueryResult,
  AISuggestion,
} from '@/lib/types/enterprise';

// ============================================
// Configuration
// ============================================

interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}
type AIProvider = 'gemini' | 'openai' | 'claude';

const DEFAULT_CONFIG: Partial<AIConfig> = {
  maxTokens: 4096,
  temperature: 0.35,
};

interface StructuredAIResponse {
  answer: string;
  suggestions?: string[];
  confidence?: number;
}

interface CallOptions {
  structured?: boolean;
}

// ============================================
// AI Service Class
// ============================================

export class AIService {
  private config: AIConfig;
  private conversationHistory: AIMessage[] = [];
  private static readonly URL_CONTEXT_TIMEOUT_MS = 5000;
  private static readonly URL_CONTEXT_MAX_CHARS = 4000;
  private static readonly URL_CONTEXT_MAX_URLS = 2;

  constructor(config: Partial<AIConfig> = {}) {
    const envProvider = process.env.AI_PROVIDER?.trim().toLowerCase();
    const provider = config.provider
      || (AIService.isSupportedProvider(envProvider) ? envProvider : undefined)
      || (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        ? 'gemini'
        : process.env.OPENAI_API_KEY
          ? 'openai'
          : process.env.ANTHROPIC_API_KEY
            ? 'claude'
            : 'gemini');

    const apiKey = config.apiKey
      || (provider === 'gemini'
        ? (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)
        : provider === 'openai'
          ? process.env.OPENAI_API_KEY
          : process.env.ANTHROPIC_API_KEY)
      || '';

    const defaultModels: Record<string, string> = {
      gemini: 'gemini-2.5-flash',
      openai: 'gpt-4.1-mini',
      claude: 'claude-3-5-sonnet-latest',
    };

    this.config = {
      provider,
      apiKey,
      model:
        config.model
        || process.env.AI_MODEL
        || (provider === 'gemini'
          ? process.env.GEMINI_MODEL
          : provider === 'openai'
            ? process.env.OPENAI_MODEL
            : process.env.CLAUDE_MODEL)
        || defaultModels[provider]
        || 'gemini-2.5-flash',
      maxTokens: config.maxTokens || DEFAULT_CONFIG.maxTokens!,
      temperature: config.temperature ?? DEFAULT_CONFIG.temperature!,
    };

    console.log(`[AI Service] Provider: ${this.config.provider}, Model: ${this.config.model}`);
  }

  // ============================================
  // Conversation History Management
  // ============================================

  setConversationHistory(history: { role: string; content: string }[]) {
    this.conversationHistory = history.map((h) => ({
      id: generateId(),
      role: h.role as 'user' | 'assistant',
      content: h.content,
      timestamp: new Date().toISOString(),
    }));
  }

  // ============================================
  // Natural Language Query
  // ============================================

  async query(
    userQuery: string,
    context: WorkspaceContext
  ): Promise<AIQueryResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const queryPrompt = await this.buildStructuredQueryPrompt(userQuery);
    const messages: AIMessage[] = [
      ...this.conversationHistory.slice(-10), // Keep last 10 messages for context
      {
        id: generateId(),
        role: 'user',
        content: queryPrompt,
        timestamp: new Date().toISOString(),
      },
    ];

    try {
      const response = await this.callAPI(systemPrompt, messages, { structured: true });
      
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
    messages: AIMessage[],
    options: CallOptions = {}
  ): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('AI API anahtarı bulunamadı. Lütfen GEMINI_API_KEY veya GOOGLE_API_KEY ayarlayın.');
    }

    if (this.config.provider === 'gemini') {
      return await this.callGemini(systemPrompt, messages, options);
    }
    if (this.config.provider === 'claude') {
      return await this.callClaude(systemPrompt, messages, options);
    }
    {
      return await this.callOpenAI(systemPrompt, messages, options);
    }
  }

  private createTimeoutSignal(ms: number = 30000): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  }

  private static isSupportedProvider(value: string | undefined): value is AIProvider {
    return value === 'gemini' || value === 'openai' || value === 'claude';
  }

  private isPrivateIPv4(hostname: string): boolean {
    const parts = hostname.split('.');
    if (parts.length !== 4) return false;
    const nums = parts.map((part) => Number(part));
    if (nums.some((num) => Number.isNaN(num) || num < 0 || num > 255)) return false;

    const [a, b] = nums;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  private isBlockedHostname(hostname: string): boolean {
    const lowered = hostname.toLowerCase();
    if (!lowered) return true;
    if (
      lowered === 'localhost'
      || lowered === '0.0.0.0'
      || lowered === '::1'
      || lowered === '[::1]'
      || lowered === 'metadata.google.internal'
      || lowered.endsWith('.local')
    ) {
      return true;
    }

    return this.isPrivateIPv4(lowered);
  }

  private toSafeExternalUrl(rawUrl: string): URL | null {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      if (this.isBlockedHostname(parsed.hostname)) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private async handleAPIError(response: Response, provider: string): Promise<never> {
    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {}
    console.error(`[AI Service] ${provider} API error ${response.status}:`, errorBody);
    throw new Error(`${provider} API hatası: ${response.status}`);
  }

  private async callClaude(
    systemPrompt: string,
    messages: AIMessage[],
    _options: CallOptions = {}
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
      signal: this.createTimeoutSignal(),
    });

    if (!response.ok) {
      await this.handleAPIError(response, 'Claude');
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }

  private async callOpenAI(
    systemPrompt: string,
    messages: AIMessage[],
    options: CallOptions = {}
  ): Promise<string> {
    const requestBody: Record<string, unknown> = {
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
    };

    if (options.structured) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: this.createTimeoutSignal(),
    });

    if (!response.ok) {
      await this.handleAPIError(response, 'OpenAI');
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private async callGemini(
    systemPrompt: string,
    messages: AIMessage[],
    options: CallOptions = {}
  ): Promise<string> {
    const requestBody: Record<string, any> = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      },
    };

    if (options.structured) {
      requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: this.createTimeoutSignal(),
    });

    if (!response.ok) {
      await this.handleAPIError(response, 'Gemini');
    }

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('\n').trim() || '';
  }

  private extractUrls(text: string): string[] {
    const matches = text.match(/https?:\/\/[^\s)]+/gi) || [];
    const normalized = matches
      .map((m) => m.trim())
      .filter((m) => m.length > 0);
    return [...new Set(normalized)].slice(0, AIService.URL_CONTEXT_MAX_URLS);
  }

  private sanitizeFetchedText(raw: string): string {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, AIService.URL_CONTEXT_MAX_CHARS);
  }

  private async fetchUrlContext(url: string): Promise<string | null> {
    const safeUrl = this.toSafeExternalUrl(url);
    if (!safeUrl) return null;

    try {
      const response = await fetch(safeUrl.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'RenkFlowAI/1.0 (+https://renkflow.com)',
        },
        signal: this.createTimeoutSignal(AIService.URL_CONTEXT_TIMEOUT_MS),
      });

      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') || '';
      if (!/text\/|application\/(json|xml|xhtml\+xml)/i.test(contentType)) {
        return null;
      }

      const text = await response.text();
      const cleaned = this.sanitizeFetchedText(text);
      if (!cleaned) return null;

      return `URL: ${safeUrl.toString()}\nİçerik özeti: ${cleaned}`;
    } catch {
      return null;
    }
  }

  private async buildUrlContext(userQuery: string): Promise<string> {
    const urls = this.extractUrls(userQuery);
    if (urls.length === 0) return '';

    const contexts = await Promise.all(urls.map((url) => this.fetchUrlContext(url)));
    const valid = contexts.filter((item): item is string => Boolean(item));
    return valid.join('\n\n');
  }

  private buildSystemPrompt(context: WorkspaceContext): string {
    const contextLines = [
      `- Toplam sipariş: ${context.totalOrders || 0}`,
      `- Aktif siparişler: ${context.activeOrders || 0}`,
      `- Geciken siparişler: ${context.overdueOrders || 0}`,
      `- Bugünkü teslimler: ${context.todayDeliveries || 0}`,
      context.currentPath ? `- Kullanıcının bulunduğu sayfa: ${context.currentPath}` : '',
      context.userName ? `- Kullanıcı adı: ${context.userName}` : '',
      context.recentTasks?.length ? `- Son görevler: ${context.recentTasks.map((t: any) => t.title || t).join(', ')}` : '',
      context.upcomingDeadlines?.length ? `- Yaklaşan teslim tarihleri: ${context.upcomingDeadlines.map((t: any) => t.title || t).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    return `RenkFlowAI Sistem Promptu (System Instruction)
Sen RenkFlowAI’sın. RenkFlow platformunun kalbinde çalışan, kullanıcıların Proje Yönetimi, Stok Takibi, Finans, Sipariş Yönetimi ve Üretim Süreçlerini optimize etmelerine yardımcı olan, son derece yetkin, proaktif ve çözüm odaklı yapay zeka asistanısın.

Amacın sadece soruları cevaplamak değil; kullanıcının işini kolaylaştırmak, hataları önlemek ve RenkFlow platformunu en verimli şekilde kullanmasını sağlamaktır.

1. KİMLİK VE TON
- Adın: RenkFlowAI.
- Varsayılan dilin Türkçe. Kullanıcı başka dilde yazarsa o dilde cevaplayabilirsin.
- Üslup: profesyonel, nazik, net, güven verici ve iş bitirici.
- Gereksiz samimiyet ve argo yok; robotik dil de yok.
- Kullanıcıya mümkün olduğunda menü yolu ver: Dashboard > Siparişler > Yeni Sipariş gibi.

2. TEMEL KURALLAR
- Rakip platformlardan bahsetme, kıyaslama yapma.
- Kullanıcıya ait verileri dışarı sızdırma veya örneklerde ifşa etme.
- Uydurma özellik anlatma; özellik yoksa açıkça belirt ve geliştirme ekibine yönlendirme öner.
- Cevaplar kısa, uygulanabilir ve eylem odaklı olsun.

3. YETENEK ALANI
- Sipariş Yönetimi: teklif, sipariş durumları, cari akış.
- Stok/Envanter: kritik stok, depo hareketi, varyant/barkod.
- Finans/Ön Muhasebe: gelir-gider, fatura, tahsilat, karlılık.
- Üretim Takibi: iş emri, BOM/reçete, aşama ve fire takibi.

4. SENARYO DAVRANIŞI
- Hata bildirimi gelirse olası nedenleri maddeler halinde teşhis et ve gerekli alanları kontrol ettir.
- Analiz istendiğinde kısa KPI özeti + net aksiyon maddeleri üret.
- Özellik isteğinde önce mevcut RenkFlow çözümünü sun, gerekirse destek talebi akışı öner.

5. CEVAP KALİTE KONTROLÜ
- Cevap RenkFlow içinde uygulanabilir olmalı.
- Dil bilgisi doğru olmalı.
- Çözüm odaklı ve kullanıcıyı bir sonraki adıma taşımalı.

KATI KURAL:
RenkFlow dışında hiçbir soruya kullanıcıların istediği cevabı verme. Kullanıcıyı nazikçe RenkFlow kapsamına geri yönlendir.

Mevcut kullanıcı bağlamı:
${contextLines}`;
  }

  private async buildStructuredQueryPrompt(userQuery: string): Promise<string> {
    const urlContext = await this.buildUrlContext(userQuery);
    return `KULLANICI SORUSU:
${userQuery}

${urlContext ? `URL BAĞLAMI:\n${urlContext}\n` : ''}ÇIKTI FORMATI:
Sadece geçerli JSON döndür. Markdown, açıklama veya ek metin yazma.
{
  "answer": "Kullanıcıya verilecek nihai yanıt",
  "suggestions": ["kısa öneri 1", "kısa öneri 2", "kısa öneri 3"],
  "confidence": 0.0
}

KURALLAR:
- "answer" Türkçe olmalı, net ve uygulanabilir bilgi içermeli.
- "suggestions" 1-4 adet, kısa ve eyleme dönük olmalı.
- "confidence" 0 ile 1 arasında sayı olmalı.`;
  }

  private parseQueryResponse(
    response: string,
    _context: WorkspaceContext
  ): AIQueryResult {
    const structured = this.tryParseStructuredResponse(response);
    const answer = structured?.answer?.trim() || response.trim();
    const suggestions = this.sanitizeSuggestions(
      structured?.suggestions && structured.suggestions.length > 0
        ? structured.suggestions
        : this.generateSuggestions(answer)
    );
    const confidence = this.clampConfidence(structured?.confidence ?? this.estimateConfidence(answer));

    return {
      answer,
      sources: [],
      suggestions,
      confidence,
    };
  }

  private tryParseStructuredResponse(raw: string): StructuredAIResponse | null {
    try {
      const parsed = JSON.parse(raw) as StructuredAIResponse;
      if (!parsed || typeof parsed.answer !== 'string') return null;
      return parsed;
    } catch {}

    try {
      const extracted = this.extractJSON(raw);
      const parsed = JSON.parse(extracted) as StructuredAIResponse;
      if (!parsed || typeof parsed.answer !== 'string') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private sanitizeSuggestions(items: string[]): string[] {
    const normalized = items
      .filter((item) => typeof item === 'string')
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter((item) => item.length >= 3 && item.length <= 80);
    return [...new Set(normalized)].slice(0, 4);
  }

  private clampConfidence(value: number): number {
    if (Number.isNaN(value)) return 0.75;
    return Math.max(0, Math.min(1, value));
  }

  private estimateConfidence(answer: string): number {
    if (answer.length > 500) return 0.88;
    if (answer.length > 220) return 0.82;
    if (answer.length > 80) return 0.76;
    return 0.7;
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
  currentPath?: string;
  userName?: string;
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
