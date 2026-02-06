import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/services/ai.service';
import { auth } from '@/auth';

function buildFallbackAnswer(message: string, context: {
  totalOrders: number;
  activeOrders: number;
  overdueOrders: number;
  todayDeliveries: number;
}) {
  const query = message.toLowerCase();

  if (query.includes('gecik')) {
    return {
      response: `Geciken sipariş sayısı: ${context.overdueOrders}. İsterseniz bu siparişleri öncelik sırasına göre çıkarabilirim.`,
      suggestions: ['Geciken siparişleri listele', 'Müşteriye bilgilendirme metni oluştur', 'Üretim planını optimize et'],
    };
  }

  if (query.includes('gelir') || query.includes('ciro') || query.includes('tahsilat')) {
    return {
      response: `Toplam sipariş: ${context.totalOrders}. Aktif sipariş: ${context.activeOrders}. Finans panelinden detaylı gelir/tahsilat kırılımını açabilirsiniz.`,
      suggestions: ['Finans paneline git', 'Bu ayki sipariş özeti', 'Rapor oluştur'],
    };
  }

  if (query.includes('teslim') || query.includes('üretim')) {
    return {
      response: `Bugünkü teslim planı: ${context.todayDeliveries}. Aktif üretimdeki sipariş sayısı: ${context.activeOrders}.`,
      suggestions: ['Bugünkü teslim listesi', 'Üretimdeki siparişleri aç', 'Kanban görünümüne geç'],
    };
  }

  return {
    response:
      `Size yardımcı olabilirim. Mevcut özet: toplam ${context.totalOrders} sipariş, ${context.activeOrders} aktif, ${context.overdueOrders} geciken sipariş.`,
    suggestions: ['Bugünkü öncelikler', 'Geciken işler', 'Sipariş özeti'],
  };
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, context } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
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

    try {
      const result = await aiService.query(message, workspaceContext);

      return NextResponse.json({
        success: true,
        response: result.answer,
        confidence: result.confidence,
        suggestions: result.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
      });
    } catch (aiError) {
      console.error('[AI Chat API] Provider error, fallback active:', aiError);
      const fallback = buildFallbackAnswer(message, workspaceContext);
      return NextResponse.json({
        success: true,
        fallback: true,
        response: fallback.response,
        confidence: 0.6,
        suggestions: fallback.suggestions,
      });
    }
  } catch (error) {
    console.error('[AI Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
