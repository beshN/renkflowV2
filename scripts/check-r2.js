const path = require('path');
const fs = require('fs');

// Load env vars
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config({ path: envPath });
}

const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error('Error: Missing R2 environment variables.');
  console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? 'OK' : 'MISSING');
  console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? 'OK' : 'MISSING');
  console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? 'OK' : 'MISSING');
  process.exit(1);
}

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function listBuckets() {
  try {
    console.log('Checking R2 connection...');
    console.log('Endpoint:', `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    
    const command = new ListBucketsCommand({});
    const { Buckets } = await r2Client.send(command);
    
    console.log('\nBuckets found:');
    if (Buckets && Buckets.length > 0) {
      Buckets.forEach(b => console.log(` - ${b.Name}`));
    } else {
      console.log(' - No buckets found.');
    }
    
    const targetBucket = process.env.R2_BUCKET_NAME || 'renkflow-documents';
    console.log(`\nTarget Bucket: '${targetBucket}'`);
    
    const exists = Buckets && Buckets.some(b => b.Name === targetBucket);
    
    if (exists) {
      console.log(`✅ SUCCESS: Bucket '${targetBucket}' exists.`);
    } else {
      console.error(`❌ ERROR: Bucket '${targetBucket}' does NOT exist.`);
      console.log('Please create it in your Cloudflare R2 dashboard or update R2_BUCKET_NAME in .env');
    }
  } catch (err) {
    console.error('\n❌ Error connecting to R2:', err.message);
    if (err.name === 'InvalidAccessKeyId') {
      console.log('Check your R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.');
    }
  }
}

listBuckets();
