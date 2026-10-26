import { privateAccessEmail } from '@/lib/features/auth/private-access';
import { NextRequest, NextResponse } from 'next/server';
import { passwordProblem } from '@/lib/security/access-matrix';
import bcrypt from 'bcryptjs';
import { sendVerificationEmail } from '@/lib/email';
import { consumeRateLimit, getClientIp, rateLimitResponse } from '@/lib/security/rate-limit';
import { sql, withTransaction } from '@/lib/db';
import { DEFAULT_TEMPLATE_KEY, TEMPLATE_BY_KEY, TemplateKey } from '@/lib/config/templates';
import { resolveServerBaseUrl } from '@/lib/shared/config/runtime-env';
import { hasLegalConsent, LEGAL_CONSENT_REQUIRED_MESSAGE } from '@/lib/features/auth/legal-consent';
import { recordLegalConsent } from '@/lib/features/auth/legal-consent.server';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Name validation - prevent XSS and ensure reasonable format
function sanitizeName(name: string): string {
  return name.trim().slice(0, 100).replace(/<[^>]*>/g, '');
}

// Generate cryptographically secure token using Web Crypto API (Edge compatible)
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Validate password strength
function validatePassword(password: unknown, email?: string | null): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Şifre gereklidir' };
  }
  const problem = passwordProblem(password, email);
  if (problem) return { valid: false, error: problem };
  const weakPasswords = ['password123', 'qwerty12345', '1234567890a', 'abc1234567'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Bu şifre çok zayıf' };
  }
  return { valid: true };
}

function mapRegistrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('duplicate') ||
    normalized.includes('unique') ||
    normalized.includes('users_email')
  ) {
    return {
      status: 400,
      field: 'email',
      error: 'Bu e-posta adresi zaten kullanılıyor',
      code: 'email_exists',
    };
  }

  if (
    normalized.includes('database_url') ||
    normalized.includes('connection') ||
    normalized.includes('connect') ||
    normalized.includes('timeout') ||
    normalized.includes('econn')
  ) {
    return {
      status: 500,
      field: 'general',
      error: 'Veritabanına bağlanılamadı. Lütfen daha sonra tekrar deneyin.',
      code: 'db_unavailable',
    };
  }

  return {
    status: 500,
    field: 'general',
    error: 'Kayıt olurken bir hata oluştu',
    code: 'unknown_error',
  };
}

export async function POST(request: NextRequest) {
  if (privateAccessEmail()) return NextResponse.json({error: 'Bu çalışma alanı özel erişime açık. Yeni hesap kaydı kapalı.'}, {status:403});
  // Rate limiting check
  const limit = await consumeRateLimit('register', getClientIp(request.headers));
  if (!limit.allowed) {
    return rateLimitResponse(limit);
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Geçersiz istek formatı', field: 'general', code: 'invalid_payload' },
        { status: 400 }
      );
    }
    
    // Extract and sanitize inputs
    const name = body?.name ? sanitizeName(body.name) : '';
    const email = body?.email?.trim()?.toLowerCase() || '';
    const password = body?.password || '';
    const companyName = body?.companyName ? sanitizeName(body.companyName) : '';
    const rawTemplateKey = (body?.templateKey as TemplateKey) || DEFAULT_TEMPLATE_KEY;
    const selectedTemplate = TEMPLATE_BY_KEY[rawTemplateKey] || TEMPLATE_BY_KEY[DEFAULT_TEMPLATE_KEY];
    const industry = selectedTemplate.industry;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Ad Soyad gereklidir', field: 'name' },
        { status: 400 }
      );
    }

    if (name.length < 2) {
      return NextResponse.json(
        { error: 'Ad Soyad en az 2 karakter olmalıdır', field: 'name' },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'E-posta adresi gereklidir', field: 'email' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Geçerli bir e-posta adresi girin', field: 'email' },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password, email);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error, field: 'password' },
        { status: 400 }
      );
    }

    if (!hasLegalConsent(body)) {
      return NextResponse.json(
        { error: LEGAL_CONSENT_REQUIRED_MESSAGE, field: 'acceptLegal', code: 'consent_required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;

    const existingUsersRows = existingUsers as any[];
    if (existingUsersRows.length > 0) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kullanılıyor', field: 'email' },
        { status: 400 }
      );
    }

    // Hash password with strong salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate secure verification token
    const verificationToken = generateSecureToken();

    const tenantName = companyName || `${name}'in Şirketi`;
    const tenantSlug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + 
      '-' + Date.now().toString(36);

    const { userId } = await withTransaction(async (tx) => {
      const users = await tx`
        INSERT INTO users (name, email, password, verification_token, created_at, updated_at)
        VALUES (${name}, ${email}, ${hashedPassword}, ${verificationToken}, NOW(), NOW())
        RETURNING id
      `;

      const usersRows = users as any[];
      if (usersRows.length === 0) {
        throw new Error('User creation failed');
      }
      const createdUserId = usersRows[0].id as string;
      await recordLegalConsent(tx, { userId: createdUserId, ip: getClientIp(request.headers) });

      const tenants = await tx`
        INSERT INTO tenants (name, slug, industry, template_key, created_at, updated_at)
        VALUES (${tenantName}, ${tenantSlug}, ${industry}, ${selectedTemplate.key}, NOW(), NOW())
        RETURNING id
      `;
      const tenantsRows = tenants as any[];
      if (tenantsRows.length === 0) {
        throw new Error('Tenant creation failed');
      }

      await tx`
        INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
        VALUES (${tenantsRows[0].id}, ${createdUserId}, 'owner', NOW())
      `;

      return { userId: createdUserId };
    });

    // Send verification email
    const baseUrl =
      resolveServerBaseUrl({
        context: 'api.auth.register',
        fallbackOrigin: request.nextUrl.origin,
      }) || request.nextUrl.origin;
    const verificationUrl = `${baseUrl}/auth/verify?token=${verificationToken}`;
    
    const emailResult = await sendVerificationEmail(email, name, verificationUrl);
    
    if (!emailResult.success) {
      console.error('Failed to send verification email:', emailResult.error);
      // Don't fail the signup if email fails (user created successfully)
    }

    // Log successful registration

    return NextResponse.json(
      { 
        success: true, 
        userId,
        message: 'Hesabınız oluşturuldu! Lütfen e-posta adresinizi kontrol edin.' 
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('Registration error:', error);
    const mapped = mapRegistrationError(error);
    return NextResponse.json(
      { error: mapped.error, field: mapped.field, code: mapped.code },
      { status: mapped.status }
    );
  }
}
