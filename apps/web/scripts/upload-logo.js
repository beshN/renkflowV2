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
const PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${BUCKET_NAME}.r2.dev`; // Use custom domain if set, else fallback

async function uploadLogo() {
  console.log('Uploading logo to R2...');
  
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo-full.png');
    const fileContent = fs.readFileSync(logoPath);
    
    // We'll upload it to a public folder
    const key = 'public/logo-full.png'; 
    
    // Try to determine content type
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: 'image/png',
      ACL: 'public-read', // Though R2 doesn't always strictly use ACLs, intent is clear
    });
    
    await r2Client.send(command);
    
    const finalUrl = `${PUBLIC_URL}/${key}`;
    
    console.log('✅ Logo uploaded successfully!');
    console.log('URL:', finalUrl);
    console.log('Note: Ensure your R2 bucket allows public access or you have a worker/domain mapped.');
    
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
  }
}

uploadLogo();
