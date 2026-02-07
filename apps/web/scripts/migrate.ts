#!/usr/bin/env tsx
/**
 * Database Migration Script
 * Runs pending migrations against the database
 * 
 * Usage: npm run db:migrate
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('   Create a .env.local file with your Neon connection string');
    process.exit(1);
  }

  console.log('🔄 Running database migrations...');
  console.log('   Database:', databaseUrl.replace(/:[^:]*@/, ':****@'));

  try {
    const sql = neon(databaseUrl);
    const db = drizzle(sql);

    const migrationsFolder = path.join(__dirname, '..', 'lib', 'db', 'migrations');

    await migrate(db, { migrationsFolder });

    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
