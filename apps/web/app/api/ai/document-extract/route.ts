import { resolveUploadedFile } from "@/lib/storage/upload-reference";
import { NextRequest, NextResponse } from 'next/server';
import { getAIService } from '@/lib/ai/service';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/features/auth/permissions';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  return NextResponse.json({ available: Boolean(process.env.OPENAI_API_KEY?.trim()) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json({ error: 'Belge analizi henüz etkinleştirilmedi. Sipariş bilgilerini elle girebilirsiniz.' }, { status: 503 });
    }

    if (!hasPermission(session.user.role as any, 'orders.create')) return NextResponse.json({ error: 'Yetkiniz yok.' }, { status: 403 });
    const body = await req.json();
    const { mimeType, prompt } = body;
    let documentBase64 = body.documentBase64 || body.base64;
    if (body.blobPath) {
      if (!session.user.id || !session.user.tenantId) return NextResponse.json({error:"Oturum gerekli"},{status:401});
      const file = await resolveUploadedFile({userId:session.user.id,tenantId:session.user.tenantId},{name:body.name,mime:mimeType,blobPath:body.blobPath});
      documentBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    }

    if (!documentBase64 || !mimeType) {
      return NextResponse.json({ error: 'documentBase64 ve mimeType gereklidir.' }, { status: 400 });
    }

    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mimeType) || typeof documentBase64 !== 'string' || documentBase64.length > 14_000_000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(documentBase64)) return NextResponse.json({ error: 'Geçersiz belge veya dosya boyutu.' }, { status: 400 });

    const defaultPrompt = `Bu belgeyi analiz et. Sipariş ise: müşteri, ürün, ölçüler (genişlik, yükseklik), adet, renk, motor, LED, kumaş, notlar, teslimat bilgilerini çıkar.
Fatura veya irsaliye ise: tedarikçi, ürünler, adetler, fiyatlar bilgilerini çıkar.
Eğer belge sipariş veya irsaliye değilse, genel içeriğini özetle ve bulabildiğin yapısal verileri çıkar.`;

    const aiService = getAIService();
    
    const result = await aiService.analyzeDocument(
      documentBase64,
      mimeType,
      prompt || defaultPrompt,
      { tenantId: session.user.tenantId ?? null, userId: session.user.id ?? null, feature: 'document.extract' }
    );

    return NextResponse.json({
      success: true,
      data: result.extractedData,
      rawText: result.rawText,
    });
  } catch (error: any) {
    console.error('[AI Document Extract API] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Belge analizi tamamlanamadı. Dosyayı kontrol edip tekrar deneyin.' },
      { status: 500 }
    );
  }
}

export const maxDuration = 300;
