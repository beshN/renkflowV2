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

dotenv.config({ path: '.env.local' });

const DEMO_TENANT = {
  name: 'Demo Mobilya',
  slug: 'demo-mobilya',
  brandColor: '#8c5e40',
  industry: 'mobilya',
  templateKey: 'mobilya',
};

const DEMO_USER = {
  name: 'Demo Kullanıcı',
  email: 'demo@renkflow.com',
  password: 'demo123456', // Will be hashed
};

const DEMO_ORDERS = [
  {
    orderNumber: 'RF-001',
    customerName: 'Ahmet Yılmaz',
    email: 'ahmet@example.com',
    phone: '+90 532 123 4567',
    productName: 'Modern Köşe Koltuk',
    quantity: 1,
    status: 'pending',
    totalAmount: 15000,
    currency: 'TRY',
    notes: 'Gri kumaş, ayaklar krom olacak',
  },
  {
    orderNumber: 'RF-002',
    customerName: 'Fatma Demir',
    email: 'fatma@example.com',
    phone: '+90 533 234 5678',
    productName: 'Yemek Masası Seti',
    quantity: 1,
    status: 'in_production',
    totalAmount: 8500,
    currency: 'TRY',
    notes: '6 kişilik, ceviz rengi',
  },
  {
    orderNumber: 'RF-003',
    customerName: 'Mehmet Kaya',
    email: 'mehmet@example.com',
    phone: '+90 534 345 6789',
    productName: 'Yatak Odası Takımı',
    quantity: 1,
    status: 'delivered',
    totalAmount: 25000,
    currency: 'TRY',
    notes: 'Beyaz lake, led aydınlatmalı',
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
      SELECT id FROM tenants WHERE slug = ${DEMO_TENANT.slug}
    `;

    let tenantId: string;

    if (existingTenant.length > 0) {
      console.log('ℹ️  Demo tenant already exists, skipping creation');
      tenantId = existingTenant[0].id;
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
        console.log(`ℹ️  Order ${order.orderNumber} already exists, skipping`);
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
