
const dotenv = require('dotenv');
const path = require('path');

// 1. Load envs FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function diagnose() {
  console.log('\n🔍 STARTING FULL SYSTEM DIAGNOSIS (Fixed Order) 🔍');
  console.log('---------------------------------------');
  
  // 2. Import modules AFTER env load
  const { orderService } = require('../lib/features/orders/orderService.server');
  const { PostgresOrderService } = require('../lib/features/orders/postgres/order.postgres');
  const { MockOrderService } = require('../lib/features/orders/mock/order.mock');
  const { sql } = require('../lib/db');

  console.log('1️⃣  Environment Variables');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Defined' : '❌ MISSING');
  console.log('   Blob storage:', Boolean(process.env.BLOB_READ_WRITE_TOKEN) ? 'configured' : 'missing');
  console.log('   NEXT_PUBLIC_USE_DATABASE:', process.env.NEXT_PUBLIC_USE_DATABASE);

  console.log('\n2️⃣  Service Selection Logic');
  const isPostgres = orderService instanceof PostgresOrderService;
  const isMock = orderService instanceof MockOrderService;

  if (isPostgres) {
    console.log('   ✅ Service Factory selected: POSTGRES (Real DB)');
  } else if (isMock) {
    console.log('   ⚠️  Service Factory selected: MOCK (Memory)');
  } else {
    console.log('   ❓ Unknown Service Type');
  }

  // 3. Test Database Connection
  console.log('\n3️⃣  Testing Application DB Client');
  try {
     // Check if sql is function
     if(typeof sql !== 'function' && typeof sql.then !== 'function') { // sql`...` usually
         const time = await sql`SELECT now()`;
         console.log('   ✅ DB Connection Successful!');
         console.log('      Time:', time[0].now);
     } else {
         // It might be the wrapped function
          const time = await sql`SELECT now()`;
          console.log('   ✅ DB Connection Successful!');
          console.log('      Time:', time[0].now);
     }
  } catch (error) {
    console.error('   ❌ DB Connection FAILED:', (error as any).message);
  }
}

diagnose();
