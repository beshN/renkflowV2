import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

import { withTransaction } from '@/lib/db';

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

class AcceptInviteError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = 'AcceptInviteError';
    this.status = status;
  }
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

    const result = await withTransaction(async (tx) => {
      const invitations = await tx`
        SELECT id, tenant_id, email, role, expires_at
        FROM invitations
        WHERE token = ${token}
          AND expires_at > NOW()
        LIMIT 1
        FOR UPDATE
      `;

      const invitationsRows = invitations as any[];
      if (invitationsRows.length === 0) {
        throw new AcceptInviteError('Bu davet linki geçersiz veya süresi dolmuş.', 400);
      }
      const invitation = invitationsRows[0];

      const existingUsers = await tx`
        SELECT id FROM users WHERE email = ${invitation.email} LIMIT 1
      `;
      const existingUsersRows = existingUsers as Array<{ id: string }>;
      let userId = existingUsersRows[0]?.id || '';

      if (!userId) {
        if (!name || name.length < 2) {
          throw new AcceptInviteError('Ad Soyad en az 2 karakter olmalıdır', 400);
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          throw new AcceptInviteError(passwordValidation.error || 'Geçersiz şifre', 400);
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        try {
          const users = await tx`
            INSERT INTO users (name, email, password, email_verified, created_at, updated_at)
            VALUES (${name}, ${invitation.email}, ${hashedPassword}, NOW(), NOW(), NOW())
            RETURNING id
          `;
          const usersRows = users as Array<{ id: string }>;
          if (usersRows.length === 0) {
            throw new Error('User creation failed');
          }
          userId = usersRows[0].id;
        } catch (error: any) {
          // Handle race: another flow might have created the user with same email.
          if (error?.code === '23505') {
            const raceUsers = await tx`
              SELECT id FROM users WHERE email = ${invitation.email} LIMIT 1
            `;
            const raceRows = raceUsers as Array<{ id: string }>;
            userId = raceRows[0]?.id || '';
          } else {
            throw error;
          }
        }
      }

      if (!userId) {
        throw new Error('Could not resolve invited user');
      }

      await tx`
        INSERT INTO tenant_members (tenant_id, user_id, role, created_at)
        VALUES (${invitation.tenant_id}, ${userId}, ${invitation.role}, NOW())
        ON CONFLICT (tenant_id, user_id) DO NOTHING
      `;

      await tx`
        DELETE FROM invitations WHERE id = ${invitation.id}
      `;

      return { existingUser: Boolean(existingUsersRows[0]?.id) };
    });

    return NextResponse.json({
      success: true,
      existingUser: result.existingUser,
      message: result.existingUser
        ? 'Davet kabul edildi. Mevcut hesabınız ile giriş yapabilirsiniz.'
        : 'Hesabınız oluşturuldu!',
    });
  } catch (error: unknown) {
    if (error instanceof AcceptInviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Accept invite error:', error);
    return NextResponse.json(
      { error: 'Hesap oluşturulurken bir hata oluştu.' },
      { status: 500 }
    );
  }
}
