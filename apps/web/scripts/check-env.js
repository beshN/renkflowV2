// Test script to verify R2 bucket configuration
const path = require('path');
const fs = require('fs');

// Load env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
require('dotenv').config({ path: envLocalPath });

console.log('=== Environment Variables Check ===');
console.log('R2_ACCOUNT_ID:', process.env.R2_ACCOUNT_ID ? '✓ Set' : '✗ Missing');
console.log('R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✓ Set' : '✗ Missing');
console.log('R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✓ Set' : '✗ Missing');
console.log('R2_BUCKET_NAME:', process.env.R2_BUCKET_NAME || '(using default: renkflow-documents)');
console.log('');

// Check what the code will actually use
const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'renkflow-documents';
console.log('=== Actual Bucket Name Used ===');
console.log('Bucket:', BUCKET_NAME);
console.log('');

if (BUCKET_NAME !== 'renkflow-storage') {
  console.log('⚠️  WARNING: Bucket name mismatch!');
  console.log('   Expected: renkflow-storage');
  console.log('   Got:', BUCKET_NAME);
  console.log('');
  console.log('Fix: Add this line to .env.local:');
  console.log('   R2_BUCKET_NAME=renkflow-storage');
} else {
  console.log('✅ Bucket name is correct!');
}
