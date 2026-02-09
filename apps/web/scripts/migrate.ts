#!/usr/bin/env tsx
/**
 * Database Migration Script
 * Runs pending migrations against the database
 * 
 * Usage: npm run db:migrate
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import dotenv from 'dotenv';
import path from 'path';
import { ensureBackendSchema } from './ensure-backend-schema';

dotenv.config({ path: '.env.local' });

async function runMigrations() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('   Create a .env.local file with your PostgreSQL connection string');
    process.exit(1);
  }

  console.log('🔄 Running database migrations...');
  console.log('   Database:', databaseUrl.replace(/:[^:]*@/, ':****@'));

  try {
    const client = postgres(databaseUrl, { max: 1 });
    const db = drizzle(client);

    const migrationsFolder = path.join(__dirname, '..', 'lib', 'db', 'migrations');

    await migrate(db, { migrationsFolder });
    await ensureBackendSchema(client, { baseDir: path.join(__dirname, '..'), logPrefix: '[db:migrate]' });
    await client.end({ timeout: 5 });

    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
