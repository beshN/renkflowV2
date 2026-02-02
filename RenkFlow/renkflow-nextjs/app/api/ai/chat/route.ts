import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/services/ai.service';
import { auth } from '@/auth';

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

    const result = await aiService.query(message, workspaceContext);

    return NextResponse.json({
      success: true,
      response: result.answer,
      confidence: result.confidence,
      suggestions: result.suggestions || ['Detayları gör', 'Rapor oluştur', 'Başka bir soru'],
    });
  } catch (error) {
    console.error('[AI Chat API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
