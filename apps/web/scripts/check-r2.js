
const { S3Client, PutObjectCommand, ListObjectsCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Setup Client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

async function testR2() {
  console.log('🔵 Starting R2 Connection Test...');
  console.log('Account ID:', process.env.R2_ACCOUNT_ID ? 'OK' : 'MISSING');
  console.log('Bucket:', BUCKET_NAME);

  try {
    // 1. List Buckets (actually List Objects to verify bucket access)
    console.log('\n📂 Listing Files in Bucket...');
    const listCmd = new ListObjectsCommand({ Bucket: BUCKET_NAME, MaxKeys: 5 });
    const listRes = await r2Client.send(listCmd);
    console.log('Files found:', listRes.Contents ? listRes.Contents.length : 0);
    if(listRes.Contents) {
        listRes.Contents.forEach(f => console.log(' - ' + f.Key));
    }

    // 2. Upload Test File
    console.log('\n⬆️  Uploading Test File...');
    const testKey = `test-upload-${Date.now()}.txt`;
    const uploadCmd = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: 'Hello from RenkFlow Deployment Test',
        ContentType: 'text/plain'
    });
    await r2Client.send(uploadCmd);
    console.log('✅ Upload Successful:', testKey);

    console.log('\nR2 IS WORKING CORRECTLY ✅');

  } catch (error) {
    console.error('\n❌ R2 ERROR:', error.message);
    if(error.name === 'NetworkingError') console.error('Check your internet connection or firewall.');
    if(error.name === 'InvalidAccessKeyId') console.error('Check R2_ACCESS_KEY_ID.');
    if(error.name === 'SignatureDoesNotMatch') console.error('Check R2_SECRET_ACCESS_KEY.');
  }
}

testR2();
