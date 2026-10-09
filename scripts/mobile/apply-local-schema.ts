// Deliberately hard-wired to db:local. This script cannot apply a migration to production.
import postgres from '../../apps/web/node_modules/postgres';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
async function main() {
  const directory=path.resolve(__dirname,'../../apps/web/lib/features/mobile/migrations');
  const db=postgres('postgres://postgres:renkflow-local-only@127.0.0.1:55432/renkflow_test',{onnotice:()=>{}});
  try { for(const file of readdirSync(directory).filter(f=>f.endsWith('.sql')).sort()) await db.unsafe(readFileSync(path.join(directory,file),'utf8')); }
  finally { await db.end(); }
  console.log('Mobile schema applied to isolated renkflow_test only');
}
main().catch(()=>{console.error('Local mobile schema failed');process.exit(1);});
