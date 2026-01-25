import { NextRequest } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse, handleCORS, generateAPIToken } from '@/lib/api/middleware';

import { sql } from '@/lib/db';

// Email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CORS preflight
export async function OPTIONS() {
  return handleCORS();
}

// POST /api/v1/auth/login - Login and get JWT token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();
    const password = body?.password;

    // Validate inputs
    if (!email || !password) {
      return errorResponse('E-posta ve şifre gereklidir', 400);
    }

    if (!EMAIL_REGEX.test(email)) {
      return errorResponse('Geçerli bir e-posta adresi girin', 400);
    }

    // Find user
    const users = await sql`
      SELECT 
        u.id, 
        u.email, 
        u.name, 
        u.password,
        u.email_verified,
        tm.role,
        tm.tenant_id
      FROM users u
      LEFT JOIN tenant_members tm ON tm.user_id = u.id
      WHERE u.email = ${email}
      LIMIT 1
    `;

    if (users.length === 0) {
      // Use same error message for security
      return errorResponse('E-posta veya şifre hatalı', 401);
    }

    const user = users[0];

    // Check if email is verified
    if (!user.email_verified) {
      return errorResponse('Lütfen önce e-posta adresinizi doğrulayın', 401);
    }

    // Verify password
    if (!user.password) {
      return errorResponse('Bu hesap için şifre ile giriş yapılamaz', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return errorResponse('E-posta veya şifre hatalı', 401);
    }

    // Generate JWT token
    const { accessToken, expiresIn } = generateAPIToken({
      id: user.id,
      email: user.email,
      name: user.name || 'Kullanıcı',
      role: user.role || 'member',
      tenantId: user.tenant_id || '',
    });

    // Log successful login
    // console.log(`API login successful: ${email}`);

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'member',
        tenantId: user.tenant_id,
      },
      accessToken,
      expiresIn,
      tokenType: 'Bearer',
    }, 'Giriş başarılı');
  } catch (error: unknown) {
    console.error('API login error:', error);
    return errorResponse('Giriş yapılırken bir hata oluştu', 500);
  }
}
export const runtime = 'edge';
