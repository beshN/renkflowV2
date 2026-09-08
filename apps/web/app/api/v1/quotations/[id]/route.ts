import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse } from '@/lib/api/auth-helpers';
import { quotationService } from '@/lib/features/quotations/service';
import { CreateQuotationSchema } from '@/lib/features/quotations/types';
import { hasPermission, UserRole, AuthorizationError } from '@/lib/auth/rbac';
import { z, ZodError } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId) return errorResponse('Yetkilendirme gereklidir', 401);

    const role = (user.role as UserRole) || 'member';
    if (!hasPermission(role, 'quotations', 'read')) return errorResponse('Yetkiniz yok', 403);

    const { id } = await params;
    const quotation = await quotationService.getQuotationById(user.tenantId, id);
    if (!quotation) return errorResponse('Teklif bulunamadı', 404);

    return successResponse(quotation);
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId) return errorResponse('Yetkilendirme gereklidir', 401);

    const role = (user.role as UserRole) || 'member';
    if (!hasPermission(role, 'quotations', 'update')) return errorResponse('Yetkiniz yok', 403);

    const body = await request.json();
    
    const { id } = await params;
    
    if (body.action === 'convert') {
      const result = await quotationService.convertToOrder(user.tenantId, id, user.id);
      return successResponse(result, 'Teklif siparişe dönüştürüldü');
    }

    if (body.status) {
      const validStatus = z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted']).parse(body.status);
      const quotation = await quotationService.updateStatus(user.tenantId, id, validStatus);
      return successResponse(quotation, 'Durum güncellendi');
    }

    const parsedData = CreateQuotationSchema.partial().parse(body);
    const quotation = await quotationService.updateQuotation(user.tenantId, id, parsedData);
    return successResponse(quotation, 'Teklif güncellendi');
  } catch (error: any) {
    if (error instanceof ZodError) return errorResponse('Geçersiz veri: ' + error.issues.map((issue) => issue.message).join(', '), 400);
    return errorResponse(error.message, 500);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const user = await getAPIUser(request);
    if (!user || !user.tenantId) return errorResponse('Yetkilendirme gereklidir', 401);

    const role = (user.role as UserRole) || 'member';
    if (!hasPermission(role, 'quotations', 'delete')) return errorResponse('Yetkiniz yok', 403);

    const { id } = await params;
    await quotationService.deleteQuotation(user.tenantId, id);
    return successResponse({ success: true }, 'Teklif silindi');
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
}
