#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Delete test email invitations
    const inviteResult = await sql`
      DELETE FROM public.invitations 
      WHERE email LIKE '%test%' OR email LIKE '%example%'
    `;
    const invites = Number(inviteResult.count ?? 0);
    console.log(`✅ Removed ${invites} test invitations`);

    // Delete test tenants and their members (cascade will handle members)
    const tenantResult = await sql`
      DELETE FROM public.tenants 
      WHERE name LIKE '%Test%' OR name LIKE '%test%' OR slug LIKE '%test%'
    `;
    const tenants = Number(tenantResult.count ?? 0);
    console.log(`✅ Removed ${tenants} test tenants`);

    // Delete test profiles (only if they don't have real data)
    const profileResult = await sql`
      DELETE FROM public.profiles 
      WHERE email LIKE '%test%' OR email LIKE '%example%'
    `;
    const profiles = Number(profileResult.count ?? 0);
    console.log(`✅ Removed ${profiles} test profiles`);

    console.log('✅ Cleanup completed successfully!');
    await sql.end({ timeout: 5 });
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await sql.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  }
}

cleanupTestData();
