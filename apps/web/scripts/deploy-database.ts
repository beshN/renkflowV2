import dotenv from "dotenv";
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { DEPLOY_BOOTSTRAP_MIGRATIONS, ensureBackendSchema, ensureMigrationLedger, recordMigration } from "./ensure-backend-schema";
/** Explicit, additive release step. Never run this from next build or load development env implicitly. */
async function main() {
 const file=process.argv.find(a=>a.startsWith("--env-file="))?.slice(11);
 if(file) dotenv.config({path:file,quiet:true});
 const url=process.env.DATABASE_URL_UNPOOLED;
 if(!url) throw new Error("DATABASE_URL_UNPOOLED is required for migrations");
 const parsed=new URL(url);
 if(!["postgres:","postgresql:"].includes(parsed.protocol)) throw new Error("PostgreSQL connection required");
 const local=["localhost","127.0.0.1","[::1]"].includes(parsed.hostname);
 if(local && !(process.env.ALLOW_LOCAL_DATABASE==="1" && parsed.pathname.endsWith("_migration_test"))) throw new Error("Local migrations require an isolated *_migration_test database");
 if(!local && !["require","verify-ca","verify-full"].includes(parsed.searchParams.get("sslmode")||"")) throw new Error("Migration connection must require TLS");
 parsed.searchParams.delete("channel_binding");
 const db=postgres(parsed.toString(),{max:1,prepare:false,connect_timeout:15,onnotice:()=>{}});
 try {
  // Dedicated direct connection; serializes releases across separate deploys.
  await db`SELECT pg_advisory_lock(624938512)`;
  const [base]=await db`SELECT to_regclass('public.tenants') AS tenants,to_regclass('public.users') AS users,to_regclass('public.orders') AS orders`;
  if(!base.tenants && !base.users && !base.orders) {
   const [tables]=await db`SELECT count(*)::integer AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`;
   if(tables.count!==0) throw new Error("Partially initialized database; inspect before applying a bootstrap");
   // Historical schema.sql contains destructive demo resets. Strip DROP statements;
   // additionally require an empty database and apply the bootstrap atomically.
   const bootstrap=readFileSync("lib/db/schema.sql","utf8").replace(/^drop table[^;]*;\s*$/gim,"");
   if(/\bdrop\s+table\b/i.test(bootstrap)) throw new Error("Destructive bootstrap statement detected");
   await db.begin(async tx=> {await tx.unsafe(bootstrap);});
   console.log("[db] Empty database initialized without demo data");
  } else if(!base.tenants || !base.users || !base.orders) throw new Error("Core schema is incomplete; no destructive repair attempted");
  await ensureMigrationLedger(db);
  for(const file of DEPLOY_BOOTSTRAP_MIGRATIONS) {const raw=readFileSync(`lib/db/migrations/${file}`,"utf8");await db.unsafe(raw);await recordMigration(db,file,raw);}
  await ensureBackendSchema(db);
  console.log("[db] Additive deployment migrations completed");
 } finally {
  await db`SELECT pg_advisory_unlock(624938512)`.catch(()=>{});
  await db.end({timeout:5});
 }
}
main().catch(()=>{console.error("[db] Migration failed. No connection string or provider details logged; inspect the schema before retrying.");process.exitCode=1;});
