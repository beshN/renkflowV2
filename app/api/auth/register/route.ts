import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(request: Request) {
  try {
    const { name, email, password, companyName } = await request.json();

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Tüm alanları doldurun', field: 'general' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Şifre en az 6 karakter olmalıdır', field: 'password' },
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

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const users = await sql`
      INSERT INTO users (name, email, password, email_verified)
      VALUES (${name}, ${email}, ${hashedPassword}, NOW())
      RETURNING id
    `;

    if (users.length === 0) {
      throw new Error('User creation failed');
    }

    const userId = users[0].id;

    // Create tenant
    const tenantSlug = (companyName || name)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') + '-' + Date.now();

    const tenants = await sql`
      INSERT INTO tenants (name, slug)
      VALUES (${companyName || `${name}'in Şirketi`}, ${tenantSlug})
      RETURNING id
    `;

    if (tenants.length > 0) {
      // Link user to tenant as owner
      await sql`
        INSERT INTO tenant_members (tenant_id, user_id, role)
        VALUES (${tenants[0].id}, ${userId}, 'owner')
      `;
    }

    return NextResponse.json(
      { success: true, userId },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Kayıt olurken bir hata oluştu', field: 'general' },
      { status: 500 }
    );
  }
}
