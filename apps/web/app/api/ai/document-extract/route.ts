import { resolveUploadedFile } from "@/lib/storage/upload-reference";
import { NextRequest, NextResponse } from 'next/server';
import { aiAvailable, getAIService } from '@/lib/ai/service';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/features/auth/permissions';
import { can } from '@/lib/security/access-matrix';
import { resolveMemberAccess } from '@/lib/security/member-access.server';
import { consumeRateLimit, rateLimitResponse } from '@/lib/security/rate-limit';
import { crossOriginRejection } from '@/lib/features/manufacturing/http-security';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
  return NextResponse.json({ available: aiAvailable() }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const crossOrigin = crossOriginRejection(req);
  if (crossOrigin) return crossOrigin;
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.tenantId) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }
    if (!aiAvailable()) {
      return NextResponse.json({ error: 'Belge analizi henüz etkinleştirilmedi. Sipariş bilgilerini elle girebilirsiniz.' }, { status: 503 });
    }

    const access = await resolveMemberAccess(session.user.id, session.user.tenantId, { cached: false });
    if (!access || access.deactivated) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }
    if (!hasPermission(access.base as any, 'orders.create') || !can(access, 'orders', 'create')) {
      return NextResponse.json({ error: 'Yetkiniz yok.' }, { status: 403 });
    }

    const limit = await consumeRateLimit('aiExtract', session.user.id);
    if (!limit.allowed) return rateLimitResponse(limit);

    const body = await req.json();
    const { mimeType, prompt } = body;
    let documentBase64 = body.documentBase64 || body.base64;
    if (body.blobPath) {
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

    const safePrompt = typeof prompt === 'string' && prompt.trim() ? prompt.trim().slice(0, 4000) : defaultPrompt;
    const aiService = getAIService();
    
    const result = await aiService.analyzeDocument(
      documentBase64,
      mimeType,
      safePrompt,
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
