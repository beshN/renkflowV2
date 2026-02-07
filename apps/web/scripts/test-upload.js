const path = require('path');
const fs = require('fs');

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
require('dotenv').config({ path: envLocalPath });

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'renkflow-documents';

async function testUpload() {
  console.log('Testing file upload to R2...');
  console.log('Bucket:', BUCKET_NAME);
  
  try {
    const testContent = 'This is a test file from RenkFlow';
    const testKey = `test/${Date.now()}-test.txt`;
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: 'text/plain',
    });
    
    await r2Client.send(command);
    
    console.log('✅ SUCCESS! File uploaded to:', testKey);
    console.log('');
    console.log('This means:');
    console.log('  ✓ R2 credentials are correct');
    console.log('  ✓ Bucket exists and is accessible');
    console.log('  ✓ File upload functionality works');
    console.log('');
    console.log('You can now create orders with file attachments!');
    
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    
    if (err.name === 'NoSuchBucket') {
      console.log('');
      console.log('The bucket does not exist. Run:');
      console.log('  node scripts/setup-r2.js');
    } else if (err.name === 'InvalidAccessKeyId') {
      console.log('');
      console.log('Invalid credentials. Check your .env.local:');
      console.log('  R2_ACCESS_KEY_ID');
      console.log('  R2_SECRET_ACCESS_KEY');
    }
  }
}

testUpload();
