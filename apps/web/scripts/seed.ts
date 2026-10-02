#!/usr/bin/env tsx
/**
 * Database Seed Script
 * Populates the database with initial/demo data
 * 
 * Usage: npm run db:seed
 */

import postgres from 'postgres';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

dotenv.config({ path: '.env.local' });

const DEMO_TENANT = {
  name: 'Renk Alüminyum',
  slug: 'renk-aluminyum-demo',
  brandColor: '#2563eb',
  industry: 'Alüminyum üretimi',
  templateKey: 'aluminyum',
};

const DEMO_USER = {
  name: 'Demo Kullanıcı',
  email: 'demo@renkflow.com',
  password: 'demo123456', // Will be hashed
};

const DEMO_ORDERS = [
  {
    orderNumber: 'RF-001',
    customerName: 'Örnek Yapı A.Ş.',
    email: 'ahmet@example.com',
    phone: '+90 532 123 4567',
    productName: 'Alüminyum sürme doğrama',
    quantity: 1,
    status: 'pending',
    totalAmount: 15000,
    currency: 'TRY',
    notes: 'DEMO · 2400 × 2100 mm · RAL 7016 mat. Profil serisi ve aksesuarlar müşteri onayında doğrulanacak.',
  },
  {
    orderNumber: 'RF-002',
    customerName: 'Örnek Cephe Ltd.',
    email: 'fatma@example.com',
    phone: '+90 533 234 5678',
    productName: 'Alüminyum pencere sistemi',
    quantity: 1,
    status: 'in_production',
    totalAmount: 8500,
    currency: 'TRY',
    notes: 'DEMO · 1200 × 1500 mm · RAL 9016. Kesim ölçüleri teknik çizime göre doğrulanacak.',
  },
  {
    orderNumber: 'RF-003',
    customerName: 'Örnek Proje',
    email: 'mehmet@example.com',
    phone: '+90 534 345 6789',
    productName: '40×40 alüminyum profil çerçeve',
    quantity: 1,
    status: 'delivered',
    totalAmount: 25000,
    currency: 'TRY',
    notes: 'DEMO · 1000 × 1000 mm çerçeve. 6 m ticari profil boyu; gerçek kg/m değeri malzeme kartında doğrulanacak.',
  },
];

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('🌱 Starting database seeding...');

  try {
    const sql = postgres(databaseUrl, { max: 1 });

    // Check if demo tenant already exists
    const existingTenant = await sql`
      SELECT * FROM tenants WHERE slug IN (${DEMO_TENANT.slug}, 'demo-mobilya')
      ORDER BY CASE WHEN slug = ${DEMO_TENANT.slug} THEN 0 ELSE 1 END LIMIT 1
    `;

    let tenantId: string;

    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id;
      const oldSamples = await sql`
        SELECT * FROM orders WHERE tenant_id = ${tenantId}
        AND order_number IN ('RF-001', 'RF-002', 'RF-003')
      `;
      const backupDirectory = resolve(process.cwd(), '../../../outputs');
      await mkdir(backupDirectory, { recursive: true });
      await writeFile(resolve(backupDirectory, 'renkflow-demo-before-' + Date.now() + '.json'),
        JSON.stringify({ tenant: existingTenant[0], orders: oldSamples }, null, 2));
      if (existingTenant[0].name === 'Demo Mobilya') {
        await sql`
          UPDATE tenants SET name = ${DEMO_TENANT.name}, slug = ${DEMO_TENANT.slug},
            brand_color = ${DEMO_TENANT.brandColor}, industry = ${DEMO_TENANT.industry},
            template_key = ${DEMO_TENANT.templateKey}
          WHERE id = ${tenantId} AND name = 'Demo Mobilya'
        `;
      }
      console.log('✅ Existing demo company located; sample backup saved');
    } else {
      // Create demo tenant
      const [tenant] = await sql`
        INSERT INTO tenants (name, slug, brand_color, industry, template_key)
        VALUES (${DEMO_TENANT.name}, ${DEMO_TENANT.slug}, ${DEMO_TENANT.brandColor}, ${DEMO_TENANT.industry}, ${DEMO_TENANT.templateKey})
        RETURNING id
      `;
      tenantId = tenant.id;
      console.log('✅ Demo tenant created');
    }

    // Check if demo user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${DEMO_USER.email}
    `;

    let userId: string;

    if (existingUser.length > 0) {
      console.log('ℹ️  Demo user already exists, skipping creation');
      userId = existingUser[0].id;
    } else {
      // Hash password and create demo user
      const hashedPassword = await bcrypt.hash(DEMO_USER.password, 12);
      const [user] = await sql`
        INSERT INTO users (name, email, password, email_verified)
        VALUES (${DEMO_USER.name}, ${DEMO_USER.email}, ${hashedPassword}, NOW())
        RETURNING id
      `;
      userId = user.id;
      console.log('✅ Demo user created');
    }

    // Link user to tenant if not already linked
    const existingMembership = await sql`
      SELECT id FROM tenant_members WHERE tenant_id = ${tenantId} AND user_id = ${userId}
    `;

    if (existingMembership.length === 0) {
      await sql`
        INSERT INTO tenant_members (tenant_id, user_id, role)
        VALUES (${tenantId}, ${userId}, 'owner')
      `;
      console.log('✅ User linked to tenant as owner');
    }

    // Create demo orders
    for (const order of DEMO_ORDERS) {
      const existingOrder = await sql`
        SELECT id FROM orders WHERE tenant_id = ${tenantId} AND order_number = ${order.orderNumber}
      `;

      if (existingOrder.length === 0) {
        await sql`
          INSERT INTO orders (
            tenant_id, order_number, customer_name, email, phone,
            product_name, quantity, status, total_amount, currency, notes
          ) VALUES (
            ${tenantId}, ${order.orderNumber}, ${order.customerName}, ${order.email}, ${order.phone},
            ${order.productName}, ${order.quantity}, ${order.status}, ${order.totalAmount}, ${order.currency}, ${order.notes}
          )
        `;
        console.log(`✅ Order ${order.orderNumber} created`);
      } else {
        const legacyProducts: Record<string, string> = {
          'RF-001': 'Modern Köşe Koltuk', 'RF-002': 'Yemek Masası Seti', 'RF-003': 'Yatak Odası Takımı',
        };
        const updated = await sql`
          UPDATE orders SET customer_name = ${order.customerName}, product_name = ${order.productName}, notes = ${order.notes}
          WHERE tenant_id = ${tenantId} AND order_number = ${order.orderNumber}
            AND product_name = ${legacyProducts[order.orderNumber]}
          RETURNING id
        `;
        console.log(updated.length ? `✅ Legacy demo ${order.orderNumber} updated` : `ℹ️  Order ${order.orderNumber} preserved`);
      }
    }

    console.log('');
    console.log('🎉 Database seeding completed!');
    console.log('');
    console.log('Demo Credentials:');
    console.log(`   Email: ${DEMO_USER.email}`);
    console.log(`   Password: ${DEMO_USER.password}`);
    console.log('');
    await sql.end({ timeout: 5 });
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
