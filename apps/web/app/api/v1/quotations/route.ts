import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse } from '@/lib/api/auth-helpers';
import { quotationService } from '@/lib/features/quotations/service';
import { CreateQuotationSchema } from '@/lib/features/quotations/types';
import { hasPermission, UserRole, AuthorizationError } from '@/lib/auth/rbac';
import { ZodError } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    const role = (user.role as UserRole) || 'member';
    if (!hasPermission(role, 'quotations', 'list')) {
      return errorResponse('Bu işlem için yetkiniz bulunmuyor', 403);
    }

    const quotations = await quotationService.getQuotations(user.tenantId);
    return successResponse(quotations, 'Teklifler başarıyla getirildi');
  } catch (error: any) {
    if (error instanceof AuthorizationError) return errorResponse(error.message, 403);
    return errorResponse(error.message || 'Hata oluştu', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    const role = (user.role as UserRole) || 'member';
    if (!hasPermission(role, 'quotations', 'create')) {
      return errorResponse('Sipariş oluşturma yetkiniz bulunmuyor', 403);
    }

    const body = await request.json();
    const parsedData = CreateQuotationSchema.parse(body);

    const quotation = await quotationService.createQuotation(user.tenantId, parsedData, user.id);
    return successResponse(quotation, 'Teklif başarıyla oluşturuldu');
  } catch (error: any) {
    if (error instanceof ZodError) return errorResponse('Geçersiz veri: ' + error.issues.map((issue) => issue.message).join(', '), 400);
    if (error instanceof AuthorizationError) return errorResponse(error.message, 403);
    return errorResponse(error.message || 'Hata oluştu', 500);
  }
}
