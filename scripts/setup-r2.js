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

const { S3Client, CreateBucketCommand, ListBucketsCommand, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
  console.error('Error: Missing R2 environment variables.');
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

async function setupR2() {
  const bucketName = process.env.R2_BUCKET_NAME || 'renkflow-documents';
  console.log(`Setting up R2 Bucket: '${bucketName}'...`);

  try {
    // 1. Check if exists
    const listCmd = new ListBucketsCommand({});
    const { Buckets } = await r2Client.send(listCmd);
    const exists = Buckets && Buckets.some(b => b.Name === bucketName);

    if (exists) {
      console.log(`✅ Bucket '${bucketName}' already exists.`);
    } else {
      console.log(`Bucket '${bucketName}' not found. Creating...`);
      const createCmd = new CreateBucketCommand({ Bucket: bucketName });
      await r2Client.send(createCmd);
      console.log(`✅ Bucket '${bucketName}' created successfully.`);
    }

    // 2. Configure CORS (Important for direct browser access/download if needed)
    console.log('Configuring CORS...');
    const corsCmd = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: ['*'], // For development. In production, restrict this.
            ExposeHeaders: ['ETag'],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    });
    await r2Client.send(corsCmd);
    console.log('✅ CORS configured successfully.');

  } catch (err) {
    console.error('❌ Error setting up R2:', err);
  }
}

setupR2();
