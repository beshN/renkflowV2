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
      currentPath: typeof context?.currentPath === 'string' ? context.currentPath : undefined,
      userName: typeof context?.userName === 'string' ? context.userName : undefined,
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

    const result = await aiService.query(message, workspaceContext);

    return NextResponse.json({
      success: true,
      response: result.answer,
      confidence: result.confidence,
      suggestions: result.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
    });
  } catch (error: any) {
    console.error('[AI Chat API] Error:', error?.message || error);
    const status = error?.message?.includes('API anahtarı') ? 500 : 502;
    return NextResponse.json(
      { error: error?.message || 'AI servisine ulaşılamadı. Lütfen tekrar deneyin.' },
      { status }
    );
  }
}
