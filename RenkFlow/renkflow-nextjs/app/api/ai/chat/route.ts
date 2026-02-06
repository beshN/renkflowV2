import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/services/ai.service';
import { auth } from '@/auth';

// ============================================
// Simple in-memory rate limiter
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 20; // max requests per window

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ============================================
// Fallback Answer Builder
// ============================================

function buildFallbackAnswer(message: string, context: {
  totalOrders: number;
  activeOrders: number;
  overdueOrders: number;
  todayDeliveries: number;
}) {
  const query = message.toLowerCase();

  if (query.includes('merhaba') || query.includes('selam') || query.includes('nasıl')) {
    return {
      response: 'Merhaba! 👋 Ben RenkAI Asistan. Size sipariş takibi, üretim durumu, finansal raporlar ve daha birçok konuda yardımcı olabilirim. Ne hakkında bilgi almak istersiniz?',
      suggestions: ['Bugünkü siparişler', 'Geciken işler', 'Ne yapabilirsin?'],
    };
  }

  if (query.includes('gecik') || query.includes('overdue')) {
    return {
      response: `📊 Geciken sipariş sayısı: **${context.overdueOrders}**. İsterseniz bu siparişleri öncelik sırasına göre çıkarabilirim.\n\nDetaylı bilgi için **Siparişler** (/orders) sayfasına göz atabilirsiniz.`,
      suggestions: ['Geciken siparişleri listele', 'Müşteriye bilgilendirme metni oluştur', 'Kanban panosunu aç'],
    };
  }

  if (query.includes('gelir') || query.includes('ciro') || query.includes('tahsilat') || query.includes('finans')) {
    return {
      response: `💰 Mevcut durum: Toplam **${context.totalOrders}** sipariş, **${context.activeOrders}** aktif.\n\nDetaylı gelir/tahsilat kırılımı için **Finans** (/finance) modülüne bakabilirsiniz.`,
      suggestions: ['Finans sayfasına git', 'Bu ayki sipariş özeti', 'Rapor oluştur'],
    };
  }

  if (query.includes('teslim') || query.includes('üretim') || query.includes('kanban')) {
    return {
      response: `🏭 Bugünkü teslim planı: **${context.todayDeliveries}** sipariş. Aktif üretimdeki sipariş: **${context.activeOrders}**.\n\nİş akışını **Kanban** (/kanban) panosundan takip edebilirsiniz.`,
      suggestions: ['Kanban panosunu aç', 'Üretimdeki siparişler', 'Teslim planı'],
    };
  }

  if (query.includes('ne yapabilir') || query.includes('yetenek') || query.includes('yardım')) {
    return {
      response: '🤖 Size şu konularda yardımcı olabilirim:\n\n- **Sipariş takibi**: Geciken, aktif, tamamlanan siparişler\n- **Üretim durumu**: Kanban, iş akışı, kapasite\n- **Finansal bilgiler**: Gelir, gider, tahsilat\n- **Müşteri bilgileri**: CRM, iletişim geçmişi\n- **Raporlar**: Haftalık/aylık özetler\n- **Navigasyon**: İstediğiniz sayfaya yönlendirme\n- **Matbaa bilgisi**: Baskı türleri, kağıt, son işlemler\n\nBir soru sorun, hemen yanıtlayayım!',
      suggestions: ['Bugünkü özet', 'Geciken siparişler', 'Sipariş oluştur'],
    };
  }

  return {
    response: `Size yardımcı olabilirim! 📋 Mevcut özet:\n\n- Toplam sipariş: **${context.totalOrders}**\n- Aktif: **${context.activeOrders}**\n- Geciken: **${context.overdueOrders}**\n- Bugünkü teslim: **${context.todayDeliveries}**\n\nDaha detaylı bilgi için bir konu belirtin.`,
    suggestions: ['Bugünkü öncelikler', 'Geciken işler', 'Ne yapabilirsin?'],
  };
}

// ============================================
// POST Handler
// ============================================

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    // Rate limiting
    const userId = session.user.id || session.user.email || 'anonymous';
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { message, context, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mesaj gereklidir.' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: 'Mesaj çok uzun (maks. 2000 karakter).' }, { status: 400 });
    }

    const aiService = getAIService();
    
    const workspaceContext = {
      totalOrders: context?.totalOrders || 0,
      activeOrders: context?.activeOrders || 0,
      overdueOrders: context?.overdueOrders || 0,
      todayDeliveries: context?.todayDeliveries || 0,
      recentTasks: context?.recentTasks || [],
      upcomingDeadlines: context?.upcomingDeadlines || [],
    };

    // Inject conversation history from client if provided
    if (Array.isArray(history) && history.length > 0) {
      const sanitizedHistory = history
        .slice(-20)
        .filter((h: any) => h.role && h.content && typeof h.content === 'string')
        .map((h: any) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content.slice(0, 2000),
        }));
      aiService.setConversationHistory(sanitizedHistory);
    }

    try {
      const result = await aiService.query(message, workspaceContext);

      return NextResponse.json({
        success: true,
        response: result.answer,
        confidence: result.confidence,
        suggestions: result.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
      });
    } catch (aiError: any) {
      console.error('[AI Chat API] Provider error, fallback active:', aiError?.message || aiError);
      const fallback = buildFallbackAnswer(message, workspaceContext);
      return NextResponse.json({
        success: true,
        fallback: true,
        response: fallback.response,
        confidence: 0.6,
        suggestions: fallback.suggestions,
      });
    }
  } catch (error: any) {
    console.error('[AI Chat API] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }
}
