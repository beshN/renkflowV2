#!/usr/bin/env node

/**
 * Push schema to Neon database
 * 
 * Usage: npm run db:push
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function pushSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('   Create a .env.local file with your Neon connection string');
    process.exit(1);
  }

  try {
    const sql = neon(databaseUrl);
    const schemaPath = path.join(__dirname, '..', 'lib', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Pushing schema to Neon database...');
    
    console.log('🔄 Pushing schema to Neon database...');
    
    // Split schema into individual statements
    // Remove comments and split by semicolon
    const statements = schema
      .replace(/--.*$/gm, '') // Remove comments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      await sql(statement);
    }
    
    console.log('✅ Schema pushed successfully!');
  } catch (error) {
    console.error('❌ Error pushing schema:', error);
    process.exit(1);
  }
}

pushSchema();
