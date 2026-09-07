import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const body = await req.json();
    const { documentBase64, mimeType, prompt } = body;

    if (!documentBase64 || !mimeType) {
      return NextResponse.json({ error: 'documentBase64 ve mimeType gereklidir.' }, { status: 400 });
    }

    const defaultPrompt = `Bu belgeyi analiz et. Sipariş ise: müşteri, ürün, ölçüler (genişlik, yükseklik), adet, renk, motor, LED, kumaş, notlar, teslimat bilgilerini çıkar.
Fatura veya irsaliye ise: tedarikçi, ürünler, adetler, fiyatlar bilgilerini çıkar.
Eğer belge sipariş veya irsaliye değilse, genel içeriğini özetle ve bulabildiğin yapısal verileri çıkar.`;

    const aiService = getAIService();
    
    const result = await aiService.analyzeDocument(
      documentBase64,
      mimeType,
      prompt || defaultPrompt
    );

    return NextResponse.json({
      success: true,
      data: result.extractedData,
      rawText: result.rawText,
    });
  } catch (error: any) {
    console.error('[AI Document Extract API] Error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Belge analizi sırasında bir hata oluştu.' },
      { status: 500 }
    );
  }
}
