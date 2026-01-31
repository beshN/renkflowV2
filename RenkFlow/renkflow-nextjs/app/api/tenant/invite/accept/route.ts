import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { sql } from '@/lib/db';

// Sanitize name input
function sanitizeName(name: string): string {
  return name.trim().slice(0, 100).replace(/<[^>]*>/g, '');
}

// Validate password
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
  return { valid: true };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = body?.token?.trim();
    const name = body?.name ? sanitizeName(body.name) : '';
    const password = body?.password;

    // Validate inputs
    if (!token) {
      return NextResponse.json(
        { error: 'Geçersiz istek' },
        { status: 400 }
      );
    }

    if (!name || name.length < 2) {
      return NextResponse.json(
        { error: 'Ad Soyad en az 2 karakter olmalıdır' },
        { status: 400 }
      );
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: passwordValidation.error },
        { status: 400 }
      );
    }

    // Get and validate invitation
    const invitations = await sql`
      SELECT id, tenant_id, email, role, expires_at
      FROM invitations
      WHERE token = ${token}
      AND expires_at > NOW()
      LIMIT 1
    `;

    if (invitations.length === 0) {
      return NextResponse.json(
        { error: 'Bu davet linki geçersiz veya süresi dolmuş.' },
        { status: 400 }
      );
    }

    const invitation = invitations[0];

    // Check if user already exists
    const existingUsers = await sql`
      SELECT id FROM users WHERE email = ${invitation.email} LIMIT 1
    `;

    if (existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'Bu e-posta adresi zaten kayıtlı.' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user (already verified via invitation)
    const users = await sql`
      INSERT INTO users (name, email, password, email_verified, created_at, updated_at)
      VALUES (${name}, ${invitation.email}, ${hashedPassword}, NOW(), NOW(), NOW())
      RETURNING id
    `;

    if (users.length === 0) {
      throw new Error('User creation failed');
    }

    const userId = users[0].id;

    // Add user to tenant with the invited role
    await sql`
      INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
      VALUES (${invitation.tenant_id}, ${userId}, ${invitation.role}, NOW())
    `;

    // Delete the invitation
    await sql`
      DELETE FROM invitations WHERE id = ${invitation.id}
    `;

    // Log
    // console.log(`User ${invitation.email} accepted invitation to tenant ${invitation.tenant_id}`);

    return NextResponse.json({
      success: true,
      message: 'Hesabınız oluşturuldu!',
    });
  } catch (error: unknown) {
    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Hesap oluşturulurken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
