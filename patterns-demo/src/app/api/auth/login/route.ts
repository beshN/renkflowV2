// ============================================
// AUTH LOGIN API ROUTE
// Next.js App Router API Handler
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  generateTokenPair, 
  hashToken, 
  tokenRotationService, 
  cookieConfig,
  verifyRefreshToken,
} from '@/lib/auth/jwt';
import { checkRateLimit } from '@/lib/auth/middleware';

// ============================================
// SCHEMA
// ============================================

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi girin'),
  password: z.string().min(1, 'Şifre gerekli'),
  rememberMe: z.boolean().optional(),
});

// ============================================
// MOCK USER LOOKUP (Replace with real DB)
// ============================================

async function findUserByEmail(email: string) {
  const users = [
    { 
      id: 'user-1', 
      email: 'admin@example.com', 
      name: 'Admin User',
      role: 'admin' as const,
      passwordHash: '$2b$10$...', // bcrypt hash
    },
    { 
      id: 'user-2', 
      email: 'user@example.com', 
      name: 'Regular User',
      role: 'user' as const,
      passwordHash: '$2b$10$...',
    },
  ];
  
  return users.find(u => u.email === email) ?? null;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // In production: return bcrypt.compare(password, hash);
  return password.length > 0; // Mock for demo
}

// ============================================
// POST /api/auth/login
// ============================================

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const rateLimit = checkRateLimit(`login:${ip}`, 5, 60000); // 5 attempts per minute
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Çok fazla giriş denemesi',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // Parse body
    const body = await request.json();
    
    // Validate
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Geçersiz giriş bilgileri',
          code: 'VALIDATION_ERROR',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = validation.data;

    // Find user
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'E-posta veya şifre hatalı', code: 'INVALID_CREDENTIALS' },
        { status: 401 }
      );
    }

    // Generate tokens
    const tokens = await generateTokenPair({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token
    const refreshPayload = await verifyRefreshToken(tokens.refreshToken);
    if (refreshPayload?.jti) {
      const tokenHash = await hashToken(tokens.refreshToken);
      await tokenRotationService.storeRefreshToken(
        user.id,
        refreshPayload.jti,
        tokenHash,
        {
          userAgent: request.headers.get('user-agent') ?? undefined,
          ipAddress: ip,
        }
      );
    }

    // Create response
    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      message: 'Giriş başarılı',
    });

    // Set cookies
    const cookieMaxAge = rememberMe 
      ? cookieConfig.refreshToken.options.maxAge 
      : undefined; // Session cookie if not remember me

    response.cookies.set(
      cookieConfig.accessToken.name,
      tokens.accessToken,
      cookieConfig.accessToken.options
    );

    response.cookies.set(
      cookieConfig.refreshToken.name,
      tokens.refreshToken,
      {
        ...cookieConfig.refreshToken.options,
        maxAge: cookieMaxAge,
      }
    );

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Sunucu hatası', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
