#!/usr/bin/env node

/**
 * Push schema to PostgreSQL database
 * 
 * Usage: npm run db:push
 */

const postgres = require('postgres');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

async function pushSchema() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('   Create a .env.local file with your PostgreSQL connection string');
    process.exit(1);
  }

  try {
    const sql = postgres(databaseUrl, { max: 1 });
    const schemaPath = path.join(__dirname, '..', 'lib', 'db', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('🔄 Pushing schema to PostgreSQL database...');
    
    // Split schema into individual statements
    // Remove comments and split by semicolon
    const statements = schema
      .replace(/--.*$/gm, '') // Remove comments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await sql(statement);
      } catch (err) {
        // Skip if object already exists
        const errorMessage = err?.message || String(err);
        if (errorMessage.includes('already exists')) {
          console.log(`⏭️  Skipping (already exists): ${statement.substring(0, 50)}...`);
        } else {
          throw err;
        }
      }
    }
    await sql.end({ timeout: 5 });
    
    console.log('✅ Schema pushed successfully!');
  } catch (error) {
    console.error('❌ Error pushing schema:', error);
    process.exit(1);
  }
}

pushSchema();
