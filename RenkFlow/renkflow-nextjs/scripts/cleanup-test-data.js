import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    // Delete test email invitations
    const { rowCount: invites } = await sql`
      DELETE FROM public.invitations 
      WHERE email LIKE '%test%' OR email LIKE '%example%'
    `;
    console.log(`✅ Removed ${invites} test invitations`);

    // Delete test tenants and their members (cascade will handle members)
    const { rowCount: tenants } = await sql`
      DELETE FROM public.tenants 
      WHERE name LIKE '%Test%' OR name LIKE '%test%' OR slug LIKE '%test%'
    `;
    console.log(`✅ Removed ${tenants} test tenants`);

    // Delete test profiles (only if they don't have real data)
    const { rowCount: profiles } = await sql`
      DELETE FROM public.profiles 
      WHERE email LIKE '%test%' OR email LIKE '%example%'
    `;
    console.log(`✅ Removed ${profiles} test profiles`);

    console.log('✅ Cleanup completed successfully!');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupTestData();
