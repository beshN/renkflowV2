
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local manually
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
  console.log('Testing Database Connection...');
  console.log('URL:', process.env.DATABASE_URL ? 'Defined (Hidden)' : 'Missing');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is missing in .env.local');
    process.exit(1);
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT now(), current_database()`;
    console.log('✅ Connection Successful!');
    console.log('Time:', result[0].now);
    console.log('Database:', result[0].current_database);
    
    // Check Tenant ID logic mock
    console.log('Checking orders table existence...');
    try {
        const count = await sql`SELECT count(*) FROM orders`;
        console.log('✅ Orders table exists. Count:', count[0].count);
    } catch (e) {
        console.error('❌ Orders table access failed:', (e as any).message);
    }

  } catch (error) {
    console.error('❌ Connection Failed:', error);
  }
}

testConnection();
