import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendVerificationEmail } from '@/lib/email';
import { authLimiter, rateLimitResponse } from '@/lib/api/rate-limit';

import { sql } from '@/lib/db';

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Name validation - prevent XSS and ensure reasonable format
function sanitizeName(name: string): string {
  return name.trim().slice(0, 100).replace(/<[^>]*>/g, '');
}

// Generate cryptographically secure token
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Validate password strength
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Şifre gereklidir' };
  }
  
  if (password.length < 6) {
    return { valid: false, error: 'Şifre en az 6 karakter olmalıdır' };
  }
  
  if (password.length > 128) {
    return { valid: false, error: 'Şifre çok uzun' };
  }
  
  const weakPasswords = ['123456', 'password', '123456789', 'qwerty', 'abc123', '111111'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { valid: false, error: 'Bu şifre çok zayıf' };
  }
  
  return { valid: true };
}

export async function POST(request: NextRequest) {
  // Rate limiting check
  const { allowed, remaining, resetIn } = authLimiter.check(request);
  if (!allowed) {
    return rateLimitResponse(remaining, resetIn);
  }

  try {
    const body = await request.json();
    
    // Extract and sanitize inputs
    const name = body?.name ? sanitizeName(body.name) : '';
    const email = body?.email?.trim()?.toLowerCase() || '';
    const password = body?.password || '';
    const companyName = body?.companyName ? sanitizeName(body.companyName) : '';

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
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error, field: 'password' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${email} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kullanılıyor', field: 'email' },
        { status: 400 }
      );
    }

    // Hash password with strong salt rounds
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate secure verification token
    const verificationToken = generateSecureToken();

    // Create user (email NOT verified yet)
    const users = await sql`
      INSERT INTO users (name, email, password, verification_token, created_at, updated_at)
      VALUES (${name}, ${email}, ${hashedPassword}, ${verificationToken}, NOW(), NOW())
      RETURNING id
    `;

    if (users.length === 0) {
      throw new Error('User creation failed');
    }

    const userId = users[0].id;

    // Create tenant with sanitized name
    const tenantName = companyName || `${name}'in Şirketi`;
    const tenantSlug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9ğüşıöç]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + 
      '-' + Date.now().toString(36);

    const tenants = await sql`
      INSERT INTO tenants (name, slug, created_at, updated_at)
      VALUES (${tenantName}, ${tenantSlug}, NOW(), NOW())
      RETURNING id
    `;

    if (tenants.length > 0) {
      // Link user to tenant as owner
      await sql`
        INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
        VALUES (${tenants[0].id}, ${userId}, 'owner', NOW())
      `;
    }

    // Send verification email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
    return NextResponse.json(
      { error: 'Kayıt olurken bir hata oluştu', field: 'general' },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
