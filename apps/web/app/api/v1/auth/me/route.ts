import { NextRequest } from 'next/server';
import { getAPIUser, successResponse, errorResponse, handleCORS } from '@/lib/api/auth-helpers';

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// GET /api/v1/auth/me - Get current user info
export async function GET(request: NextRequest) {
  try {
    const user = await getAPIUser(request);
    
    if (!user) {
      return errorResponse('Yetkilendirme gereklidir', 401);
    }

    return successResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
    }, 'Kullanıcı bilgileri');
  } catch (error: unknown) {
    console.error('Get me error:', error);
    return errorResponse('Kullanıcı bilgileri alınırken bir hata oluştu', 500);
  }
}
