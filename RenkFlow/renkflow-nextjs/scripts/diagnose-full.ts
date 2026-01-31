
const dotenv = require('dotenv');
const path = require('path');

// 1. Load envs FIRST
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function diagnose() {
  console.log('\n🔍 STARTING FULL SYSTEM DIAGNOSIS (Fixed Order) 🔍');
  console.log('---------------------------------------');
  
  // 2. Import modules AFTER env load
  const { orderService } = require('../lib/services/index');
  const { NeonOrderService } = require('../lib/services/neon/order.neon');
  const { MockOrderService } = require('../lib/services/mock/order.mock');
  const { sql } = require('../lib/db/neon');

  console.log('1️⃣  Environment Variables');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Defined' : '❌ MISSING');
  console.log('   R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME);
  console.log('   NEXT_PUBLIC_USE_DATABASE:', process.env.NEXT_PUBLIC_USE_DATABASE);

  console.log('\n2️⃣  Service Selection Logic');
  const isNeon = orderService instanceof NeonOrderService;
  const isMock = orderService instanceof MockOrderService;

  if (isNeon) {
    console.log('   ✅ Service Factory selected: NEON (Real DB)');
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
     }
  } catch (error) {
    console.error('   ❌ DB Connection FAILED:', (error as any).message);
  }
}

diagnose();
