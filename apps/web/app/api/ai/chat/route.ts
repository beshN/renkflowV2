import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { getDashboardSummary, findOrder, getCriticalStock, getWorkOrders } from '@/lib/ai/tools';
import { auth } from '@/auth';
import { sql } from '@/lib/db';

// ============================================
// Simple in-memory rate limiter
// ============================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 20;

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
// Tool Intent Detection
// AI'ın hangi tool'u kullanacağını tespit et
// ============================================

type ToolIntent =
  | { tool: 'findOrder'; args: { query: string } }
  | { tool: 'getCriticalStock'; args: Record<string, never> }
  | { tool: 'getWorkOrders'; args: { overdueOnly?: boolean; status?: string } }
  | { tool: 'getDashboardSummary'; args: Record<string, never> }
  | null;

function detectToolIntent(message: string): ToolIntent {
  const lower = message.toLowerCase();

  // Sipariş arama — "RF-1842", "sipariş no", müşteri adı gibi
  const orderMatch = message.match(/\bRF[-\s]?\d+\b/i);
  if (orderMatch) {
    return { tool: 'findOrder', args: { query: orderMatch[0].replace(/\s/, '-') } };
  }

  // Kritik stok
  if (lower.includes('kritik stok') || lower.includes('stok azald') || lower.includes('stok bitti') || lower.includes('stok alarm')) {
    return { tool: 'getCriticalStock', args: {} };
  }

  // Geciken işler
  if (lower.includes('gecik') || lower.includes('geç kalın') || lower.includes('vadesi geç')) {
    return { tool: 'getWorkOrders', args: { overdueOnly: true } };
  }

  // Dashboard özeti
  if (lower.includes('genel durum') || lower.includes('bugün ne var') || lower.includes('özet') || lower.includes('kaç sipariş')) {
    return { tool: 'getDashboardSummary', args: {} };
  }

  return null;
}

// ============================================
// GET tenant ID from session
// ============================================

async function getTenantId(userId: string): Promise<string | null> {
  const rows = await sql`
    SELECT tenant_id FROM tenant_members
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  return (rows[0] as any)?.tenant_id || null;
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

    // Inject conversation history
    if (Array.isArray(history) && history.length > 0) {
      const sanitizedHistory = history
        .slice(-20)
        .filter((h: any) => h.role && h.content && typeof h.content === 'string')
        .map((h: any) => ({
          role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: h.content.slice(0, 2000),
        }));
      aiService.setConversationHistory(sanitizedHistory);
    }

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

    // Tool intent detection + execution
    let toolResults: Record<string, unknown> = {};
    let toolsUsed: string[] = [];

    const tenantId = session.user.id ? await getTenantId(session.user.id) : null;

    if (tenantId) {
      const toolContext = { tenantId, userId: session.user.id || '' };
      const intent = detectToolIntent(message);

      if (intent) {
        try {
          switch (intent.tool) {
            case 'findOrder':
              toolResults = { orders: await findOrder(toolContext, intent.args.query) };
              toolsUsed = ['findOrder'];
              break;
            case 'getCriticalStock':
              toolResults = { criticalStock: await getCriticalStock(toolContext) };
              toolsUsed = ['getCriticalStock'];
              break;
            case 'getWorkOrders':
              toolResults = { workOrders: await getWorkOrders(toolContext, intent.args) };
              toolsUsed = ['getWorkOrders'];
              break;
            case 'getDashboardSummary':
              toolResults = { summary: await getDashboardSummary(toolContext) };
              toolsUsed = ['getDashboardSummary'];
              break;
          }
        } catch (toolError) {
          console.error('[AI Tool Error]', toolError);
          // Tool başarısız olursa sadece context ile devam et
        }
      }
    }

    // AI'ya tool sonuçlarını bağlam olarak ver
    const result = Object.keys(toolResults).length > 0
      ? await aiService.queryWithContext(message, workspaceContext, toolResults)
      : await aiService.query(message, workspaceContext);

    return NextResponse.json({
      success: true,
      response: result.answer,
      confidence: result.confidence,
      suggestions: result.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
      toolsUsed,
    });
  } catch (error: any) {
    console.error('[AI Chat API] Error:', error?.message || error);
    const status = error?.message?.includes('API anahtarı') || error?.message?.includes('ZAI_API_KEY') ? 503 : 502;
    return NextResponse.json(
      { error: error?.message || 'AI servisine ulaşılamadı. Lütfen tekrar deneyin.' },
      { status }
    );
  }
}
